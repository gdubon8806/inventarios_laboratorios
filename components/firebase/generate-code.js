// Alta de un registro NUEVO con su código (o unidades con código) generado automáticamente.
// Los registros nuevos "nacen con código": el contador y el registro se escriben en la misma transacción.
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { firestore, runGenerationBatch, currentUser } from './codes-shared';
import { validateRecordData, checkQuantity } from '../../lib/codes/thresholds';
import { canonicalTipo, usesUnits } from '../../lib/codes/prefixes';
import { splitJobsIntoBatches } from '../../lib/codes/planning';

/**
 * Crea un registro con código automático.
 * @param {object} recordData  datos del formulario (equipo, marca, modelo, tipo, cantidad, idLab, imgurl, ...)
 * @param {object} [opts]      { confirmed:boolean, user:{uid,email} }
 * @returns {Promise<
 *   {status:'created', id, codes:string[], unidades:number, incompleto:boolean} |
 *   {status:'needs-confirmation', action:'validar-uno-a-uno'|'confirmar', threshold, cantidad} |
 *   {status:'invalid', motivo} |
 *   {status:'error', error}
 * >}
 * - `needs-confirmation`: la UI debe mostrar el diálogo D11 y volver a llamar con { confirmed:true }.
 * - `incompleto:true`: un registro con muchísimas unidades quedó a medias (sinCodigo con progreso);
 *   se completa llamando a generateMissingCodes(labId) (reanudable).
 */
export async function createRecordWithCode(recordData, opts = {}) {
  try {
    const v = validateRecordData(recordData);
    if (!v.ok) return { status: 'invalid', motivo: v.motivo };
    if (usesUnits(recordData.tipo) && v.cantidad < 1) {
      return { status: 'invalid', motivo: 'La cantidad debe ser al menos 1 para Mobiliario, Equipo y Herramienta' };
    }
    const q = checkQuantity(recordData.tipo, v.cantidad);
    if (q.action !== 'ok' && !opts.confirmed) {
      return { status: 'needs-confirmation', action: q.action, threshold: q.threshold, cantidad: v.cantidad };
    }
    const id = doc(collection(firestore, 'items')).id;
    const user = currentUser(opts.user);
    const now = serverTimestamp();
    const base = {
      ...recordData,
      tipo: canonicalTipo(recordData.tipo),
      cantidad: v.cantidad,
      observaciones: Array.isArray(recordData.observaciones) ? '' : recordData.observaciones ?? '',
      numeroSerie: recordData.numeroSerie ?? '',
      codigoFundaempresa: recordData.codigoFundaempresa ?? '',
      tieneVencimiento: recordData.tieneVencimiento ?? false,
      fechaVencimiento: recordData.tieneVencimiento ? recordData.fechaVencimiento ?? null : null,
      activo: true,
      estadoCodigo: 'sinCodigo',
      unidadesGeneradas: 0,
      estado: 'bueno',
      requiereValidacion: false,
      pendienteValidar: false,
      cambioTipoEnCurso: false,
      ultimaModificacion: now,
      ultimaModificacionPor: user,
    };
    const job = usesUnits(recordData.tipo)
      ? { recordId: id, kind: 'units', units: v.cantidad }
      : { recordId: id, kind: 'ins', units: 0 };
    const batches = splitJobsIntoBatches([job]);
    const first = await runGenerationBatch(batches[0], { user, newRecords: { [id]: base } });
    const codes = first.flatMap((r) => r.codes);
    let unidades = first.reduce((s, r) => s + (r.created && job.kind === 'units' ? r.created : 0), 0);
    let incompleto = false;
    for (const b of batches.slice(1)) {
      try {
        const res = await runGenerationBatch(b, { user });
        codes.push(...res.flatMap((r) => r.codes));
        unidades += res.reduce((s, r) => s + (r.created ?? 0), 0);
      } catch (e) {
        incompleto = true;
        break;
      }
    }
    return { status: 'created', id, codes, unidades, incompleto };
  } catch (error) {
    return { status: 'error', error: error?.message ?? String(error) };
  }
}

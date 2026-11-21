// Botón "Generar códigos de barra" por laboratorio (D8): estado del lab, marcado de datos
// incongruentes (D13), validación D11 uno a uno y generación idempotente/reanudable en lotes.
import { collection, getDocs, query, where } from 'firebase/firestore';
import { firestore, commitWrites, runGenerationBatch, currentUser } from './codes-shared';
import {
  planGeneration, splitJobsIntoBatches, validationFlagUpdates, needsGeneration,
} from '../../lib/codes/planning';
import { validateRecordData } from '../../lib/codes/thresholds';

/** Lee los registros ACTIVOS de un lab (filtro en cliente `activo !== false`, ver plan §5). */
export async function readLabRecords(labId) {
  const snap = await getDocs(query(collection(firestore, 'items'), where('idLab', '==', labId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => r.activo !== false);
}

/**
 * Conteos para la tarjeta del lab y el botón.
 * -> { total, sinCodigo, pendienteImprimir, impreso, incongruentes, porValidar }
 * (una sola lectura de los registros del lab; para muchas tarjetas en la home considerar cachear)
 */
export function computeLabCodeStatus(records) {
  const s = { total: 0, sinCodigo: 0, pendienteImprimir: 0, impreso: 0, incongruentes: 0, porValidar: 0 };
  for (const r of records) {
    if (r.activo === false) continue;
    s.total += 1;
    if (!validateRecordData(r).ok) { s.incongruentes += 1; continue; }
    if (needsGeneration(r)) {
      s.sinCodigo += 1;
      if (r.pendienteValidar) s.porValidar += 1;
    } else if (r.estadoCodigo === 'pendienteImprimir') s.pendienteImprimir += 1;
    else if (r.estadoCodigo === 'impreso') s.impreso += 1;
  }
  return s;
}

export async function getLabCodeStatus(labId) {
  return computeLabCodeStatus(await readLabRecords(labId));
}

/**
 * Persiste/limpia requiereValidacion + motivoValidacion en los registros del lab.
 * -> { marked:number, cleared:number }
 */
export async function syncValidationFlags(labId, records) {
  const recs = records ?? (await readLabRecords(labId));
  const updates = validationFlagUpdates(recs);
  const writes = updates.map((u) => ({
    op: 'update',
    path: `items/${u.id}`,
    data: u.clear
      ? { requiereValidacion: false, motivoValidacion: null }
      : { requiereValidacion: true, motivoValidacion: u.set.motivoValidacion },
  }));
  await commitWrites(writes);
  return { marked: updates.filter((u) => u.set).length, cleared: updates.filter((u) => u.clear).length };
}

/**
 * Vista previa SIN escribir: qué se generaría y qué necesita validación uno a uno.
 * decisions: { [recordId]: 'crear' | 'omitir' }
 * -> { plan, status, totalCodigos }
 */
export async function previewGeneration(labId, decisions = {}) {
  const records = await readLabRecords(labId);
  const plan = planGeneration(records, decisions);
  const totalCodigos = plan.jobs.reduce((s, j) => s + (j.kind === 'ins' ? 1 : j.units), 0);
  return { plan, status: computeLabCodeStatus(records), totalCodigos };
}

/**
 * Genera los códigos faltantes de un lab. Idempotente y reanudable: si falla a medias, los registros
 * ya procesados quedaron con código y al reintentar sólo se procesan los pendientes.
 *
 * opts: {
 *   decisions: { [id]: 'crear'|'omitir' },   // respuestas del diálogo D11 (uno a uno)
 *   onProgress({ done, total, batchIndex, batches }),
 *   shouldCancel(): boolean,                  // se consulta entre lotes
 *   user
 * }
 * -> {
 *   status: 'ok' | 'cancelled' | 'interrupted',
 *   created: número de códigos creados, registros: número de registros completados,
 *   needValidation: [...]  // registros que superan umbrales y siguen sin decisión (NO se procesaron)
 *   omitted: [ids], incongruentes: [{id,motivo}], remaining: registros que aún quedan sin código, error?
 * }
 */
export async function generateMissingCodes(labId, opts = {}) {
  const { decisions = {}, onProgress, shouldCancel, user } = opts;
  const summary = { status: 'ok', created: 0, registros: 0, needValidation: [], omitted: [], incongruentes: [], remaining: 0 };
  try {
    const records = await readLabRecords(labId);
    await syncValidationFlags(labId, records);
    const plan = planGeneration(records, decisions);
    summary.needValidation = plan.needValidation;
    summary.omitted = plan.omitted;
    summary.incongruentes = plan.incongruentes;

    if (plan.omitted.length) {
      await commitWrites(plan.omitted.map((id) => ({ op: 'update', path: `items/${id}`, data: { pendienteValidar: true } })));
    }

    const batches = splitJobsIntoBatches(plan.jobs);
    const total = plan.jobs.reduce((s, j) => s + (j.kind === 'ins' ? 1 : j.units), 0);
    let done = 0;
    const finished = new Set();
    for (let i = 0; i < batches.length; i++) {
      if (shouldCancel?.()) { summary.status = 'cancelled'; break; }
      const results = await runGenerationBatch(batches[i], { user: currentUser(user) });
      for (const r of results) {
        summary.created += r.created ?? 0;
        done += r.created ?? 0;
      }
      batches[i].filter((p) => p.final).forEach((p) => finished.add(p.recordId));
      onProgress?.({ done, total, batchIndex: i + 1, batches: batches.length });
    }
    summary.registros = finished.size;
    summary.remaining =
      plan.jobs.length - finished.size + plan.needValidation.length + plan.omitted.length;
    return summary;
  } catch (error) {
    return { ...summary, status: 'interrupted', error: error?.message ?? String(error), remaining: -1 };
  }
}

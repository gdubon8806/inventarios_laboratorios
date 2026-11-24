import { readLabRecords } from './generate-missing-codes';
import { readUnits } from './manage-units';
import { usesUnits } from '../../lib/codes/prefixes';
import { validateRecordData } from '../../lib/codes/thresholds';

// Etiquetas imprimibles de un laboratorio: una por UNIDAD activa (MOB/HER/EQU) o una por registro (INS).
// Cada etiqueta: { id, codigo, nombre, lab, tipo, estadoCodigo, registroId, unidadId|null }
//   id = "<registroId>" (INS) o "<registroId>/<unidadId>" (unidad) → labelIdToTarget(id) lo revierte
//   para markPrinted([{ recordId, unidadId? }]).
// Los registros con datos incongruentes o sin código no producen etiqueta.
// Costo: 1 lectura de los registros + 1 subcolección por registro con unidades (de 8 en 8).

export function labelIdToTarget(id) {
  const [recordId, unidadId] = String(id).split('/');
  return unidadId ? { recordId, unidadId } : { recordId };
}

const CONCURRENCY = 8;

export default async function readLabLabels(lab) {
  const records = await readLabRecords(lab.id);
  const labels = [];
  const withUnits = [];

  for (const r of records) {
    if (!validateRecordData(r).ok) continue;
    if (usesUnits(r.tipo)) {
      withUnits.push(r);
    } else if (r.codigo) {
      labels.push({
        id: r.id,
        codigo: r.codigo,
        nombre: r.equipo || '',
        lab: lab.name,
        tipo: r.tipo,
        estadoCodigo: r.estadoCodigo ?? 'pendienteImprimir',
        registroId: r.id,
        unidadId: null,
      });
    }
  }

  for (let i = 0; i < withUnits.length; i += CONCURRENCY) {
    const group = withUnits.slice(i, i + CONCURRENCY);
    const unitLists = await Promise.all(group.map((r) => readUnits(r.id)));
    group.forEach((r, idx) => {
      for (const u of unitLists[idx]) {
        if (!u.codigo) continue;
        labels.push({
          id: `${r.id}/${u.id}`,
          codigo: u.codigo,
          nombre: r.equipo || '',
          lab: lab.name,
          tipo: r.tipo,
          estadoCodigo: u.estadoCodigo ?? 'pendienteImprimir',
          registroId: r.id,
          unidadId: u.id,
        });
      }
    });
  }
  return labels;
}

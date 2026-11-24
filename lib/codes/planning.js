// Planificación PURA de la generación de códigos: qué registros procesar, validaciones D11/D13,
// partición en lotes (≤450 escrituras) y asignación de rangos de contador. Sin Firebase.
import { prefixForTipo, usesUnits } from './prefixes.js';
import { checkQuantity, validateRecordData } from './thresholds.js';

export const MAX_BATCH_WRITES = 450; // Firestore permite 500 por transacción/lote; dejamos margen
export const COUNTER_WRITES_RESERVED = 4; // hasta 4 contadores (MOB/HER/INS/EQU) por lote
export const MAX_UNITS_PER_TYPE_CHANGE_CHUNK = 140; // 3 escrituras por unidad (cambio unidad->unidad)

export function chunk(array, size) {
  if (!Number.isInteger(size) || size < 1) throw new Error('size debe ser entero >= 1');
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

/**
 * Reserva rangos consecutivos de contador.
 * requests: [{ prefix:'EQU', count:3 }, ...]   counters: { EQU: 10 } (siguiente número libre; ausente => 1)
 * -> { ranges: { EQU: { start:10, count:3 } }, nextCounters: { EQU: 13 } }
 */
export function allocateRanges(requests, counters = {}) {
  const ranges = {};
  const nextCounters = {};
  for (const { prefix, count } of requests) {
    if (!count) continue;
    const start = ranges[prefix] ? ranges[prefix].start : counters[prefix] ?? 1;
    const prevCount = ranges[prefix]?.count ?? 0;
    ranges[prefix] = { start, count: prevCount + count };
    nextCounters[prefix] = start + prevCount + count;
  }
  return { ranges, nextCounters };
}

/** Estado de código agregado de un registro con unidades (solo unidades activas). */
export function aggregateEstadoCodigo(units) {
  const active = (units ?? []).filter((u) => u.activo !== false);
  if (active.length === 0) return 'sinCodigo';
  if (active.some((u) => u.estadoCodigo === 'sinCodigo' || !u.codigo)) return 'sinCodigo';
  if (active.some((u) => u.estadoCodigo !== 'impreso')) return 'pendienteImprimir';
  return 'impreso';
}

/** ¿El registro todavía necesita generación de código/unidades? */
export function needsGeneration(rec) {
  if (rec.activo === false) return false;
  const v = validateRecordData(rec);
  if (!v.ok) return false;
  if (!usesUnits(v.prefix)) return !rec.codigo;
  // Con unidades: faltan unidades por crear mientras las ya generadas (histórico, incluye bajas)
  // sean menos que la cantidad vigente. Esto también reanuda un lote interrumpido.
  const generated = Number(rec.unidadesGeneradas) || 0;
  return generated < v.cantidad;
}

/**
 * Banderas de validación a persistir (D13): marca/limpia requiereValidacion/motivoValidacion.
 * -> [{ id, set: { requiereValidacion, motivoValidacion } } | { id, clear: true }]
 */
export function validationFlagUpdates(records) {
  const updates = [];
  for (const rec of records) {
    if (rec.activo === false) continue;
    const v = validateRecordData(rec);
    if (!v.ok && (!rec.requiereValidacion || rec.motivoValidacion !== v.motivo)) {
      updates.push({ id: rec.id, set: { requiereValidacion: true, motivoValidacion: v.motivo } });
    } else if (v.ok && rec.requiereValidacion) {
      updates.push({ id: rec.id, clear: true });
    }
  }
  return updates;
}

/**
 * Plan de generación para los registros de un lab.
 * records: [{id, equipo, tipo, cantidad, estadoCodigo, codigo, unidadesGeneradas, activo, ...}]
 * decisions: { [id]: 'crear' | 'omitir' }   (respuestas del diálogo uno a uno D11)
 * -> {
 *   jobs: [{ recordId, kind:'ins'|'units', units }],   // listos para splitJobsIntoBatches
 *   needValidation: [{ id, equipo, tipo, cantidad, action, threshold }],
 *   omitted: [id],               // decisión 'omitir' -> pendienteValidar
 *   incongruentes: [{ id, motivo }],
 *   done: [id],                  // ya tenían código / unidades (incluye tipos con unidades y cantidad 0)
 * }
 */
export function planGeneration(records, decisions = {}) {
  const plan = { jobs: [], needValidation: [], omitted: [], incongruentes: [], done: [] };
  for (const rec of records) {
    if (rec.activo === false) continue;
    const v = validateRecordData(rec);
    if (!v.ok) {
      plan.incongruentes.push({ id: rec.id, motivo: v.motivo });
      continue;
    }
    if (!needsGeneration(rec)) {
      plan.done.push(rec.id);
      continue;
    }
    if (!usesUnits(v.prefix)) {
      // INS: un solo código; sólo pregunta (Sí/No) si supera 100
      const q = checkQuantity(rec.tipo, v.cantidad);
      if (q.action !== 'ok') {
        const d = decisions[rec.id];
        if (d === 'omitir') { plan.omitted.push(rec.id); continue; }
        if (d !== 'crear') {
          plan.needValidation.push({ id: rec.id, equipo: rec.equipo, tipo: rec.tipo, cantidad: v.cantidad, action: q.action, threshold: q.threshold });
          continue;
        }
      }
      plan.jobs.push({ recordId: rec.id, kind: 'ins', units: 0 });
      continue;
    }
    const generated = Number(rec.unidadesGeneradas) || 0;
    const remaining = v.cantidad - generated;
    // Si ya hay progreso (reanudación) o cambio de tipo en curso, ya estaba validado
    const q = generated > 0 || rec.cambioTipoEnCurso ? { action: 'ok' } : checkQuantity(rec.tipo, v.cantidad);
    if (q.action !== 'ok') {
      const d = decisions[rec.id];
      if (d === 'omitir') { plan.omitted.push(rec.id); continue; }
      if (d !== 'crear') {
        plan.needValidation.push({ id: rec.id, equipo: rec.equipo, tipo: rec.tipo, cantidad: v.cantidad, action: q.action, threshold: q.threshold });
        continue;
      }
    }
    plan.jobs.push({ recordId: rec.id, kind: 'units', units: remaining });
  }
  return plan;
}

/** Costo en escrituras de una parte de trabajo. */
export function jobCost(part) {
  return part.kind === 'ins' ? 2 : 1 + 2 * part.units; // registro + (unidad + índice codigos) * n
}

/**
 * Parte los trabajos en lotes que caben en una transacción. Un registro con muchas unidades
 * se divide en varias partes (la última lleva final:true).
 * jobs: [{recordId, kind, units}] -> [[{recordId, kind, unitsToCreate, final}]]
 */
export function splitJobsIntoBatches(jobs, maxWrites = MAX_BATCH_WRITES, counterWrites = COUNTER_WRITES_RESERVED) {
  const cap = maxWrites - counterWrites;
  if (cap < 3) throw new Error('maxWrites demasiado pequeño');
  const batches = [];
  let cur = [];
  let used = 0;
  const flush = () => { if (cur.length) batches.push(cur); cur = []; used = 0; };
  for (const job of jobs) {
    if (job.kind === 'ins') {
      if (used + 2 > cap) flush();
      cur.push({ recordId: job.recordId, kind: 'ins', unitsToCreate: 0, final: true });
      used += 2;
      continue;
    }
    let remaining = job.units;
    while (remaining > 0) {
      if (cap - used < 3) flush();
      const k = Math.min(remaining, Math.floor((cap - used - 1) / 2));
      cur.push({ recordId: job.recordId, kind: 'units', unitsToCreate: k, final: remaining - k === 0 });
      used += 1 + 2 * k;
      remaining -= k;
    }
  }
  flush();
  return batches;
}

export { prefixForTipo };

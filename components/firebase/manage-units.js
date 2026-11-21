// Unidades de un registro (MOB/HER/EQU): lectura, edición, subir/bajar cantidad, baja lógica,
// reactivación y marcado de impresión. NUNCA borra documentos.
import { runTransaction, serverTimestamp } from 'firebase/firestore';
import {
  firestore, applyWrites, commitWrites, currentUser, docRef, readRecord, readAllUnits, runGenerationBatch,
} from './codes-shared';
import {
  buildDeactivationWrites, buildReactivationWrites, buildUnitUpdate, buildMarkPrintedWrites,
} from '../../lib/codes/builders';
import { aggregateEstadoCodigo, chunk, splitJobsIntoBatches } from '../../lib/codes/planning';
import { checkQuantity, parseCantidad } from '../../lib/codes/thresholds';
import { usesUnits } from '../../lib/codes/prefixes';

const MAX_UNITS_PER_DEACTIVATION_TX = 200; // 2 escrituras por unidad + registro

/** Unidades de un registro. Por defecto sólo las activas (invitado nunca debe pedir includeInactive). */
export async function readUnits(recordId, { includeInactive = false } = {}) {
  const units = await readAllUnits(recordId);
  const list = includeInactive ? units : units.filter((u) => u.activo !== false);
  return list.sort((a, b) => a.id.localeCompare(b.id));
}

/** Edita serie / Fundaempresa / observaciones / estado de UNA unidad (el código y el tipo no se editan). */
export async function updateUnit(recordId, unitId, fields, { user } = {}) {
  const r = buildUnitUpdate({ recordId, unitId, fields, now: serverTimestamp(), user: currentUser(user) });
  if (!r.ok) return { status: 'error', error: r.error };
  try {
    await commitWrites(r.writes);
    return { status: 'ok' };
  } catch (e) {
    return { status: 'error', error: e?.message ?? String(e) };
  }
}

/**
 * Sube la cantidad. Para MOB/HER/EQU crea las unidades nuevas con código (quedan pendientes de imprimir).
 * Para Suministro sólo cambia el número.
 * -> { status:'ok', created } | { status:'needs-confirmation', action, threshold, cantidad, nuevas } | { status:'error', error }
 * Reanudable: si se interrumpe, volver a llamar con la misma cantidad objetivo
 * (el registro guarda `cantidadObjetivo` mientras hay partes pendientes).
 */
export async function increaseQuantity(recordId, newQuantity, { confirmed = false, user, onProgress } = {}) {
  try {
    const rec = await readRecord(recordId);
    if (!rec) return { status: 'error', error: 'El registro no existe' };
    const target = parseCantidad(newQuantity);
    if (!target.ok) return { status: 'error', error: `Cantidad inválida: ${target.reason}` };
    const current = parseCantidad(rec.cantidad);
    if (!current.ok) return { status: 'error', error: `La cantidad actual del registro es inválida (${current.reason}); corríjala primero` };
    const nuevas = target.value - current.value;
    if (nuevas <= 0) return { status: 'error', error: 'La nueva cantidad debe ser mayor a la actual (para bajar use decreaseQuantity)' };

    const q = checkQuantity(rec.tipo, target.value);
    if (q.action !== 'ok' && !confirmed) {
      return { status: 'needs-confirmation', action: q.action, threshold: q.threshold, cantidad: target.value, nuevas };
    }
    if (!usesUnits(rec.tipo)) {
      await commitWrites([{
        op: 'update', path: `items/${recordId}`,
        data: { cantidad: target.value, ultimaModificacion: serverTimestamp(), ultimaModificacionPor: currentUser(user) },
      }]);
      return { status: 'ok', created: 0 };
    }

    const batches = splitJobsIntoBatches([{ recordId, kind: 'units', units: nuevas }]);
    let created = 0;
    for (let i = 0; i < batches.length; i++) {
      const jobs = batches[i].map((p) => ({ ...p, mode: 'increase', cantidadObjetivo: target.value }));
      const res = await runGenerationBatch(jobs, { user });
      created += res.reduce((s, r) => s + (r.created ?? 0), 0);
      onProgress?.({ done: created, total: nuevas, batchIndex: i + 1, batches: batches.length });
    }
    return { status: 'ok', created };
  } catch (e) {
    return { status: 'error', error: e?.message ?? String(e) };
  }
}

/**
 * Baja lógica de unidades elegidas (nunca borra). `motivo` obligatorio (≥5 caracteres).
 * -> { status:'ok', cantidad } | { status:'error', error }
 */
export async function deactivateUnits(recordId, unitIds, { motivo, user } = {}) {
  try {
    const rec = await readRecord(recordId);
    if (!rec) return { status: 'error', error: 'El registro no existe' };
    const all = await readAllUnits(recordId);
    const byId = new Map(all.map((u) => [u.id, u]));
    const chosen = [];
    for (const id of unitIds) {
      const u = byId.get(id);
      if (!u) return { status: 'error', error: `La unidad ${id} no existe` };
      chosen.push(u);
    }
    // Validación previa de todo el conjunto (no se aplica nada si algo está mal)
    const check = buildDeactivationWrites({
      record: rec, recordId, units: chosen, activeUnits: all.filter((u) => u.activo !== false), motivo, now: null, user: null,
    });
    if (!check.ok) return { status: 'error', error: check.error };

    const deactivated = new Set();
    let cantidad = Number(rec.cantidad) || 0;
    for (const part of chunk(chosen, MAX_UNITS_PER_DEACTIVATION_TX)) {
      cantidad = await runTransaction(firestore, async (tx) => {
        const recSnap = await tx.get(docRef(`items/${recordId}`));
        const fresh = { id: recordId, ...recSnap.data() };
        const live = [];
        for (const u of part) {
          const s = await tx.get(docRef(`items/${recordId}/unidades/${u.id}`));
          if (s.exists() && s.data().activo !== false) live.push({ id: u.id, ...s.data() });
        }
        if (!live.length) return Number(fresh.cantidad) || 0; // ya aplicado (reintento)
        const activeNow = all.filter((u) => u.activo !== false && !deactivated.has(u.id));
        const built = buildDeactivationWrites({
          record: fresh, recordId, units: live, activeUnits: activeNow, motivo, now: serverTimestamp(), user: currentUser(user),
        });
        if (!built.ok) throw new Error(built.error);
        applyWrites(tx, built.writes);
        return built.newCantidad;
      });
      part.forEach((u) => deactivated.add(u.id));
    }
    return { status: 'ok', cantidad };
  } catch (e) {
    return { status: 'error', error: e?.message ?? String(e) };
  }
}

/**
 * Baja de cantidad en MOB/HER/EQU: el admin DEBE elegir exactamente cuáles unidades se dan de baja
 * (nunca una baja silenciosa de "las últimas").
 */
export async function decreaseQuantity(recordId, newQuantity, unitIds, { motivo, user } = {}) {
  const rec = await readRecord(recordId);
  if (!rec) return { status: 'error', error: 'El registro no existe' };
  const target = parseCantidad(newQuantity);
  const current = parseCantidad(rec.cantidad);
  if (!target.ok || !current.ok) return { status: 'error', error: 'Cantidad inválida' };
  if (!usesUnits(rec.tipo)) {
    if (target.value >= current.value) return { status: 'error', error: 'La nueva cantidad debe ser menor a la actual' };
    await commitWrites([{
      op: 'update', path: `items/${recordId}`,
      data: { cantidad: target.value, ultimaModificacion: serverTimestamp(), ultimaModificacionPor: currentUser(user) },
    }]);
    return { status: 'ok', cantidad: target.value };
  }
  const expected = current.value - target.value;
  if (expected <= 0) return { status: 'error', error: 'La nueva cantidad debe ser menor a la actual' };
  if (!Array.isArray(unitIds) || unitIds.length !== expected) {
    return { status: 'error', error: `Debe seleccionar exactamente ${expected} unidad(es) para dar de baja` };
  }
  return deactivateUnits(recordId, unitIds, { motivo, user });
}

/** Reactiva una unidad dada de baja (acción explícita de admin). */
export async function reactivateUnit(recordId, unitId, { user } = {}) {
  try {
    const rec = await readRecord(recordId);
    if (!rec) return { status: 'error', error: 'El registro no existe' };
    const all = await readAllUnits(recordId);
    const unit = all.find((u) => u.id === unitId);
    if (!unit) return { status: 'error', error: 'La unidad no existe' };
    const built = buildReactivationWrites({
      record: rec, recordId, unit, activeUnits: all.filter((u) => u.activo !== false), now: serverTimestamp(), user: currentUser(user),
    });
    if (!built.ok) return { status: 'error', error: built.error };
    await commitWrites(built.writes);
    return { status: 'ok', cantidad: built.newCantidad };
  } catch (e) {
    return { status: 'error', error: e?.message ?? String(e) };
  }
}

/**
 * Marca como impresas unidades/registros SOLO cuando el admin confirmó que salieron bien.
 * targets: [{ recordId, unidadId? }]  (sin unidadId = registro INS)
 * Después recalcula el estadoCodigo agregado de cada registro con unidades.
 */
export async function markPrinted(targets) {
  try {
    await commitWrites(buildMarkPrintedWrites({ targets, now: serverTimestamp() }));
    const recordIds = [...new Set(targets.filter((t) => t.unidadId).map((t) => t.recordId))];
    for (const id of recordIds) await recalcRecordEstadoCodigo(id);
    return { status: 'ok', marked: targets.length };
  } catch (e) {
    return { status: 'error', error: e?.message ?? String(e) };
  }
}

/** Recalcula y guarda el estadoCodigo agregado de un registro con unidades. */
export async function recalcRecordEstadoCodigo(recordId) {
  const units = await readAllUnits(recordId);
  const estado = aggregateEstadoCodigo(units);
  await commitWrites([{ op: 'update', path: `items/${recordId}`, data: { estadoCodigo: estado } }]);
  return estado;
}

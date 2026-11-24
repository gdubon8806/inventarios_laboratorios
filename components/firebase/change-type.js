// Cambio de tipo de un registro (§4.3). Proceso explícito, NO un simple update de `tipo`.
// - Genera códigos nuevos con el prefijo nuevo, guarda `codigoAnterior`, redirige los códigos viejos
//   (`codigos/{viejo}.reemplazado`) y deja `estadoCodigo:'pendienteImprimir'` (tarjeta roja hasta imprimir).
// - Por lotes y reanudable: si se interrumpe, volver a llamar con los mismos parámetros.
import { runTransaction, serverTimestamp } from 'firebase/firestore';
import {
  firestore, applyWrites, currentUser, docRef, readRecord, readAllUnits, runGenerationBatch,
} from './codes-shared';
import {
  planTypeChange, buildInsToUnitsPhase1, buildUnitsToUnitsChunk, buildUnitsToInsChunk, unitsPendingTypeChange,
} from '../../lib/codes/builders';
import { chunk, splitJobsIntoBatches, MAX_UNITS_PER_TYPE_CHANGE_CHUNK } from '../../lib/codes/planning';
import { checkQuantity } from '../../lib/codes/thresholds';
import { prefixForTipo } from '../../lib/codes/prefixes';

const MAX_UNITS_PER_INS_CHUNK = 200; // 2 escrituras por unidad + registro + índice + contador

/** Análisis previo para la UI (qué pasaría, bloqueos, umbrales). No escribe nada. */
export async function previewTypeChange(recordId, newTipo) {
  const rec = await readRecord(recordId);
  if (!rec) return { ok: false, code: 'no-existe', error: 'El registro no existe' };
  const units = (await readAllUnits(recordId)).filter((u) => u.activo !== false);
  const plan = planTypeChange({ record: rec, activeUnits: units, newTipo });
  if (!plan.ok) return plan;
  const q = plan.kind === 'ins-to-units' ? checkQuantity(newTipo, plan.cantidad) : { action: 'ok' };
  return {
    ...plan,
    tipoActual: rec.tipo,
    codigoActual: rec.codigo ?? null,
    etiquetasAReimprimir: plan.kind === 'units-to-ins' ? 1 : plan.kind === 'ins-to-units' ? plan.cantidad : plan.unidades,
    requiereConfirmacionUmbral: q.action !== 'ok' ? q : null,
    advertencia: plan.kind === 'units-to-ins' ? 'Destructivo: las unidades pasan a baja y se pierden sus datos por unidad. Exporte un respaldo antes.' : null,
  };
}

/**
 * Ejecuta el cambio de tipo.
 * opts: { confirm:true (OBLIGATORIO; la UI lo envía tras escribir "CAMBIAR"), override?:boolean (permitir unidades->INS
 *         con series cargadas), confirmedThreshold?:boolean (D11 para INS->unidades grandes), user, onProgress }
 * -> { status:'ok', kind, from, to } | { status:'needs-confirmation', ... } | { status:'error', code?, error }
 */
export async function changeType(recordId, newTipo, opts = {}) {
  const { confirm = false, override = false, confirmedThreshold = false, user, onProgress } = opts;
  try {
    if (confirm !== true) return { status: 'error', code: 'sin-confirmacion', error: 'Falta la confirmación explícita del admin' };
    const rec = await readRecord(recordId);
    if (!rec) return { status: 'error', code: 'no-existe', error: 'El registro no existe' };
    const units = (await readAllUnits(recordId)).filter((u) => u.activo !== false);
    const plan = planTypeChange({ record: rec, activeUnits: units, newTipo, override });

    // Reanudación: un cambio interrumpido deja el tipo ya cambiado + cambioTipoEnCurso
    if (!plan.ok && plan.code === 'mismo-tipo' && rec.cambioTipoEnCurso) {
      return resume(recordId, rec, newTipo, { user, onProgress });
    }
    if (!plan.ok) return { status: 'error', ...plan };

    const u = currentUser(user);
    if (plan.kind === 'ins-to-units') {
      const q = checkQuantity(newTipo, plan.cantidad);
      if (q.action !== 'ok' && !confirmedThreshold) {
        return { status: 'needs-confirmation', action: q.action, threshold: q.threshold, cantidad: plan.cantidad };
      }
      await runTransaction(firestore, async (tx) => {
        const snap = await tx.get(docRef(`items/${recordId}`));
        const fresh = { id: recordId, ...snap.data() };
        if (prefixForTipo(fresh.tipo) !== plan.from) throw new Error('El tipo del registro cambió mientras tanto; reintente');
        applyWrites(tx, buildInsToUnitsPhase1({ record: fresh, recordId, newTipo, now: serverTimestamp(), user: u }).writes);
      });
      return resume(recordId, { ...rec, tipo: newTipo, cambioTipoEnCurso: true }, newTipo, { user, onProgress, kind: plan.kind, from: plan.from, to: plan.to });
    }

    if (plan.kind === 'units-to-units') {
      await runUnitsToUnits(recordId, newTipo, plan.to, { user: u, onProgress });
      return { status: 'ok', kind: plan.kind, from: plan.from, to: plan.to };
    }

    await runUnitsToIns(recordId, { user: u, onProgress });
    return { status: 'ok', kind: plan.kind, from: plan.from, to: plan.to };
  } catch (e) {
    return { status: 'error', error: e?.message ?? String(e) };
  }
}

async function resume(recordId, rec, newTipo, { user, onProgress, kind = 'resume', from = null, to = null } = {}) {
  const to2 = prefixForTipo(newTipo);
  if (!to2) return { status: 'error', error: 'Tipo nuevo no reconocido' };
  const u = currentUser(user);
  if (to2 !== 'INS' && prefixForTipo(rec.tipo) === to2) {
    const fresh = (await readRecord(recordId)) ?? rec;
    const units = (await readAllUnits(recordId)).filter((x) => x.activo !== false);
    const cantidad = Number(fresh.cantidad) || 0;
    // INS -> unidades: faltan unidades por crear (reanudable por unidadesGeneradas)
    if ((Number(fresh.unidadesGeneradas) || 0) < cantidad) {
      const batches = splitJobsIntoBatches([{ recordId, kind: 'units', units: cantidad - (Number(fresh.unidadesGeneradas) || 0) }]);
      let done = 0;
      for (let i = 0; i < batches.length; i++) {
        const res = await runGenerationBatch(batches[i], { user: u });
        done += res.reduce((s, r) => s + (r.created ?? 0), 0);
        onProgress?.({ done, total: cantidad, batchIndex: i + 1, batches: batches.length });
      }
    } else if (unitsPendingTypeChange(units, newTipo).length) {
      // unidades -> unidades interrumpido a medias
      await runUnitsToUnits(recordId, newTipo, to2, { user: u, onProgress });
    }
  } else if (to2 === 'INS') {
    await runUnitsToIns(recordId, { user: u, onProgress });
  }
  return { status: 'ok', kind, from, to };
}

async function runUnitsToUnits(recordId, newTipo, to, { user, onProgress }) {
  const all = (await readAllUnits(recordId)).filter((u) => u.activo !== false);
  const pending = unitsPendingTypeChange(all, newTipo);
  const parts = pending.length ? chunk(pending, MAX_UNITS_PER_TYPE_CHANGE_CHUNK) : [[]];
  let done = 0;
  for (let i = 0; i < parts.length; i++) {
    const isLastPart = i === parts.length - 1;
    await runTransaction(firestore, async (tx) => {
      const recSnap = await tx.get(docRef(`items/${recordId}`));
      const fresh = { id: recordId, ...recSnap.data() };
      const counterSnap = await tx.get(docRef(`counters/${to}`));
      const counters = { [to]: counterSnap.exists() ? Number(counterSnap.data().next) || 1 : 1 };
      const live = [];
      for (const u of parts[i]) {
        const s = await tx.get(docRef(`items/${recordId}/unidades/${u.id}`));
        if (s.exists()) {
          const d = { id: u.id, ...s.data() };
          // sólo unidades activas que todavía no migraron al tipo nuevo (idempotente en reintentos)
          if (unitsPendingTypeChange([d], newTipo).length) live.push(d);
        }
      }
      const { writes } = buildUnitsToUnitsChunk({
        record: fresh, recordId, units: live, newTipo, counters,
        isFirst: i === 0 && prefixForTipo(fresh.tipo) !== to, // en una reanudación el registro ya tiene el tipo nuevo
        isLast: isLastPart, now: serverTimestamp(), user,
      });
      applyWrites(tx, writes);
    });
    done += parts[i].length;
    onProgress?.({ done, total: pending.length, batchIndex: i + 1, batches: parts.length });
  }
}

async function runUnitsToIns(recordId, { user, onProgress }) {
  const all = (await readAllUnits(recordId)).filter((u) => u.activo !== false);
  const parts = all.length ? chunk(all, MAX_UNITS_PER_INS_CHUNK) : [[]];
  let done = 0;
  for (let i = 0; i < parts.length; i++) {
    const isLastPart = i === parts.length - 1;
    await runTransaction(firestore, async (tx) => {
      const recSnap = await tx.get(docRef(`items/${recordId}`));
      const fresh = { id: recordId, ...recSnap.data() };
      let counters = {};
      if (isLastPart) {
        const c = await tx.get(docRef('counters/INS'));
        counters = { INS: c.exists() ? Number(c.data().next) || 1 : 1 };
      }
      const live = [];
      for (const u of parts[i]) {
        const s = await tx.get(docRef(`items/${recordId}/unidades/${u.id}`));
        if (s.exists() && s.data().activo !== false) live.push({ id: u.id, ...s.data() });
      }
      const { writes } = buildUnitsToInsChunk({
        record: fresh, recordId, units: live, counters, isFirst: i === 0, isLast: isLastPart, now: serverTimestamp(), user,
      });
      applyWrites(tx, writes);
    });
    done += parts[i].length;
    onProgress?.({ done, total: all.length, batchIndex: i + 1, batches: parts.length });
  }
}

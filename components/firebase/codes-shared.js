// Capa fina compartida entre los módulos de códigos/unidades: aplica las escrituras que
// construyen las funciones puras de lib/codes/builders.js y ejecuta lotes de generación.
import {
  doc, collection, getDoc, getDocs, runTransaction, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { firestore, auth } from '../../firebaseConfig';
import { buildGenerationWrites } from '../../lib/codes/builders';
import { prefixForTipo } from '../../lib/codes/prefixes';
import { chunk, MAX_BATCH_WRITES } from '../../lib/codes/planning';

export { firestore };

export function currentUser(override) {
  // Siempre un objeto plano {uid, email}: Firestore rechaza el objeto User de Firebase (clase propia)
  // con "Unsupported field value: a custom object" al guardarlo en ultimaModificacionPor/bajaPor.
  const u = override || auth?.currentUser;
  return u ? { uid: u.uid, email: u.email ?? null } : null;
}

export function docRef(path) {
  return doc(firestore, ...path.split('/'));
}

/**
 * Aplica escrituras {op:'set'|'update', path, data} a una transacción o a un writeBatch.
 * Los `update` sobre `codigos/*` usan set+merge por si el índice no existe (datos legados).
 */
export function applyWrites(target, writes) {
  for (const w of writes) {
    const ref = docRef(w.path);
    if (w.op === 'set') target.set(ref, w.data);
    else if (w.path.startsWith('codigos/')) target.set(ref, w.data, { merge: true });
    else target.update(ref, w.data);
  }
}

/** Escribe una lista de escrituras con writeBatch en trozos de ≤450. */
export async function commitWrites(writes) {
  for (const part of chunk(writes, MAX_BATCH_WRITES)) {
    const batch = writeBatch(firestore);
    applyWrites(batch, part);
    await batch.commit();
  }
}

export async function readRecord(recordId) {
  const snap = await getDoc(doc(firestore, 'items', recordId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function readAllUnits(recordId) {
  const snap = await getDocs(collection(firestore, 'items', recordId, 'unidades'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Ejecuta UN lote de generación dentro de una transacción (lee registros y contadores frescos,
 * así que es idempotente y seguro con dos admins a la vez).
 * batch: [{recordId, kind, unitsToCreate, final, mode?, cantidadObjetivo?}]
 * `extraRecordData`: { [id]: datos } para registros que se crean EN esta misma transacción
 * (createRecordWithCode): se fusionan con el update que genera el constructor y se escriben con set.
 */
export async function runGenerationBatch(batch, { user, newRecords = {} } = {}) {
  return runTransaction(firestore, async (tx) => {
    const records = {};
    for (const id of [...new Set(batch.map((j) => j.recordId))]) {
      if (newRecords[id]) { records[id] = { id, ...newRecords[id] }; continue; }
      const snap = await tx.get(doc(firestore, 'items', id));
      if (snap.exists()) records[id] = { id, ...snap.data() };
    }
    const prefixes = [...new Set(Object.values(records).map((r) => prefixForTipo(r.tipo)).filter(Boolean))];
    const counters = {};
    for (const p of prefixes) {
      const snap = await tx.get(doc(firestore, 'counters', p));
      counters[p] = snap.exists() ? Number(snap.data().next) || 1 : 1;
    }
    const { writes, results } = buildGenerationWrites({ jobs: batch, records, counters, now: serverTimestamp(), user: currentUser(user) });
    // Registros nuevos: convertir el update en set (el documento aún no existe)
    const finalWrites = writes.map((w) => {
      const m = /^items\/([^/]+)$/.exec(w.path);
      if (m && newRecords[m[1]] && w.op === 'update') return { op: 'set', path: w.path, data: { ...newRecords[m[1]], ...w.data } };
      return w;
    });
    applyWrites(tx, finalWrites);
    return results;
  });
}

import { doc, getDocs, collection, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig';
import { currentUserRef, opError } from './audit';
import updateItem from './update-item';
import { updateUnit } from './manage-units';
import { ESTADOS } from '../../lib/codes/prefixes';

const MIN_SOLUCION = 3;

// Recalcula `unidadesReportadas` del registro (unidades distintas con reporte abierto; 1 si hay reportes sin unidad).
// SOLO admin (escribe en `items`). Devuelve el número calculado.
export async function syncReportedCount(registroId) {
  const snap = await getDocs(query(collection(firestore, 'reportes'), where('registroId', '==', registroId)));
  const abiertos = snap.docs.map((d) => d.data()).filter((r) => r.estadoReporte !== 'resuelto');
  const ids = new Set(abiertos.filter((r) => r.unidadId).map((r) => r.unidadId));
  const n = ids.size + (abiertos.some((r) => !r.unidadId) ? 1 : 0);
  await updateDoc(doc(firestore, 'items', registroId), { unidadesReportadas: n });
  return n;
}

// Resuelve un reporte (SOLO admin). La solución se guarda en reportes/{id}/privado/solucion (el invitado no la lee).
// nuevoEstado: 'bueno' | 'malo' | 'reparacion' -> se aplica a la unidad reportada (o al registro si es un insumo).
export async function resolveReport(report, { solucion, nuevoEstado, user = null }) {
  const texto = String(solucion ?? '').trim();
  if (texto.length < MIN_SOLUCION) throw new Error('Describe la solución del reporte.');
  if (!ESTADOS.includes(nuevoEstado)) throw new Error('Elige el nuevo estado: bueno, malo o reparación.');
  const por = user ? { uid: user.uid, email: user.email ?? null } : currentUserRef();
  try {
    const ref = doc(firestore, 'reportes', report.id);
    await setDoc(doc(ref, 'privado', 'solucion'), { solucion: texto, nuevoEstado, resueltoPor: por, fecha: serverTimestamp() });
    await updateDoc(ref, { estadoReporte: 'resuelto', resueltoPor: por, fechaResolucion: serverTimestamp() });

    if (report.unidadId) {
      const r = await updateUnit(report.registroId, report.unidadId, { estado: nuevoEstado }, { user: por });
      if (r.status === 'error') throw new Error(r.error);
    } else {
      await updateItem(report.registroId, { estado: nuevoEstado });
    }
    return await syncReportedCount(report.registroId);
  } catch (error) {
    throw opError('No se pudo resolver el reporte', error);
  }
}

// Al dar de baja unidades, sus reportes abiertos se resuelven automáticamente ("Baja: <motivo>") para no inflar el contador.
// No cambia el estado de la unidad. SOLO admin. Devuelve cuántos reportes cerró.
export async function resolveReportsForUnits(registroId, unitIds, motivo, user = null) {
  const por = user ? { uid: user.uid, email: user.email ?? null } : currentUserRef();
  const ids = new Set(unitIds);
  try {
    const snap = await getDocs(query(collection(firestore, 'reportes'), where('registroId', '==', registroId)));
    const afectados = snap.docs.filter((d) => {
      const r = d.data();
      return r.estadoReporte !== 'resuelto' && r.unidadId && ids.has(r.unidadId);
    });
    for (const d of afectados) {
      await setDoc(doc(d.ref, 'privado', 'solucion'), { solucion: `Baja: ${motivo}`, nuevoEstado: null, resueltoPor: por, fecha: serverTimestamp() });
      await updateDoc(d.ref, { estadoReporte: 'resuelto', resueltoPor: por, fechaResolucion: serverTimestamp() });
    }
    await syncReportedCount(registroId);
    return afectados.length;
  } catch (error) {
    throw opError('No se pudieron cerrar los reportes de las unidades dadas de baja', error);
  }
}

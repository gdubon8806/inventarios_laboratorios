import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig';

const mapDocs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

// Reportes de un laboratorio. Por defecto SOLO los abiertos (filtro en cliente: una consulta por un solo campo,
// sin índice compuesto). Ante un error registra y devuelve [] (la pantalla del lab no se rompe).
export async function readReportsByLab(idLab, { soloAbiertos = true } = {}) {
  if (!idLab) return [];
  try {
    const snap = await getDocs(query(collection(firestore, 'reportes'), where('idLab', '==', idLab)));
    const all = mapDocs(snap);
    return soloAbiertos ? all.filter((r) => r.estadoReporte !== 'resuelto') : all;
  } catch (error) {
    console.error('Error al leer los reportes del laboratorio:', error);
    return [];
  }
}

// Reportes de un registro (abiertos y resueltos), del más reciente al más antiguo.
// Se usa para que el admin revise el detalle; propaga el error (la UI lo muestra).
export async function readReportsByRecord(registroId, { soloAbiertos = false } = {}) {
  const snap = await getDocs(query(collection(firestore, 'reportes'), where('registroId', '==', registroId)));
  const all = mapDocs(snap).sort((a, b) => (b.fecha?.seconds ?? 0) - (a.fecha?.seconds ?? 0));
  return soloAbiertos ? all.filter((r) => r.estadoReporte !== 'resuelto') : all;
}

// Solución de un reporte (SOLO admin: la regla de Firestore niega la lectura al invitado). null si no hay.
export async function readSolucion(reportId) {
  const snap = await getDoc(doc(firestore, 'reportes', reportId, 'privado', 'solucion'));
  return snap.exists() ? snap.data() : null;
}

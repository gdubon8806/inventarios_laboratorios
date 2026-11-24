import { collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig';

// Ítems de un laboratorio. Por defecto SOLO activos (filtro en cliente `activo !== false`, así los
// documentos viejos sin el campo siguen apareciendo). Con { soloInactivos: true } devuelve los dados de baja.
// Ante un error de lectura registra el error y devuelve [] (la pantalla no se rompe).
export default async function readItem(labId, { soloInactivos = false } = {}) {
  try {
    const itemsRef = collection(firestore, 'items');
    const q = query(itemsRef, where('idLab', '==', labId));
    const querySnapshot = await getDocs(q);
    const items = [];
    querySnapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });
    return items.filter((i) => (soloInactivos ? i.activo === false : i.activo !== false));
  } catch (error) {
    console.error('Error al obtener ítems por ID de laboratorio: ', error);
    return []; // Devuelve una matriz vacía en caso de error
  }
}

// Todos los ítems en la papelera (de cualquier laboratorio). Consulta por campo único: sin índice extra.
// A diferencia de readItem, aquí un error de lectura SE PROPAGA (la papelera no debe mostrarse vacía por error).
export async function readItemsInactivos() {
  const snap = await getDocs(query(collection(firestore, 'items'), where('activo', '==', false)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

import { collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig';

// Función para obtener los ítems de un laboratorio específico en Firestore
export default async function readItem(labId) {
  try {
    const itemsRef = collection(firestore, 'items');
    const q = query(itemsRef, where('idLab', '==', labId));
    const querySnapshot = await getDocs(q);
    const items = [];
    querySnapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });
    return items;
  } catch (error) {
    console.error('Error al obtener ítems por ID de laboratorio: ', error);
    return []; // Devuelve una matriz vacía en caso de error
  }
}

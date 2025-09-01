import { doc, updateDoc } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig';

// Función para actualizar un laboratorio en Firestore
export default async function updateLab(labId, newData) {
  try {
    const labRef = doc(firestore, 'laboratorios', labId);
    await updateDoc(labRef, newData);
    return true; // Devuelve true si la actualización se realizó con éxito
  } catch (error) {
    return false; // Devuelve false si hubo un error al actualizar
  }
}

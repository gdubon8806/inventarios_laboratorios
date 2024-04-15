import { doc, deleteDoc } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig';

// Función para eliminar un laboratorio de Firestore
export default async function deleteLab(labId) {
  try {
    const labRef = doc(firestore, 'laboratorios', labId);
    await deleteDoc(labRef);
    // console.log('Laboratorio eliminado con éxito.');
    return true; // Devuelve true si la eliminación se realizó con éxito
  } catch (error) {
    console.error('Error al eliminar laboratorio: ', error);
    return false; // Devuelve false si hubo un error al eliminar
  }
}

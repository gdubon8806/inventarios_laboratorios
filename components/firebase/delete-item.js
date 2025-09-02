import { doc, deleteDoc } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig';

// Función para eliminar un ítem de Firestore
export default async function deleteItem(itemId) {
  try {
    const itemRef = doc(firestore, 'items', itemId);
    await deleteDoc(itemRef);
    return true; // Devuelve true si la eliminación se realizó con éxito
  } catch (error) {
    return false; // Devuelve false si hubo un error al eliminar el ítem
  }
}

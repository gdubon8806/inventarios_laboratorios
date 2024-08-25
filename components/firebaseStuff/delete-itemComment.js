import { doc, deleteDoc } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig';

// Función para eliminar un ítem de Firestore
export default async function deleteItemComment(itemId) {
  try {
    const itemRef = doc(firestore, 'itemComentarios', itemId);
    await deleteDoc(itemRef);
    console.log('Comentario eliminado con éxito.');
    return true; // Devuelve true si la eliminación se realizó con éxito
  } catch (error) {
    console.error('Error al eliminar comentario: ', error);
    return false; // Devuelve false si hubo un error al eliminar el ítem
  }
}

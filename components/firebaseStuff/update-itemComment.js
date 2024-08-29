import { doc, updateDoc } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig';

// Función para actualizar un laboratorio en Firestore
export default async function updateItemComment(itemId, newData) {
  try {
    const itemCommentRef = doc(firestore, 'itemComentarios', itemId);
    await updateDoc(itemCommentRef, newData);
    return true; // Devuelve true si la actualización se realizó con éxito
  } catch (error) {
    return false; // Devuelve false si hubo un error al actualizar
  }
}

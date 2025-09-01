import { ref, deleteObject } from 'firebase/storage';
import { storage } from '../../firebaseConfig';

// Función para eliminar una imagen de Firebase Storage
export default async function deleteImage(imagePath) {
  try {
    const imageRef = ref(storage, imagePath);
    await deleteObject(imageRef);
    return true; // Devuelve true si la eliminación se realizó con éxito
  } catch (error) {
    return false; // Devuelve false si hubo un error al eliminar
  }
}

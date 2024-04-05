import { ref, deleteObject } from 'firebase/storage';
import { storage } from '../../firebaseConfig'; // Asegúrate de importar la instancia de Storage desde tu archivo de configuración de Firebase

// Función para eliminar una imagen de Firebase Storage
export default async function deleteImage(imagePath) {
  try {
    const imageRef = ref(storage, imagePath);
    await deleteObject(imageRef);
    console.log('Imagen eliminada con éxito.');
    return true; // Devuelve true si la eliminación se realizó con éxito
  } catch (error) {
    console.error('Error al eliminar imagen: ', error);
    return false; // Devuelve false si hubo un error al eliminar
  }
}

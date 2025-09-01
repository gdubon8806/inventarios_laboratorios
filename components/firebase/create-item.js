import { collection, addDoc } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig'; // Asegúrate de importar la instancia de Firestore desde tu archivo de configuración de Firebase

// Función para agregar un nuevo ítem a Firestore
export default async function createItem(itemData) {
  try {
    const itemsRef = collection(firestore, 'items');
    await addDoc(itemsRef, itemData);
    console.log('Ítem agregado con éxito.');
    return true; // Devuelve true si la creación se realizó con éxito
  } catch (error) {
    console.error('Error al agregar ítem: ', error);
    return false; // Devuelve false si hubo un error al crear el ítem
  }
}

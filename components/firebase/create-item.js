import { collection, addDoc } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig';

// Función para agregar un nuevo ítem a Firestore
export default async function createItem(itemData) {
  try {
    const itemsRef = collection(firestore, 'items');
    const response = await addDoc(itemsRef, itemData);
    return response.id; // Devuelve true si la creación se realizó con éxito
  } catch (error) {
    return false; // Devuelve false si hubo un error al crear el ítem
  }
}

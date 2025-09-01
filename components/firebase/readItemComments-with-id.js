import { collection, query, where, getDocs, orderBy} from 'firebase/firestore';
import { firestore } from '../../firebaseConfig';

// Función para obtener un comentario por su item ID desde Firestore
export default async function readItemCommentsById(itemId) {
    try {
      const itemsRef = collection(firestore, 'itemComentarios');
      const q = query(itemsRef, where('idItem', '==', itemId));
      const querySnapshot = await getDocs(q);
      const items = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      return items;
    } catch (error) {
      console.error('Error al obtener comentarios por ID de item: ', error);
      return []; // Devuelve una matriz vacía en caso de error
    }
  }
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig'; // Aquí importa la instancia de Firestore desde tu archivo de configuración de Firebase

// Función para agregar un nuevo laboratorio a Firestore
export default async function createItemComment(title, description, idItem) {
    try {
        const itemComentariosRef = collection(firestore, 'itemComentarios');
        const nuevoComentario = {
            title: title,
            description: description,
            idItem: idItem,
            time: Timestamp.now()
        };
        const docRef = await addDoc(itemComentariosRef, nuevoComentario);
        // console.log('Comentario agregado con ID: ', docRef.id);
    } catch (error) {
        console.error('Error al agregar comentario: ', error);
    }
};

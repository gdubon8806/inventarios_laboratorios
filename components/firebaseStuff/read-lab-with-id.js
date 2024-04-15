import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig';

// Función para obtener un laboratorio por su ID desde Firestore
export default async function readLabById(id) {
    try {
        const labRef = doc(firestore, 'laboratorios', id);
        const labDoc = await getDoc(labRef);

        if (labDoc.exists()) {
            // El laboratorio existe, devolver sus datos
            return {
                id: labDoc.id,
                ...labDoc.data()
            };
        } else {
            // El laboratorio no existe
            console.error('No se encontró el laboratorio con el ID especificado.');
            return null; // O puedes lanzar un error si lo prefieres
        }
    } catch (error) {
        console.error('Error al leer laboratorio por ID: ', error);
        throw error; // Lanza el error para que el llamador pueda manejarlo
    }
}

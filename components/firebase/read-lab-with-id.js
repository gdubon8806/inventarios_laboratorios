import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig';

// Obtiene un laboratorio por su ID.
// Devuelve null si no existe o si está dado de baja (salvo { incluirInactivos: true }).
// Lanza el error si la lectura falla, para que el llamador lo maneje.
export default async function readLabById(id, { incluirInactivos = false } = {}) {
    if (!id) return null;
    try {
        const labRef = doc(firestore, 'laboratorios', id);
        const labDoc = await getDoc(labRef);

        if (!labDoc.exists()) {
            console.error('No se encontró el laboratorio con el ID especificado.');
            return null;
        }
        const data = { id: labDoc.id, ...labDoc.data() };
        if (data.activo === false && !incluirInactivos) return null;
        return data;
    } catch (error) {
        console.error('Error al leer laboratorio por ID: ', error);
        throw error;
    }
}

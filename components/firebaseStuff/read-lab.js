import { collection, getDocs } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig'; // Aquí importa la instancia de Firestore desde tu archivo de configuración de Firebase

// Función para agregar un nuevo laboratorio a Firestore
export default async function readLab() {
    try {
        const laboratoriosRef = collection(firestore, 'laboratorios');
        const laboratoriosSnapshot = await getDocs(laboratoriosRef);
        const laboratoriosData = laboratoriosSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        return laboratoriosData;
    } catch (error) {
        console.error('Error al leer laboratorio: ', error);
    }
};










import { collection, addDoc } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig'; // Aquí importa la instancia de Firestore desde tu archivo de configuración de Firebase

// Función para agregar un nuevo laboratorio a Firestore
export default async function createLab(name, description, imgurl, imgname) {
    try {
        const laboratoriosRef = collection(firestore, 'laboratorios');
        const nuevoLaboratorio = {
            name: name,
            description: description,
            imgurl: imgurl,
            imgname: imgname
        };
        const docRef = await addDoc(laboratoriosRef, nuevoLaboratorio);
        console.log('Laboratorio agregado con ID: ', docRef.id);
    } catch (error) {
        console.error('Error al agregar laboratorio: ', error);
    }
};

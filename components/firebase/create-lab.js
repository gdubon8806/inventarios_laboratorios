import { collection, addDoc } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig'; // Aquí importa la instancia de Firestore desde tu archivo de configuración de Firebase
import { auditFields } from './audit';

// Función para agregar un nuevo laboratorio a Firestore.
// `ubicacion` es opcional (campo nuevo del plan V2). Los laboratorios NO llevan código de barras.
// Devuelve el id del documento, o false si falló (los llamadores comprueban `=== false`).
// `imgEnfoque` (opcional): zona de la foto que se ve en la tarjeta (la foto se guarda completa).
export default async function createLab(name, description, imgurl, imgname, ubicacion = '', imgEnfoque = null) {
    try {
        const laboratoriosRef = collection(firestore, 'laboratorios');
        const nuevoLaboratorio = {
            name: name,
            description: description,
            imgurl: imgurl,
            imgname: imgname,
            imgEnfoque: imgurl ? imgEnfoque : null,
            ubicacion: (ubicacion || '').trim(),
            activo: true,
            ...auditFields(),
        };
        const response = await addDoc(laboratoriosRef, nuevoLaboratorio);
        return response.id;
    } catch (error) {
        console.error('Error al agregar laboratorio: ', error);
        return false;
    }
};

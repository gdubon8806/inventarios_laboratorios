import { collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig';

// Laboratorios ACTIVOS (filtro en cliente `activo !== false`: los documentos viejos sin el campo cuentan como activos).
// Ante un error registra el error y devuelve [] (antes devolvía undefined y rompía `laboratories.length`).
export default async function readLab() {
    try {
        const laboratoriosRef = collection(firestore, 'laboratorios');
        const laboratoriosSnapshot = await getDocs(laboratoriosRef);
        return laboratoriosSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(lab => lab.activo !== false);
    } catch (error) {
        console.error('Error al leer laboratorio: ', error);
        return [];
    }
};

// Todos los laboratorios, activos o no (para resolver nombres en la papelera). Propaga errores.
export async function readAllLabs() {
    const snap = await getDocs(collection(firestore, 'laboratorios'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Laboratorios en la papelera. Consulta por campo único: sin índice extra. Propaga errores.
export async function readLabsInactivos() {
    const snap = await getDocs(query(collection(firestore, 'laboratorios'), where('activo', '==', false)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

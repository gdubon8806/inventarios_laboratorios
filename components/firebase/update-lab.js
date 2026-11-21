import { doc, updateDoc } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig';
import { auditFields } from './audit';

// Función para actualizar un laboratorio en Firestore (estampa ultimaModificacion).
// Devuelve true si se actualizó y false si falló (los llamadores comprueban el booleano).
export default async function updateLab(labId, newData) {
  try {
    const labRef = doc(firestore, 'laboratorios', labId);
    await updateDoc(labRef, { ...newData, ...auditFields() });
    return true; // Devuelve true si la actualización se realizó con éxito
  } catch (error) {
    console.error('Error al actualizar laboratorio: ', error);
    return false; // Devuelve false si hubo un error al actualizar
  }
}

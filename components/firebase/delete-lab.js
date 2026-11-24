import {
  collection, doc, getDoc, getDocs, query, where, updateDoc, deleteDoc, deleteField, serverTimestamp,
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { firestore, storage } from '../../firebaseConfig';
import { currentUserRef, opError } from './audit';
import { imagenCompartida } from './delete-item';

const MOTIVO_MIN = 5;
const MOTIVO_POR_DEFECTO = 'Sin motivo indicado';

// BAJA LÓGICA de un laboratorio (sin cascada: sus ítems siguen activos pero quedan ocultos
// porque el laboratorio ya no se lista; al restaurar el laboratorio todo vuelve).
// motivo: opcional por compatibilidad con llamadores antiguos; la UI nueva debe pedirlo (mín. 5 caracteres).
export async function deactivateLab(labId, motivo) {
  const texto = typeof motivo === 'string' ? motivo.trim() : '';
  if (texto && texto.length < MOTIVO_MIN) {
    throw new Error(`El motivo de la baja debe tener al menos ${MOTIVO_MIN} caracteres.`);
  }
  try {
    await updateDoc(doc(firestore, 'laboratorios', labId), {
      activo: false,
      fechaBaja: serverTimestamp(),
      motivoBaja: texto || MOTIVO_POR_DEFECTO,
      bajaPor: currentUserRef(),
    });
    return true;
  } catch (error) {
    throw opError('No se pudo dar de baja el laboratorio', error);
  }
}

export async function restoreLab(labId) {
  try {
    await updateDoc(doc(firestore, 'laboratorios', labId), {
      activo: true,
      fechaBaja: deleteField(),
      motivoBaja: deleteField(),
      bajaPor: deleteField(),
      restauradoEn: serverTimestamp(),
      restauradoPor: currentUserRef(),
    });
    return true;
  } catch (error) {
    throw opError('No se pudo restaurar el laboratorio', error);
  }
}

// ELIMINACIÓN DEFINITIVA de un laboratorio en baja. Se niega si aún tiene ítems (activos o no):
// para no dejar registros huérfanos, sus ítems en papelera se eliminan antes con deleteItemHard
// (ver trash.js) y los activos deben restaurarse o darse de baja. Devuelve { imagenBorrada }.
export async function deleteLabHard(labId) {
  try {
    const labRef = doc(firestore, 'laboratorios', labId);
    const snap = await getDoc(labRef);
    if (!snap.exists()) return { imagenBorrada: false };
    const data = snap.data();
    if (data.activo !== false) {
      throw new Error('Solo se pueden eliminar definitivamente laboratorios que estén en la papelera.');
    }
    const itemsSnap = await getDocs(query(collection(firestore, 'items'), where('idLab', '==', labId)));
    if (itemsSnap.size > 0) {
      const e = new Error(`El laboratorio aún tiene ${itemsSnap.size} ítem(s). Restáuralos o elimínalos de la papelera primero.`);
      e.code = 'LAB_CON_ITEMS';
      throw e;
    }
    let imagenBorrada = false;
    if (data.imgname && !(await imagenCompartida(data.imgname, { exceptLabId: labId }))) {
      try {
        await deleteObject(ref(storage, `images/${data.imgname}`));
        imagenBorrada = true;
      } catch (error) {
        if (!error || error.code !== 'storage/object-not-found') console.error('No se pudo borrar la imagen:', error);
      }
    }
    await deleteDoc(labRef);
    return { imagenBorrada };
  } catch (error) {
    if (error && error.code === 'LAB_CON_ITEMS') throw error;
    throw opError('No se pudo eliminar definitivamente el laboratorio', error);
  }
}

// Compatibilidad: el default ahora es baja lógica.
export default deactivateLab;

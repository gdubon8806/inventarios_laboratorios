import {
  collection, doc, getDoc, getDocs, query, where, updateDoc, deleteDoc, deleteField,
  writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { firestore, storage } from '../../firebaseConfig';
import { auditFields, currentUserRef, opError, chunk } from './audit';

const MOTIVO_MIN = 5;

// ---------------------------------------------------------------------------
// BAJA LÓGICA (nunca deleteDoc). Devuelve true; lanza Error si falla.
// motivo: obligatorio (mín. 5 caracteres). No toca imágenes de Storage ni unidades.
// ---------------------------------------------------------------------------
export async function deactivateItem(itemId, motivo) {
  const texto = typeof motivo === 'string' ? motivo.trim() : '';
  if (texto.length < MOTIVO_MIN) {
    throw new Error(`Debes indicar el motivo de la baja (mínimo ${MOTIVO_MIN} caracteres).`);
  }
  try {
    await updateDoc(doc(firestore, 'items', itemId), {
      activo: false,
      fechaBaja: serverTimestamp(),
      motivoBaja: texto,
      bajaPor: currentUserRef(),
      ...auditFields(),
    });
    return true;
  } catch (error) {
    throw opError('No se pudo dar de baja el ítem', error);
  }
}

// Restaura un ítem dado de baja. Si su laboratorio está en baja lanza Error con code 'LAB_INACTIVO'
// (la UI debe pedir restaurar primero el laboratorio), salvo { force: true }.
export async function restoreItem(itemId, { force = false } = {}) {
  try {
    const itemRef = doc(firestore, 'items', itemId);
    const snap = await getDoc(itemRef);
    if (!snap.exists()) throw new Error('El ítem ya no existe.');
    const idLab = snap.data().idLab;
    if (!force && idLab) {
      const labSnap = await getDoc(doc(firestore, 'laboratorios', idLab));
      if (labSnap.exists() && labSnap.data().activo === false) {
        const e = new Error('El laboratorio de este ítem está dado de baja. Restaura primero el laboratorio.');
        e.code = 'LAB_INACTIVO';
        throw e;
      }
    }
    await updateDoc(itemRef, {
      activo: true,
      fechaBaja: deleteField(),
      motivoBaja: deleteField(),
      bajaPor: deleteField(),
      restauradoEn: serverTimestamp(),
      restauradoPor: currentUserRef(),
      ...auditFields(),
    });
    return true;
  } catch (error) {
    if (error && error.code === 'LAB_INACTIVO') throw error;
    throw opError('No se pudo restaurar el ítem', error);
  }
}

// ---------------------------------------------------------------------------
// ELIMINACIÓN DEFINITIVA (solo papelera: exige activo === false).
// Borra: unidades (subcolección), reportes asociados, imagen de Storage (solo si ningún otro
// ítem/laboratorio usa el mismo archivo) y el documento. Deja lápida en codigos/{codigo}
// para que ningún código se reutilice jamás (los contadores solo avanzan).
// Devuelve { unidades, reportes, imagenBorrada }.
// ---------------------------------------------------------------------------

// ¿Otro ítem o laboratorio (distinto del indicado) usa el mismo archivo de imagen?
export async function imagenCompartida(imgname, { exceptItemId = null, exceptLabId = null } = {}) {
  if (!imgname) return false;
  const [items, labs] = await Promise.all([
    getDocs(query(collection(firestore, 'items'), where('imgname', '==', imgname))),
    getDocs(query(collection(firestore, 'laboratorios'), where('imgname', '==', imgname))),
  ]);
  const otrosItems = items.docs.filter((d) => d.id !== exceptItemId).length;
  const otrosLabs = labs.docs.filter((d) => d.id !== exceptLabId).length;
  return otrosItems + otrosLabs > 0;
}

export async function deleteItemHard(itemId) {
  try {
    const itemRef = doc(firestore, 'items', itemId);
    const snap = await getDoc(itemRef);
    if (!snap.exists()) return { unidades: 0, reportes: 0, imagenBorrada: false };
    const data = snap.data();
    if (data.activo !== false) {
      throw new Error('Solo se pueden eliminar definitivamente ítems que estén en la papelera.');
    }

    // Unidades + lápidas de códigos
    const unidadesSnap = await getDocs(collection(firestore, 'items', itemId, 'unidades'));
    const codigos = new Set();
    if (data.codigo) codigos.add(data.codigo);
    if (data.codigoAnterior) codigos.add(data.codigoAnterior);
    unidadesSnap.forEach((u) => {
      const d = u.data();
      if (d.codigo) codigos.add(d.codigo);
      if (d.codigoAnterior) codigos.add(d.codigoAnterior);
    });
    for (const grupo of chunk([...codigos], 400)) {
      const batch = writeBatch(firestore);
      grupo.forEach((codigo) => {
        batch.set(doc(firestore, 'codigos', codigo), {
          eliminado: true,
          activo: false,
          eliminadoEn: serverTimestamp(),
          eliminadoPor: currentUserRef(),
        }, { merge: true });
      });
      await batch.commit();
    }
    for (const grupo of chunk(unidadesSnap.docs, 400)) {
      const batch = writeBatch(firestore);
      grupo.forEach((u) => batch.delete(u.ref));
      await batch.commit();
    }

    // Reportes asociados
    const reportesSnap = await getDocs(query(collection(firestore, 'reportes'), where('registroId', '==', itemId)));
    for (const grupo of chunk(reportesSnap.docs, 400)) {
      const batch = writeBatch(firestore);
      grupo.forEach((r) => batch.delete(r.ref));
      await batch.commit();
    }

    // Imagen (solo si no la usa otro registro o laboratorio)
    let imagenBorrada = false;
    if (data.imgname && !(await imagenCompartida(data.imgname, { exceptItemId: itemId }))) {
      try {
        await deleteObject(ref(storage, `images/${data.imgname}`));
        imagenBorrada = true;
      } catch (error) {
        // Si el archivo ya no existe no debe impedir la eliminación
        if (!error || error.code !== 'storage/object-not-found') console.error('No se pudo borrar la imagen:', error);
      }
    }

    await deleteDoc(itemRef);
    return { unidades: unidadesSnap.size, reportes: reportesSnap.size, imagenBorrada };
  } catch (error) {
    throw opError('No se pudo eliminar definitivamente el ítem', error);
  }
}

// Compatibilidad: los componentes existentes importan `deleteItem` por defecto.
// Ahora ese default hace BAJA LÓGICA (ya no borra nada).
export default deactivateItem;

import { doc, getDoc, updateDoc, deleteField } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig';
import { auditFields, opError } from './audit';
import { parseCantidad, motivosIncongruencia } from '../../lib/validation/registro';

// Actualiza parcialmente un ítem. Devuelve true; lanza Error si falla.
// - Estampa ultimaModificacion / ultimaModificacionPor.
// - Si se toca tipo o cantidad, reevalúa requiereValidacion (se limpia solo cuando el registro queda válido).
export default async function updateItem(itemId, newData) {
  try {
    const itemRef = doc(firestore, 'items', itemId);
    const data = { ...newData };

    if ('cantidad' in data) {
      const c = parseCantidad(data.cantidad);
      if (c.ok) data.cantidad = c.value;
    }
    if (Array.isArray(data.observaciones)) data.observaciones = data.observaciones.join('\n');

    if ('tipo' in data || 'cantidad' in data) {
      const snap = await getDoc(itemRef);
      const merged = { ...(snap.exists() ? snap.data() : {}), ...data };
      const motivos = motivosIncongruencia(merged);
      if (motivos.length > 0) {
        data.requiereValidacion = true;
        data.motivoValidacion = motivos.join('; ');
      } else if (snap.exists() && snap.data().requiereValidacion) {
        data.requiereValidacion = deleteField();
        data.motivoValidacion = deleteField();
      }
    }

    await updateDoc(itemRef, { ...data, ...auditFields() });
    return true;
  } catch (error) {
    throw opError('No se pudo actualizar el ítem', error);
  }
}

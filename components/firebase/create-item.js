import { collection, addDoc } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig';
import { auditFields, opError } from './audit';
import { parseCantidad, motivosIncongruencia } from '../../lib/validation/registro';

// Agrega un nuevo ítem (registro) a Firestore y devuelve su id.
// Lanza un Error (con contexto) si falla; el llamador debe capturarlo.
// Normaliza: cantidad numérica (si es válida), observaciones como texto, activo/estadoCodigo por defecto
// y marca requiereValidacion si el tipo o la cantidad no son válidos.
export default async function createItem(itemData) {
  try {
    const data = { ...itemData };

    const c = parseCantidad(data.cantidad);
    if (c.ok) data.cantidad = c.value;

    if (Array.isArray(data.observaciones)) data.observaciones = data.observaciones.join('\n');
    if (data.observaciones === undefined || data.observaciones === null) data.observaciones = '';

    const motivos = motivosIncongruencia(data);
    if (motivos.length > 0) {
      data.requiereValidacion = true;
      data.motivoValidacion = motivos.join('; ');
    }

    const nuevo = {
      activo: true,
      estadoCodigo: 'sinCodigo',
      ...data,
      ...auditFields(),
    };

    const itemsRef = collection(firestore, 'items');
    const response = await addDoc(itemsRef, nuevo);
    return response.id;
  } catch (error) {
    throw opError('No se pudo crear el ítem', error);
  }
}

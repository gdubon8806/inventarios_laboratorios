import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig';
import { currentUserRef, opError } from './audit';
import { tieneUnidades } from '../../lib/constants/tipos';

export const MAX_COMENTARIO = 1000;

// Crea un reporte (lo puede hacer cualquier usuario con sesión, incluido el invitado).
// Escribe SOLO en `reportes` (el invitado no puede tocar `items`). Los campos coinciden con la lista
// permitida de firestore.rules: registroId, unidadId, idLab, codigo, comentario, reportadoPor, fecha, estadoReporte.
//
// registro: registro (item) reportado. unidad: unidad reportada (obligatoria en Mobiliario/Equipo/Herramienta) o null.
// Devuelve el id del reporte; lanza Error si falla o si los datos no son válidos.
export default async function createReport({ registro, unidad = null, idLab, comentario, user = null }) {
  const texto = String(comentario ?? '').trim();
  if (!registro?.id) throw new Error('Falta el registro que se desea reportar.');
  if (texto.length === 0) throw new Error('El comentario es obligatorio.');
  if (texto.length > MAX_COMENTARIO) throw new Error(`El comentario no puede superar ${MAX_COMENTARIO} caracteres.`);
  if (tieneUnidades(registro.tipo) && !unidad?.id) {
    throw new Error('Selecciona la unidad que quieres reportar.');
  }
  const ref = user ? { uid: user.uid, email: user.email ?? null } : currentUserRef();
  if (!ref) throw new Error('Debes iniciar sesión para reportar.');
  try {
    const res = await addDoc(collection(firestore, 'reportes'), {
      registroId: registro.id,
      unidadId: unidad?.id ?? null,
      idLab: idLab ?? registro.idLab ?? '',
      codigo: unidad?.codigo ?? registro.codigo ?? null,
      comentario: texto,
      reportadoPor: ref,
      fecha: serverTimestamp(),
      estadoReporte: 'abierto',
    });
    return res.id;
  } catch (error) {
    throw opError('No se pudo crear el reporte', error);
  }
}

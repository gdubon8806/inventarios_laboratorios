import { serverTimestamp } from 'firebase/firestore';
import { auth } from '../../firebaseConfig';

// Usuario actual en el formato que se guarda en los documentos.
export function currentUserRef() {
  const u = auth.currentUser;
  return u ? { uid: u.uid, email: u.email || null } : null;
}

// Campos de auditoría para altas y ediciones.
export function auditFields() {
  return {
    ultimaModificacion: serverTimestamp(),
    ultimaModificacionPor: currentUserRef(),
  };
}

// Envuelve un error de Firebase en uno con contexto en español (conserva code y cause).
export function opError(contexto, error) {
  console.error(`${contexto}:`, error);
  const e = new Error(`${contexto}: ${error && error.message ? error.message : error}`);
  e.code = error && error.code;
  e.cause = error;
  return e;
}

// Divide un arreglo en trozos (límite de 500 escrituras por writeBatch).
export function chunk(arr, size = 400) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

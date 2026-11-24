import { collection, getDocs } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig';
import { computeLabCodeStatus } from './generate-missing-codes';

// Todos los registros ACTIVOS de todos los laboratorios con UNA sola lectura.
// -> { items, error }   `error` es el texto del problema si la lectura falló (la pantalla lo muestra; antes se perdía en silencio).
// La pantalla principal reutiliza esta lista para los conteos por laboratorio Y para la búsqueda de texto global.
export async function readAllActiveItems() {
  try {
    const snap = await getDocs(collection(firestore, 'items'));
    const items = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.activo === false || !data.idLab) return;
      items.push({ id: d.id, ...data });
    });
    return { items, error: null };
  } catch (error) {
    console.error('Error al leer los registros de los laboratorios: ', error);
    return { items: [], error: `${error?.code ? `${error.code}: ` : ''}${error?.message ?? error}` };
  }
}

// Conteos de códigos por laboratorio a partir de una lista de registros activos.
// -> { [idLab]: { total, sinCodigo, pendienteImprimir, impreso, incongruentes, porValidar } }
export function statusesFromItems(items) {
  const byLab = {};
  for (const it of items) {
    if (!byLab[it.idLab]) byLab[it.idLab] = [];
    byLab[it.idLab].push(it);
  }
  const out = {};
  for (const [labId, records] of Object.entries(byLab)) out[labId] = computeLabCodeStatus(records);
  return out;
}

// Estado de códigos de TODOS los laboratorios con UNA sola consulta (en vez de una por tarjeta).
// Los registros dados de baja (activo === false) no cuentan. Ante un error registra y devuelve {}.
export default async function readAllLabStatuses() {
  const { items } = await readAllActiveItems();
  return statusesFromItems(items);
}

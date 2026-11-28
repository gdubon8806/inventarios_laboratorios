// Lectura de la BD (laboratorios, registros y unidades) para exportar y para validar importaciones.
// Depende de Firebase: la lógica pura vive en lib/import/*.
import { collection, getDocs, query, where } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig';
import { isInsumo } from '../../lib/import/columns';

const CONCURRENCY = 8;

async function mapLimit(list, limit, fn) {
  const out = new Array(list.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (next < list.length) {
      const i = next++;
      out[i] = await fn(list[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Snapshot completo e IMPARCIAL (incluye dados de baja; el filtrado lo hace cada consumidor).
 * `readAt` se toma ANTES de leer: así cualquier cambio posterior cuenta como "después de exportar".
 * Las unidades se leen por registro (subcolección) para no depender de una regla de collection group.
 * `labIds` (opcional): lee SOLO los registros/unidades de esos laboratorios (exportar o importar uno o algunos
 * laboratorios). Sin `labIds` se lee todo. Los laboratorios siempre se leen todos (son pocos documentos).
 */
export async function loadSnapshot({ labIds = null } = {}) {
  const readAt = new Date().toISOString();
  const ids = labIds ? [...new Set(labIds.filter(Boolean))] : null;
  const [labsSnap, itemSnaps] = await Promise.all([
    getDocs(collection(firestore, 'laboratorios')),
    ids
      ? Promise.all(ids.map((id) => getDocs(query(collection(firestore, 'items'), where('idLab', '==', id)))))
      : getDocs(collection(firestore, 'items')).then((s) => [s]),
  ]);
  const labs = labsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const items = itemSnaps.flatMap((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })));

  const withUnits = items.filter((it) => !isInsumo(it.tipo));
  const perItem = await mapLimit(withUnits, CONCURRENCY, async (it) => {
    try {
      const s = await getDocs(collection(firestore, 'items', it.id, 'unidades'));
      return s.docs.map((d) => ({ id: d.id, itemId: it.id, idLab: it.idLab, ...d.data() }));
    } catch (e) {
      // Sin permiso o sin subcolección todavía: se trata como "sin unidades".
      console.error('No se pudieron leer las unidades de', it.id, e);
      return [];
    }
  });
  const unidades = perItem.flat();
  return { readAt, labs, items, unidades };
}

export function groupSnapshot(snapshot) {
  const itemsByLab = {};
  for (const it of snapshot.items) (itemsByLab[it.idLab] ||= []).push(it);
  const unitsByItem = {};
  for (const u of snapshot.unidades) (unitsByItem[u.itemId] ||= []).push(u);
  return { itemsByLab, unitsByItem };
}

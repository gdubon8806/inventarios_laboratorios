import { collection, getDocs, getCountFromServer, query, where } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig';
import { readItemsInactivos } from './read-item';
import { readLabsInactivos } from './read-lab';
import { deleteItemHard } from './delete-item';
import { deleteLabHard } from './delete-lab';

// ---------------------------------------------------------------------------
// Papelera: cálculo EXACTO de lo que se eliminaría y vaciado.
// scope: 'todo' | 'articulos' | 'laboratorios'
// olderThanDays: solo lo dado de baja hace más de N días (0/null = sin filtro)
// ---------------------------------------------------------------------------

function fechaBajaMs(d) {
  const f = d.fechaBaja;
  if (!f) return null;
  if (typeof f.toMillis === 'function') return f.toMillis();
  if (typeof f.seconds === 'number') return f.seconds * 1000;
  return null;
}

function pasaFiltroAntiguedad(d, olderThanDays) {
  if (!olderThanDays || olderThanDays <= 0) return true;
  const ms = fechaBajaMs(d);
  // Sin fecha de baja registrada: se considera antiguo (no hay forma de saber cuándo fue)
  if (ms === null) return true;
  return Date.now() - ms > olderThanDays * 24 * 60 * 60 * 1000;
}

async function conteo(q) {
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

// Ejecuta tareas asíncronas con concurrencia limitada.
async function enLotes(lista, tarea, tamano = 8) {
  const resultados = [];
  for (let i = 0; i < lista.length; i += tamano) {
    resultados.push(...(await Promise.all(lista.slice(i, i + tamano).map(tarea))));
  }
  return resultados;
}

export async function planTrash({ scope = 'todo', olderThanDays = 0 } = {}) {
  const incluirItems = scope === 'todo' || scope === 'articulos';
  const incluirLabs = scope === 'todo' || scope === 'laboratorios';

  const [todosItems, todosLabs] = await Promise.all([
    incluirItems ? readItemsInactivos() : Promise.resolve([]),
    incluirLabs ? readLabsInactivos() : Promise.resolve([]),
  ]);
  const items = todosItems.filter((i) => pasaFiltroAntiguedad(i, olderThanDays));
  const labsCandidatos = todosLabs.filter((l) => pasaFiltroAntiguedad(l, olderThanDays));

  const idsItems = new Set(items.map((i) => i.id));

  // Unidades y reportes por ítem
  const detalle = await enLotes(items, async (it) => {
    const [unidades, reportes] = await Promise.all([
      conteo(collection(firestore, 'items', it.id, 'unidades')),
      conteo(query(collection(firestore, 'reportes'), where('registroId', '==', it.id))),
    ]);
    return { id: it.id, unidades, reportes };
  });
  const unidades = detalle.reduce((s, d) => s + d.unidades, 0);
  const reportes = detalle.reduce((s, d) => s + d.reportes, 0);

  // Laboratorios: solo se eliminan si no les queda ningún ítem fuera de la selección
  const labs = [];
  const labsOmitidos = [];
  for (const lab of labsCandidatos) {
    const snap = await getDocs(query(collection(firestore, 'items'), where('idLab', '==', lab.id)));
    const restantes = snap.docs.filter((d) => !idsItems.has(d.id)).length;
    if (restantes === 0) labs.push(lab);
    else labsOmitidos.push({ lab, restantes });
  }
  const idsLabs = new Set(labs.map((l) => l.id));

  // Imágenes que realmente se borrarían: nombres usados solo por documentos de la selección
  const nombres = new Set([...items, ...labs].map((d) => d.imgname).filter(Boolean));
  let imagenes = 0;
  for (const nombre of nombres) {
    const [its, lbs] = await Promise.all([
      getDocs(query(collection(firestore, 'items'), where('imgname', '==', nombre))),
      getDocs(query(collection(firestore, 'laboratorios'), where('imgname', '==', nombre))),
    ]);
    const usadaFuera = its.docs.some((d) => !idsItems.has(d.id)) || lbs.docs.some((d) => !idsLabs.has(d.id));
    if (!usadaFuera) imagenes++;
  }

  return {
    scope,
    olderThanDays,
    items,
    labs,
    labsOmitidos,
    totales: {
      items: items.length,
      unidades,
      reportes,
      imagenes,
      labs: labs.length,
      labsOmitidos: labsOmitidos.length,
    },
  };
}

// Vacía la papelera según el plan (si no se pasa, lo calcula con las mismas opciones).
// Primero los ítems y luego los laboratorios. Nunca lanza por un elemento fallido: acumula errores.
// onProgress({ hechos, total, etapa }) opcional.
export async function emptyTrash(plan, { onProgress } = {}) {
  const p = plan || (await planTrash());
  const total = p.items.length + p.labs.length;
  const resumen = { items: 0, unidades: 0, reportes: 0, imagenes: 0, labs: 0, errores: [] };
  let hechos = 0;
  const avanzar = (etapa) => {
    hechos++;
    if (onProgress) onProgress({ hechos, total, etapa });
  };

  for (const it of p.items) {
    try {
      const r = await deleteItemHard(it.id);
      resumen.items++;
      resumen.unidades += r.unidades;
      resumen.reportes += r.reportes;
      if (r.imagenBorrada) resumen.imagenes++;
    } catch (error) {
      resumen.errores.push({ tipo: 'item', id: it.id, nombre: it.equipo, mensaje: error.message });
    }
    avanzar('articulos');
  }
  for (const lab of p.labs) {
    try {
      const r = await deleteLabHard(lab.id);
      resumen.labs++;
      if (r.imagenBorrada) resumen.imagenes++;
    } catch (error) {
      resumen.errores.push({ tipo: 'laboratorio', id: lab.id, nombre: lab.name, mensaje: error.message });
    }
    avanzar('laboratorios');
  }
  return resumen;
}

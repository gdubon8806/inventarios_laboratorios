// Caché en memoria de la pantalla principal (laboratorios + registros activos + incongruentes).
// Objetivo: no volver a leer TODA la colección `items` cada vez que alguien vuelve a la pantalla principal.
// - Vive mientras la pestaña esté abierta (navegación interna de Next.js). Recargar la página la vacía.
// - Caduca a los TTL_MS.
// - Al salir del inventario de un laboratorio se marca ese laboratorio como "sucio": al volver solo se relee ese.
// - Importar Excel, la papelera u otras acciones masivas invalidan todo (la próxima visita relee completo).

export const TTL_MS = 10 * 60 * 1000;

let cache = null; // { at, isAdmin, labs, items, incongruentes }
let allDirty = false;
const dirtyLabs = new Set();

/** Devuelve la caché válida o null. `dirtyLabs` = laboratorios que hay que releer antes de usarla. */
export function getHomeCache({ isAdmin, now = Date.now() } = {}) {
  if (!cache || allDirty) return null;
  if (cache.isAdmin !== !!isAdmin) return null;
  if (now - cache.at > TTL_MS) return null;
  return { labs: cache.labs, items: cache.items, incongruentes: cache.incongruentes, dirtyLabs: [...dirtyLabs] };
}

/** Guarda una lectura COMPLETA (reinicia el reloj y limpia lo sucio). */
export function setHomeCache({ isAdmin, labs, items, incongruentes, now = Date.now() }) {
  cache = { at: now, isAdmin: !!isAdmin, labs, items, incongruentes };
  allDirty = false;
  dirtyLabs.clear();
}

/** Actualiza el contenido sin reiniciar el reloj (cambios locales de la pantalla principal). */
export function updateHomeCache(partial) {
  if (!cache) return;
  cache = { ...cache, ...partial };
}

/** Quita de la lista de sucios los laboratorios ya releídos. */
export function clearDirtyLabs(labIds) {
  for (const id of labIds) dirtyLabs.delete(id);
}

export function markLabDirty(labId) {
  if (labId) dirtyLabs.add(labId);
}

export function invalidateHomeCache() {
  allDirty = true;
}

/** Solo para pruebas. */
export function _resetHomeCache() {
  cache = null;
  allDirty = false;
  dirtyLabs.clear();
}

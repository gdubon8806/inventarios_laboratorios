// MODO DEMO: sustituto de `firebase/storage`. Las imágenes subidas se guardan como URL temporal del navegador.
const blobs = new Map();

export const getStorage = () => ({ demo: true });
export const ref = (_storage, path = '') => ({ fullPath: path, name: String(path).split('/').pop() });
export async function uploadBytes(r, file) {
  try { blobs.set(r.fullPath, URL.createObjectURL(file)); } catch { /* sin blob */ }
  return { ref: r };
}
export async function getDownloadURL(r) {
  return blobs.get(r.fullPath) || `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="100%" height="100%" fill="#cfd8dc"/><text x="50%" y="52%" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#455a64">Imagen demo</text></svg>')}`;
}
export async function listAll() { return { items: [], prefixes: [] }; }
export async function deleteObject(r) { blobs.delete(r.fullPath); }

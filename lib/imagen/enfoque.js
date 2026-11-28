// Enfoque de imagen: la foto se guarda COMPLETA y solo se recuerda qué zona mostrar en tarjetas y detalle.
// Se guarda en el documento como `imgEnfoque: { x, y, zoom, area }`:
//   x, y  = centro de la zona elegida, en % del ancho/alto de la foto (0-100)
//   zoom  = acercamiento (1 = sin zoom)
//   area  = zona elegida en % ({ x, y, width, height }), para reabrir el ajuste tal como quedó
// «Ver completa» siempre muestra la foto original sin enfoque.

const r2 = (n) => Math.round(n * 100) / 100;
const lim = (n, min, max) => Math.min(max, Math.max(min, n));

/** Convierte lo que entrega el recorte (área en % y zoom) en el enfoque que se guarda. */
export function enfoqueDesdeArea(area, zoom = 1) {
  if (!area) return null;
  const a = {
    x: r2(lim(area.x, 0, 100)), y: r2(lim(area.y, 0, 100)),
    width: r2(lim(area.width, 0, 100)), height: r2(lim(area.height, 0, 100)),
  };
  return {
    x: r2(lim(a.x + a.width / 2, 0, 100)),
    y: r2(lim(a.y + a.height / 2, 0, 100)),
    zoom: r2(lim(Number(zoom) || 1, 1, 4)),
    area: a,
  };
}

/** Devuelve un enfoque válido o null (datos viejos, vacíos o dañados = sin enfoque). */
export function normalizarEnfoque(e) {
  if (!e || typeof e !== 'object') return null;
  const x = Number(e.x); const y = Number(e.y); const zoom = Number(e.zoom);
  if (![x, y].every(Number.isFinite)) return null;
  return { x: lim(x, 0, 100), y: lim(y, 0, 100), zoom: Number.isFinite(zoom) ? lim(zoom, 1, 4) : 1, area: e.area ?? null };
}

/** Estilo CSS para un <img> con object-fit: cover que muestra la zona enfocada. Sin enfoque = centrado normal. */
export function estiloEnfoque(e) {
  const n = normalizarEnfoque(e);
  if (!n) return {};
  const pos = `${n.x}% ${n.y}%`;
  return n.zoom > 1
    ? { objectPosition: pos, transform: `scale(${n.zoom})`, transformOrigin: pos }
    : { objectPosition: pos };
}

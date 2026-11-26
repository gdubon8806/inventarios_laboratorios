// Lógica PURA de diseño de etiquetas (sin DOM ni dependencias): se prueba con `node --test`.
// Todas las medidas están en milímetros.

export const DEFAULT_SIZE = { widthMm: 50, heightMm: 30 }; // igual que la maqueta (jsPDF 50x30 mm)
export const SIZE_STORAGE_KEY = 'etiquetas.tamano';

export const QUIET_ZONE_MM = 3; // zona de silencio a los lados del código
export const PAD_V_MM = 1.5; // margen vertical de la etiqueta
export const MIN_MODULE_MM = 0.25; // ancho mínimo de módulo (barra más fina) para que el escáner lea
export const MAX_MODULE_MM = 0.5;
export const DEFAULT_DOT_MM = 0.125; // 203 dpi ≈ 8 puntos/mm. Para 300 dpi usar 0.0847.
export const MIN_BARCODE_HEIGHT_MM = 8;

const LAB_FONT_MM = 2.0;
const NAME_FONT_MM = 2.6;
const CODE_FONT_MM = 3.2;
const GAP_MM = 0.6;

export function sanitizeSize(size) {
  const w = Number(size?.widthMm);
  const h = Number(size?.heightMm);
  const ok = (n) => Number.isFinite(n) && n >= 10 && n <= 300;
  return {
    widthMm: ok(w) ? w : DEFAULT_SIZE.widthMm,
    heightMm: ok(h) ? h : DEFAULT_SIZE.heightMm,
  };
}

export function loadSize(storage) {
  try {
    const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    const raw = s?.getItem(SIZE_STORAGE_KEY);
    return raw ? sanitizeSize(JSON.parse(raw)) : { ...DEFAULT_SIZE };
  } catch {
    return { ...DEFAULT_SIZE };
  }
}

export function saveSize(size, storage) {
  try {
    const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    s?.setItem(SIZE_STORAGE_KEY, JSON.stringify(sanitizeSize(size)));
  } catch {
    /* sin localStorage: se usa el valor por defecto */
  }
}

// Code 128 subset B (se fuerza para que el ancho sea determinista):
// (inicio + n datos + checksum) * 11 módulos + 13 del stop.
export function code128bModules(code) {
  const n = String(code ?? '').length;
  return (n + 2) * 11 + 13;
}

// opts: { dotMm, quietMm, printableWidthMm }
//   dotMm: tamaño del punto de la impresora (25.4 / dpi).
//   printableWidthMm: ancho de impresión EFECTIVO de la impresora; si la etiqueta es más ancha, el contenido se centra
//   dentro de esa zona (por ejemplo 100 mm efectivos en un rollo de 110 mm).
export function computeLayout(size, code, opts = {}) {
  const { widthMm, heightMm } = sanitizeSize(size);
  const dotMm = opts.dotMm ?? DEFAULT_DOT_MM;
  const quietMm = opts.quietMm ?? QUIET_ZONE_MM;
  const printable = opts.printableWidthMm > 0 ? Math.min(widthMm, opts.printableWidthMm) : widthMm;
  const sidePadMm = +((widthMm - printable) / 2 + quietMm).toFixed(3); // margen lateral real (centra la zona efectiva)
  const modules = code128bModules(code);
  const availableWidthMm = printable - 2 * quietMm;
  // Etiquetas grandes: los textos crecen (hasta 2x) para aprovechar el espacio; en 50x30 mm la escala es 1.
  const scale = Math.max(1, Math.min(2, printable / 50, heightMm / 30));

  // Ajusta el módulo a un múltiplo del punto de la impresora para evitar barras borrosas.
  const raw = Math.min(MAX_MODULE_MM, availableWidthMm / modules);
  const moduleMm = Math.floor((raw + 0.001) / dotMm + 1e-9) * dotMm; // +0.001: tolera el redondeo del punto (203 dpi: 4 puntos = 0.5004 mm)
  const barcodeWidthMm = +(modules * moduleMm).toFixed(3);

  const fonts = {
    labMm: +(LAB_FONT_MM * scale).toFixed(2),
    nameMm: +(NAME_FONT_MM * scale).toFixed(2),
    codeMm: +(CODE_FONT_MM * scale).toFixed(2),
  };
  const gapMm = +(GAP_MM * scale).toFixed(2);
  const textMm = fonts.labMm + fonts.nameMm + fonts.codeMm + 3 * gapMm;
  const barcodeHeightMm = +(heightMm - 2 * PAD_V_MM - textMm).toFixed(3);

  const problems = [];
  if (moduleMm < MIN_MODULE_MM - 1e-9) problems.push('El código no cabe en el ancho de la etiqueta con barras legibles (módulo < 0.25 mm).');
  if (barcodeHeightMm < MIN_BARCODE_HEIGHT_MM) problems.push('La etiqueta es muy baja: las barras quedarían menores a 8 mm.');

  return {
    widthMm,
    heightMm,
    quietMm,
    sidePadMm,
    printableWidthMm: +printable.toFixed(3),
    scale: +scale.toFixed(3),
    padVMm: PAD_V_MM,
    modules,
    moduleMm: +moduleMm.toFixed(4),
    barcodeWidthMm,
    barcodeHeightMm: Math.max(barcodeHeightMm, 0),
    fonts,
    gapMm,
    fits: problems.length === 0,
    problems,
  };
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Toma el <svg> que genera JsBarcode (width/height en "px" = módulos) y lo escala a mm exactos.
export function fitSvg(svgString, widthMm, heightMm) {
  const m = /^<svg\b([^>]*)>/i.exec(svgString.trim());
  if (!m) return svgString;
  const attrs = m[1];
  const w = /\bwidth="([\d.]+)/i.exec(attrs)?.[1];
  const h = /\bheight="([\d.]+)/i.exec(attrs)?.[1];
  let rest = attrs.replace(/\s(width|height|viewBox|preserveAspectRatio)="[^"]*"/gi, '');
  const vb = w && h ? ` viewBox="0 0 ${w} ${h}"` : '';
  const open = `<svg${rest}${vb} preserveAspectRatio="none" shape-rendering="crispEdges" style="width:${widthMm}mm;height:${heightMm}mm;display:block">`;
  return svgString.trim().replace(m[0], open);
}

// Genera el HTML completo del documento de impresión. `renderBarcode(code)` devuelve el SVG como string.
// label: { codigo, nombre, lab }
// Impresora térmica DIRECTA: solo existe el negro, así que el texto completo va en negro puro (sin grises).
export function buildLabelsHtml(labels, size, { renderBarcode, border = false, dotMm, printableWidthMm } = {}) {
  const valid = (labels ?? []).filter((l) => l && l.codigo);
  const pages = valid
    .map((l, i) => {
      const lay = computeLayout(size, l.codigo, { dotMm, printableWidthMm });
      const svg = fitSvg(renderBarcode(l.codigo), lay.barcodeWidthMm, lay.barcodeHeightMm);
      const last = i === valid.length - 1;
      return `<div class="label${last ? ' last' : ''}">
  <div class="lab">${escapeHtml(l.lab)}</div>
  <div class="name">${escapeHtml(l.nombre)}</div>
  <div class="bars">${svg}</div>
  <div class="code">${escapeHtml(l.codigo)}</div>
</div>`;
    })
    .join('\n');

  const { widthMm, heightMm, sidePadMm, padVMm, fonts, gapMm } = computeLayout(size, valid[0]?.codigo ?? 'X', { dotMm, printableWidthMm });
  const css = `
@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
.label { width: ${widthMm}mm; height: ${heightMm}mm; padding: ${padVMm}mm ${sidePadMm}mm; overflow: hidden;
  display: flex; flex-direction: column; align-items: center; justify-content: space-between;
  font-family: Arial, Helvetica, sans-serif; page-break-after: always; break-after: page;
  ${border ? 'border: 0.3mm solid #000;' : ''} }
.label.last { page-break-after: auto; break-after: auto; }
.lab, .name, .code { width: 100%; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.1; }
.lab { font-size: ${fonts.labMm}mm; color: #000; margin-bottom: ${gapMm}mm; }
.name { font-size: ${fonts.nameMm}mm; font-weight: 600; margin-bottom: ${gapMm}mm; }
.bars { display: flex; justify-content: center; flex: 1 1 auto; align-items: center; }
.code { font-size: ${fonts.codeMm}mm; font-weight: 700; letter-spacing: 0.15mm; margin-top: ${gapMm}mm; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Etiquetas</title><style>${css}</style></head><body>${pages}</body></html>`;
}

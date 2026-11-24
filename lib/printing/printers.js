// Perfiles de impresora de etiquetas (lógica PURA, sin DOM): se prueba con `node --test`.
// Todas las medidas están en milímetros.
//
// Perfil predeterminado: Vortek DIR-EB58III, térmica DIRECTA (solo negro, sin cinta), rollo de hasta 4" (110 mm) y
// zona de impresión efectiva de 100 mm. La resolución (203 dpi) es la habitual en este tipo de equipos, pero es un dato
// POR CONFIRMAR con la ficha del fabricante: se puede cambiar a 300 dpi en la pantalla de impresión.
// «Otra impresora» deja ancho, alto, resolución y límites editables para usar cualquier otro equipo.
import { sanitizeSize } from './labelLayout.js';

export const PRINTER_STORAGE_KEY = 'etiquetas.impresora';

export const PRINTER_PROFILES = {
  vortek: {
    id: 'vortek',
    name: 'Vortek DIR-EB58III',
    detail: 'Térmica directa · rollo de hasta 4" (110 mm) · zona de impresión efectiva de 100 mm',
    dpi: 203,
    maxRollWidthMm: 110,
    maxPrintWidthMm: 100,
    defaultSize: { widthMm: 100, heightMm: 50 },
  },
  otra: {
    id: 'otra',
    name: 'Otra impresora',
    detail: 'Define el tamaño de la etiqueta, la resolución y los límites del rollo',
    dpi: 203,
    maxRollWidthMm: null,
    maxPrintWidthMm: null,
    defaultSize: { widthMm: 50, heightMm: 30 },
  },
};

export const DEFAULT_PRINTER_ID = 'vortek';
export const DPI_OPTIONS = [203, 300, 600];

// Tamaños frecuentes de etiqueta adhesiva (ancho x alto). El último valor «Personalizado» lo agrega la pantalla.
export const SIZE_PRESETS = [
  { widthMm: 100, heightMm: 50 },
  { widthMm: 100, heightMm: 30 },
  { widthMm: 100, heightMm: 70 },
  { widthMm: 80, heightMm: 50 },
  { widthMm: 60, heightMm: 40 },
  { widthMm: 50, heightMm: 30 },
  { widthMm: 40, heightMm: 25 },
];

export const sizeKey = (s) => `${s.widthMm}x${s.heightMm}`;
export const findPreset = (size) => SIZE_PRESETS.find((p) => sizeKey(p) === sizeKey(size)) ?? null;

export function getProfile(id) {
  return PRINTER_PROFILES[id] ?? PRINTER_PROFILES[DEFAULT_PRINTER_ID];
}

export function defaultPrinterSettings(id = DEFAULT_PRINTER_ID) {
  const p = getProfile(id);
  return {
    printerId: p.id,
    widthMm: p.defaultSize.widthMm,
    heightMm: p.defaultSize.heightMm,
    dpi: p.dpi,
    maxRollWidthMm: p.maxRollWidthMm,
    maxPrintWidthMm: p.maxPrintWidthMm,
  };
}

/** Tamaño del punto de la impresora en mm (25.4 / dpi). 203 dpi -> 0.1251 mm. */
export function dotMmFromDpi(dpi) {
  const n = Number(dpi);
  return +(25.4 / (Number.isFinite(n) && n > 0 ? n : 203)).toFixed(4);
}

const positiveOrNull = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Normaliza lo guardado/escrito: perfil válido, tamaño dentro de rango, resolución permitida y límites del perfil. */
export function sanitizePrinterSettings(raw) {
  const profile = getProfile(raw?.printerId);
  const base = defaultPrinterSettings(profile.id);
  const size = sanitizeSize({ widthMm: raw?.widthMm ?? base.widthMm, heightMm: raw?.heightMm ?? base.heightMm });
  const dpi = DPI_OPTIONS.includes(Number(raw?.dpi)) ? Number(raw.dpi) : base.dpi;
  // En «Vortek» los límites del rollo son los del fabricante; en «Otra» el usuario los define (vacío = sin límite).
  const fixed = profile.id !== 'otra';
  return {
    printerId: profile.id,
    widthMm: size.widthMm,
    heightMm: size.heightMm,
    dpi,
    maxRollWidthMm: fixed ? profile.maxRollWidthMm : positiveOrNull(raw?.maxRollWidthMm),
    maxPrintWidthMm: fixed ? profile.maxPrintWidthMm : positiveOrNull(raw?.maxPrintWidthMm),
  };
}

export function loadPrinterSettings(storage) {
  try {
    const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    const raw = s?.getItem(PRINTER_STORAGE_KEY);
    return raw ? sanitizePrinterSettings(JSON.parse(raw)) : defaultPrinterSettings();
  } catch {
    return defaultPrinterSettings();
  }
}

export function savePrinterSettings(settings, storage) {
  try {
    const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    s?.setItem(PRINTER_STORAGE_KEY, JSON.stringify(sanitizePrinterSettings(settings)));
  } catch {
    /* sin localStorage: se usan los valores por defecto */
  }
}

/** Opciones que entiende computeLayout / buildLabelsHtml a partir de los ajustes de la impresora. */
export function layoutOptions(settings) {
  const s = sanitizePrinterSettings(settings);
  return { dotMm: dotMmFromDpi(s.dpi), printableWidthMm: s.maxPrintWidthMm ?? undefined };
}

/** Avisos sobre el tamaño elegido: [{ severity: 'error' | 'info', text }] */
export function printerWarnings(settings) {
  const s = sanitizePrinterSettings(settings);
  const out = [];
  if (s.maxRollWidthMm && s.widthMm > s.maxRollWidthMm) {
    out.push({ severity: 'error', text: `El ancho de la etiqueta (${s.widthMm} mm) es mayor que el rollo máximo de la impresora (${s.maxRollWidthMm} mm).` });
  } else if (s.maxPrintWidthMm && s.widthMm > s.maxPrintWidthMm) {
    out.push({
      severity: 'info',
      text: `La zona de impresión efectiva es de ${s.maxPrintWidthMm} mm: el contenido se centra en esa zona y el resto (${+(s.widthMm - s.maxPrintWidthMm).toFixed(2)} mm) queda en blanco.`,
    });
  }
  return out;
}

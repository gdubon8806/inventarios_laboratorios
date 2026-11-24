// Esquema de columnas del Excel v1 (PLAN_FUNCIONALIDADES_V2.md §10) y helpers de normalización.
// Módulo PURO: sin dependencias de Firebase ni de SheetJS (se puede probar con `node --test`).

export const SCHEMA_VERSION = 1;
export const META_SHEET = '_meta';

// Tipos tal como se guardan hoy en Firestore (`items.tipo`).
export const TIPOS = ['Mobiliario', 'Equipo', 'Herramienta', 'Suministro'];
export const PREFIJOS = { Mobiliario: 'MOB', Equipo: 'EQU', Herramienta: 'HER', Suministro: 'INS' };
export const CODE_REGEX = /^(MOB|HER|INS|EQU)-(\d{6,})$/;

// Umbrales D11 (decisión del usuario). Si ya existe lib/codes/thresholds.js, unificar allí.
// Se exige confirmación cuando la cantidad es ESTRICTAMENTE mayor al umbral.
export const THRESHOLDS = { Herramienta: 10, Equipo: 10, Mobiliario: 20, Suministro: 100 };

export const ESTADOS = ['bueno', 'malo', 'reparacion'];
export const ESTADO_LABEL = { bueno: 'Bueno', malo: 'Malo', reparacion: 'Reparación' };

export const YEAR_MIN = 2000;
export const YEAR_MAX = 2100;

// ---------------------------------------------------------------------------
// Definición de columnas. `dbKey` = campo de Firestore; `type` guía la comparación.
// ---------------------------------------------------------------------------
export const REGISTRO_FIELDS = [
  { key: 'id', header: 'ID', hidden: true, readonly: true },
  { key: 'codigo', header: 'Código', readonly: true, dbKey: 'codigo' },
  { key: 'nombre', header: 'Nombre', dbKey: 'equipo', type: 'text', aliases: ['equipo'] },
  { key: 'tipo', header: 'Tipo', dbKey: 'tipo', type: 'tipo' },
  { key: 'marca', header: 'Marca', dbKey: 'marca', type: 'text' },
  { key: 'modelo', header: 'Modelo', dbKey: 'modelo', type: 'text' },
  { key: 'cantidad', header: 'Cantidad', dbKey: 'cantidad', type: 'int' },
  { key: 'ubicacion', header: 'Ubicación', dbKey: 'ubicacion', type: 'text' },
  { key: 'columna', header: 'Columna de localización', dbKey: 'columnadelocalizacion', type: 'text', aliases: ['columna de localizacion'] },
  { key: 'serie', header: 'Nº serie', dbKey: 'numeroSerie', type: 'text', insOnly: true, aliases: ['n serie', 'numero de serie', 'no serie'] },
  { key: 'fundaempresa', header: 'Cód. Fundaempresa', dbKey: 'codigoFundaempresa', type: 'text', insOnly: true, aliases: ['cod fundaempresa', 'codigo fundaempresa'] },
  { key: 'observaciones', header: 'Observaciones', dbKey: 'observaciones', type: 'text' },
  { key: 'tieneVencimiento', header: 'Tiene vencimiento', dbKey: 'tieneVencimiento', type: 'bool' },
  { key: 'fechaVencimiento', header: 'Fecha vencimiento', dbKey: 'fechaVencimiento', type: 'date' },
  { key: 'estado', header: 'Estado', dbKey: 'estado', type: 'estado', insOnly: true },
  { key: 'activo', header: 'Activo', dbKey: 'activo', type: 'bool' },
];

export const UNIDAD_FIELDS = [
  { key: 'id', header: 'ID', hidden: true, readonly: true },
  { key: 'registroId', header: 'ID registro', hidden: true, readonly: true },
  { key: 'codigo', header: 'Código', readonly: true, dbKey: 'codigo' },
  { key: 'registro', header: 'Registro', readonly: true, info: true }, // solo informativa
  // Datos del registro repetidos en cada unidad para que cada fila sea autosuficiente (informativas: sin dbKey,
  // la importación las ignora; los cambios se hacen en la hoja de Registros).
  { key: 'tipo', header: 'Tipo', readonly: true, info: true },
  { key: 'marca', header: 'Marca', readonly: true, info: true },
  { key: 'modelo', header: 'Modelo', readonly: true, info: true },
  { key: 'ubicacion', header: 'Ubicación', readonly: true, info: true },
  { key: 'columna', header: 'Columna de localización', readonly: true, info: true },
  { key: 'cantidadRegistro', header: 'Cantidad del registro', readonly: true, info: true },
  { key: 'serie', header: 'Nº serie', dbKey: 'numeroSerie', type: 'text', aliases: ['n serie', 'numero de serie', 'no serie'] },
  { key: 'fundaempresa', header: 'Cód. Fundaempresa', dbKey: 'codigoFundaempresa', type: 'text', aliases: ['cod fundaempresa', 'codigo fundaempresa'] },
  { key: 'estado', header: 'Estado', dbKey: 'estado', type: 'estado' },
  { key: 'observaciones', header: 'Observaciones', dbKey: 'observaciones', type: 'text' },
  { key: 'activo', header: 'Activo', dbKey: 'activo', type: 'bool' },
];

// Columnas sin las cuales el archivo no se puede interpretar.
export const REGISTRO_REQUIRED_HEADERS = ['id', 'codigo', 'nombre', 'tipo', 'cantidad'];
export const UNIDAD_REQUIRED_HEADERS = ['id', 'registroId', 'codigo'];

// ---------------------------------------------------------------------------
// Normalización de texto / valores
// ---------------------------------------------------------------------------
export function stripAccents(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function normHeader(s) {
  return stripAccents(s)
    .toLowerCase()
    .replace(/[º°.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function headerLookup(fields) {
  const map = new Map();
  for (const f of fields) {
    map.set(normHeader(f.header), f.key);
    for (const a of f.aliases || []) map.set(normHeader(a), f.key);
  }
  return map;
}

/** Texto comparable: null/undefined -> '', trim, \r\n -> \n; arreglos (observaciones legadas) se unen con \n. */
export function normText(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map(normText).filter(Boolean).join('\n');
  if (v instanceof Date) return v.toISOString();
  return String(v).replace(/\r\n?/g, '\n').trim();
}

export function isEmpty(v) {
  return normText(v) === '';
}

/** Canonicaliza el tipo a los valores de BD. Devuelve null si no es un tipo del catálogo. */
export function canonicalTipo(v) {
  const t = stripAccents(normText(v)).toLowerCase();
  if (!t) return null;
  if (t === 'mobiliario') return 'Mobiliario';
  if (t === 'equipo') return 'Equipo';
  if (t === 'herramienta') return 'Herramienta';
  if (t === 'suministro' || t === 'insumo') return 'Suministro';
  return null;
}

export function isInsumo(tipo) {
  return canonicalTipo(tipo) === 'Suministro';
}

export function prefixOfTipo(tipo) {
  const t = canonicalTipo(tipo);
  return t ? PREFIJOS[t] : null;
}

export function prefixOfCode(code) {
  const m = CODE_REGEX.exec(normText(code).toUpperCase());
  return m ? m[1] : null;
}

/** Código en formato canónico (mayúsculas, sin espacios). '' si vacío. */
export function normCode(v) {
  return normText(v).toUpperCase().replace(/\s+/g, '');
}

/** Entero >= 0 a partir de número o texto. Devuelve { ok, value } (value=null si vacío). */
export function parseCantidad(v) {
  if (v === null || v === undefined || normText(v) === '') return { ok: true, value: null, empty: true };
  let n;
  if (typeof v === 'number') n = v;
  else {
    const s = normText(v).replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(s)) return { ok: false, value: null, raw: v };
    n = Number(s);
  }
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return { ok: false, value: null, raw: v };
  return { ok: true, value: n, empty: false };
}

/** "Sí"/"No" (también si/true/1/0/x) -> true/false; null si vacío; undefined si no reconocible. */
export function parseBool(v) {
  if (typeof v === 'boolean') return v;
  const t = stripAccents(normText(v)).toLowerCase();
  if (t === '') return null;
  if (['si', 's', 'true', '1', 'x', 'yes', 'y'].includes(t)) return true;
  if (['no', 'n', 'false', '0'].includes(t)) return false;
  return undefined;
}

export function boolLabel(b) {
  return b ? 'Sí' : 'No';
}

/** Estado -> clave ('bueno'|'malo'|'reparacion'); null si vacío; undefined si no reconocible. */
export function parseEstado(v) {
  const t = stripAccents(normText(v)).toLowerCase();
  if (t === '') return null;
  return ESTADOS.includes(t) ? t : undefined;
}

export function estadoLabel(k) {
  return ESTADO_LABEL[k] || '';
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function isValidYMD(y, m, d) {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < YEAR_MIN || y > YEAR_MAX || m < 1 || m > 12 || d < 1) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Fecha -> 'YYYY-MM-DD'. Acepta string ISO/DD-MM-YYYY, serial de Excel (number), Date,
 * Timestamp de Firestore ({toDate()} o {seconds}).
 * Devuelve { ok, value, empty }. Las fechas fuera de 2000–2100 o inexistentes -> ok:false.
 */
export function parseFecha(v) {
  if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) {
    return { ok: true, value: null, empty: true };
  }
  let y;
  let m;
  let d;
  if (typeof v === 'number') {
    // serial de Excel (sistema 1900): días desde 1899-12-30, independiente de zona horaria
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
    y = dt.getUTCFullYear();
    m = dt.getUTCMonth() + 1;
    d = dt.getUTCDate();
  } else if (v instanceof Date) {
    y = v.getFullYear();
    m = v.getMonth() + 1;
    d = v.getDate();
  } else if (typeof v === 'object' && typeof v.toDate === 'function') {
    const dt = v.toDate();
    y = dt.getFullYear();
    m = dt.getMonth() + 1;
    d = dt.getDate();
  } else if (typeof v === 'object' && typeof v.seconds === 'number') {
    const dt = new Date(v.seconds * 1000);
    y = dt.getFullYear();
    m = dt.getMonth() + 1;
    d = dt.getDate();
  } else {
    const s = String(v).trim();
    let mt = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s);
    if (mt) {
      y = Number(mt[1]);
      m = Number(mt[2]);
      d = Number(mt[3]);
    } else if ((mt = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s))) {
      d = Number(mt[1]);
      m = Number(mt[2]);
      y = Number(mt[3]);
    } else {
      return { ok: false, value: null, raw: v };
    }
  }
  if (!isValidYMD(y, m, d)) return { ok: false, value: null, raw: v };
  return { ok: true, value: `${y}-${pad2(m)}-${pad2(d)}`, empty: false };
}

/** Nombre de hoja válido en Excel: sin []:*?/\ , ≤31 caracteres, no vacío. */
export function sanitizeSheetName(name, fallback = 'Hoja') {
  let s = String(name ?? '')
    .replace(/[\[\]:*?/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^'+|'+$/g, '');
  if (!s) s = fallback;
  return s.slice(0, 31);
}

/** Devuelve un nombre único dentro de `used` (Set, comparación sin mayúsculas) y ≤31 caracteres. */
export function uniqueSheetName(base, used) {
  let name = sanitizeSheetName(base);
  let n = 2;
  while (used.has(name.toLowerCase()) || name.toLowerCase() === META_SHEET) {
    const suffix = ` (${n++})`;
    name = sanitizeSheetName(base).slice(0, 31 - suffix.length) + suffix;
  }
  used.add(name.toLowerCase());
  return name;
}

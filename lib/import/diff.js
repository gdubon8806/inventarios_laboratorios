// Valores comparables (BD vs Excel) y diff campo a campo. PURO.
import {
  REGISTRO_FIELDS,
  UNIDAD_FIELDS,
  canonicalTipo,
  estadoLabel,
  boolLabel,
  normText,
  parseBool,
  parseCantidad,
  parseEstado,
  parseFecha,
} from './columns.js';

export const EDIT_FIELDS_REG = [
  'nombre', 'tipo', 'marca', 'modelo', 'cantidad', 'ubicacion', 'columna',
  'serie', 'fundaempresa', 'observaciones', 'tieneVencimiento', 'fechaVencimiento', 'estado', 'activo',
];
export const EDIT_FIELDS_UNI = ['serie', 'fundaempresa', 'estado', 'observaciones', 'activo'];

const LABELS = {
  registros: Object.fromEntries(REGISTRO_FIELDS.map((f) => [f.key, f.header])),
  unidades: Object.fromEntries(UNIDAD_FIELDS.map((f) => [f.key, f.header])),
};
export const fieldLabel = (kind, key) => LABELS[kind]?.[key] || key;

/** Mapa key -> campo de Firestore (para escribir cambios). */
export const DB_KEY = {
  registros: Object.fromEntries(REGISTRO_FIELDS.filter((f) => f.dbKey).map((f) => [f.key, f.dbKey])),
  unidades: Object.fromEntries(UNIDAD_FIELDS.filter((f) => f.dbKey).map((f) => [f.key, f.dbKey])),
};

// --- BD -> comparable ---------------------------------------------------------------------------
export function comparableFromCurrentRegistro(it) {
  const cant = parseCantidad(it.cantidad);
  const fecha = parseFecha(it.fechaVencimiento);
  return {
    nombre: normText(it.equipo),
    tipo: normText(it.tipo),
    marca: normText(it.marca),
    modelo: normText(it.modelo),
    cantidad: cant.ok ? cant.value : normText(it.cantidad), // valor raro se conserva como texto
    ubicacion: normText(it.ubicacion),
    columna: normText(it.columnadelocalizacion),
    serie: normText(it.numeroSerie),
    fundaempresa: normText(it.codigoFundaempresa),
    observaciones: normText(it.observaciones),
    tieneVencimiento: it.tieneVencimiento === true,
    fechaVencimiento: it.tieneVencimiento === true && fecha.ok ? fecha.value : null,
    estado: parseEstado(it.estado) || 'bueno',
    activo: it.activo !== false,
  };
}

export function comparableFromCurrentUnidad(u) {
  return {
    serie: normText(u.numeroSerie),
    fundaempresa: normText(u.codigoFundaempresa),
    estado: parseEstado(u.estado) || 'bueno',
    observaciones: normText(u.observaciones),
    activo: u.activo !== false,
  };
}

// --- Excel -> comparable ------------------------------------------------------------------------
// Devuelve { vals, issues }. Los campos con formato inválido quedan en `invalid` (no se comparan).
function parseCommon(row, issues, invalid, kind) {
  const pushIssue = (field, code, message) => {
    issues.push({ level: 'error', code, field, message });
    invalid.add(field);
  };
  const out = {};
  const lbl = (k) => fieldLabel(kind, k);

  if ('estado' in row) {
    const e = parseEstado(row.estado);
    if (e === undefined) pushIssue('estado', 'E_ESTADO_INVALID', `${lbl('estado')} "${normText(row.estado)}" no válido (use Bueno, Malo o Reparación).`);
    out.estado = e === undefined ? null : e; // null = vacío
    out.estadoEmpty = e === null;
  }
  if ('activo' in row) {
    const b = parseBool(row.activo);
    if (b === undefined || b === null) {
      pushIssue('activo', 'E_BOOL_INVALID', `${lbl('activo')} debe ser Sí o No.`);
      out.activo = null;
    } else out.activo = b;
  }
  for (const k of ['serie', 'fundaempresa', 'observaciones']) {
    if (k in row) out[k] = normText(row[k]);
  }
  return out;
}

/**
 * `legacy.cantidad`: valor de cantidad de la BD que no es numérico (dato incongruente). Si el Excel lo
 * trae IGUAL, no se marca como error (se conserva tal cual); solo error si se escribe otro valor no válido.
 */
export function comparableFromRowRegistro(row, legacy = {}) {
  const issues = [];
  const invalid = new Set();
  const vals = parseCommon(row, issues, invalid, 'registros');
  for (const k of ['nombre', 'marca', 'modelo', 'ubicacion', 'columna']) vals[k] = normText(row[k]);
  vals.tipoRaw = normText(row.tipo);
  vals.tipo = canonicalTipo(row.tipo) ?? vals.tipoRaw; // si no es del catálogo se deja el texto

  const cant = parseCantidad(row.cantidad);
  if (!cant.ok && legacy.cantidad !== undefined && normText(row.cantidad) === legacy.cantidad) {
    vals.cantidad = legacy.cantidad; // legado sin cambios: se conserva
  } else if (!cant.ok) {
    issues.push({ level: 'error', code: 'E_QTY_INVALID', field: 'cantidad', message: `Cantidad "${normText(row.cantidad)}" no válida: debe ser un número entero ≥ 0.` });
    invalid.add('cantidad');
    vals.cantidad = null;
  } else vals.cantidad = cant.value; // null si vacío

  if ('tieneVencimiento' in row) {
    const b = parseBool(row.tieneVencimiento);
    if (b === undefined) {
      issues.push({ level: 'error', code: 'E_BOOL_INVALID', field: 'tieneVencimiento', message: 'Tiene vencimiento debe ser Sí o No.' });
      invalid.add('tieneVencimiento');
      vals.tieneVencimiento = null;
    } else {
      vals.tieneVencimiento = b === null ? null : b; // null = vacío
    }
  }
  const f = parseFecha(row.fechaVencimiento);
  if (!f.ok) {
    issues.push({ level: 'error', code: 'E_DATE_INVALID', field: 'fechaVencimiento', message: `Fecha de vencimiento "${normText(row.fechaVencimiento)}" no válida (use AAAA-MM-DD, año 2000–2100).` });
    invalid.add('fechaVencimiento');
    vals.fechaVencimiento = null;
  } else vals.fechaVencimiento = f.value;
  return { vals, issues, invalid };
}

export function comparableFromRowUnidad(row) {
  const issues = [];
  const invalid = new Set();
  const vals = parseCommon(row, issues, invalid, 'unidades');
  return { vals, issues, invalid };
}

// --- Presentación -------------------------------------------------------------------------------
export function displayValue(key, v) {
  if (v === null || v === undefined || v === '') return '';
  if (key === 'tieneVencimiento' || key === 'activo') return boolLabel(v);
  if (key === 'estado') return estadoLabel(v);
  return String(v);
}

export function isFilled(key, v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v !== '';
  return true;
}

export function sameValue(a, b) {
  const na = a === undefined || a === '' ? null : a;
  const nb = b === undefined || b === '' ? null : b;
  return na === nb;
}

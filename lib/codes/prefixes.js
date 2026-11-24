// Prefijos de código por tipo de artículo y utilidades de formato.
// Módulo PURO (sin dependencias de Firebase) para poder probarlo con `node --test`.

export const PREFIXES = ['MOB', 'HER', 'INS', 'EQU'];

// Nombre canónico (el que se guarda en Firestore en el campo `tipo`) -> prefijo
export const TIPO_TO_PREFIX = {
  Mobiliario: 'MOB',
  Herramienta: 'HER',
  Suministro: 'INS', // "Insumo" en el lenguaje del usuario
  Equipo: 'EQU',
};

export const PREFIX_TO_TIPO = {
  MOB: 'Mobiliario',
  HER: 'Herramienta',
  INS: 'Suministro',
  EQU: 'Equipo',
};

// Tipos que llevan un código POR UNIDAD (subcolección `unidades`). INS lleva 1 código por registro.
export const UNIT_PREFIXES = ['MOB', 'HER', 'EQU'];

export const ESTADOS = ['bueno', 'malo', 'reparacion'];
export const ESTADOS_CODIGO = ['sinCodigo', 'pendienteImprimir', 'impreso'];

export const CODE_DIGITS = 6;

function plain(str) {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

const ALIASES = {
  mobiliario: 'MOB',
  herramienta: 'HER',
  herramientas: 'HER',
  suministro: 'INS',
  suministros: 'INS',
  insumo: 'INS',
  insumos: 'INS',
  equipo: 'EQU',
  equipos: 'EQU',
  // el propio prefijo también se acepta como tipo
  mob: 'MOB',
  her: 'HER',
  ins: 'INS',
  equ: 'EQU',
};

/** Devuelve el prefijo para un tipo (tolerante a mayúsculas/tildes/plural) o null si es desconocido. */
export function prefixForTipo(tipo) {
  return ALIASES[plain(tipo)] ?? null;
}

/** Devuelve el nombre canónico de tipo para un tipo escrito de forma libre, o null. */
export function canonicalTipo(tipo) {
  const p = prefixForTipo(tipo);
  return p ? PREFIX_TO_TIPO[p] : null;
}

export function tipoForPrefix(prefix) {
  return PREFIX_TO_TIPO[String(prefix).toUpperCase()] ?? null;
}

/** ¿Este tipo (o prefijo) se maneja con unidades? Tipos desconocidos -> false. */
export function usesUnits(tipoOrPrefix) {
  const p = PREFIXES.includes(String(tipoOrPrefix).toUpperCase())
    ? String(tipoOrPrefix).toUpperCase()
    : prefixForTipo(tipoOrPrefix);
  return p ? UNIT_PREFIXES.includes(p) : false;
}

/** formatCode('EQU', 123) -> 'EQU-000123' */
export function formatCode(prefix, number) {
  const p = String(prefix).toUpperCase();
  if (!PREFIXES.includes(p)) throw new Error(`Prefijo inválido: ${prefix}`);
  if (!Number.isInteger(number) || number < 1) throw new Error(`Número de código inválido: ${number}`);
  return `${p}-${String(number).padStart(CODE_DIGITS, '0')}`;
}

/** Parsea un código completo canónico 'EQU-000123' -> {prefix, number}; null si no calza. */
export function parseCode(code) {
  const m = /^(MOB|HER|INS|EQU)-(\d{6,})$/.exec(String(code ?? ''));
  if (!m) return null;
  return { prefix: m[1], number: Number(m[2]) };
}

/** Id determinista de unidad dentro de un registro: u0001, u0002, ... */
export function unitId(index) {
  if (!Number.isInteger(index) || index < 1) throw new Error(`Índice de unidad inválido: ${index}`);
  return `u${String(index).padStart(4, '0')}`;
}

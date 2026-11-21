// Lista única de tipos de artículo y su prefijo de código de barras.
// El valor guardado en Firestore sigue siendo 'Suministro' (compatibilidad con datos existentes);
// en el plan se le llama "Insumo" y su prefijo es INS.

export const TIPOS = ['Herramienta', 'Suministro', 'Equipo', 'Mobiliario'];

export const PREFIJO_POR_TIPO = {
  Mobiliario: 'MOB',
  Herramienta: 'HER',
  Suministro: 'INS',
  Equipo: 'EQU',
};

// Tipos cuyas unidades físicas llevan código propio (tabla de unidades).
export const TIPOS_CON_UNIDADES = ['Mobiliario', 'Equipo', 'Herramienta'];

export function esTipoValido(tipo) {
  return TIPOS.includes(tipo);
}

export function prefijoDeTipo(tipo) {
  return PREFIJO_POR_TIPO[tipo] || null;
}

export function tieneUnidades(tipo) {
  return TIPOS_CON_UNIDADES.includes(tipo);
}

const sinAcentos = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// Interpretación TOLERANTE (mayúsculas, acentos, plurales, "Insumo"). Devuelve el tipo canónico o null.
// Útil para importar Excel; NO se usa para reescribir datos existentes (eso solo lo marca la migración).
export function tipoDesdeTexto(raw) {
  if (typeof raw !== 'string') return null;
  const t = sinAcentos(raw.trim().toLowerCase());
  if (!t) return null;
  if (['herramienta', 'herramientas'].includes(t)) return 'Herramienta';
  if (['suministro', 'suministros', 'insumo', 'insumos'].includes(t)) return 'Suministro';
  if (['equipo', 'equipos'].includes(t)) return 'Equipo';
  if (['mobiliario', 'mobiliarios'].includes(t)) return 'Mobiliario';
  return null;
}

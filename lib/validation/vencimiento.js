// Fecha de vencimiento (D5). Módulo PURO.
// - tieneVencimiento=false -> fecha = null (se limpia).
// - tieneVencimiento=true  -> fecha obligatoria, formato yyyy-mm-dd, año 2000..2100. Las pasadas se permiten (aviso "vencido").

/** Valida el par {tieneVencimiento, fecha:'yyyy-mm-dd'}. -> { ok, error?, fecha:Date|null, vencido?:boolean } */
export function validarVencimiento({ tieneVencimiento, fecha }, hoy = new Date()) {
  if (!tieneVencimiento) return { ok: true, fecha: null };
  const date = fechaInputADate(fecha);
  if (!date) return { ok: false, error: 'La fecha de vencimiento es obligatoria (formato válido aaaa-mm-dd).', fecha: null };
  const y = date.getFullYear();
  if (y < 2000 || y > 2100) return { ok: false, error: 'La fecha de vencimiento debe estar entre los años 2000 y 2100.', fecha: null };
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return { ok: true, fecha: date, vencido: date < inicioHoy };
}

/** 'yyyy-mm-dd' -> Date a mediodía local (evita corrimientos de día por zona horaria) o null si no es válida. */
export function fechaInputADate(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str ?? '').trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d, 12, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

/** Date | Timestamp de Firestore (con toDate) | null -> 'yyyy-mm-dd' ('' si no hay). */
export function valorAFechaInput(value) {
  const date = value && typeof value.toDate === 'function' ? value.toDate() : value instanceof Date ? value : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** Días hasta el vencimiento (negativo = ya vencido) o null. */
export function diasParaVencer(value, hoy = new Date()) {
  const date = value && typeof value.toDate === 'function' ? value.toDate() : value instanceof Date ? value : null;
  if (!date) return null;
  const a = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((b - a) / 86400000);
}

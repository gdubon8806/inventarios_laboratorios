// Umbrales de validación (D11) y validación de datos de un registro (D13). Módulo PURO.
import { prefixForTipo, usesUnits } from './prefixes.js';

// Estrictamente MAYOR: 10 pasa, 11 alerta (HER/EQU); 20 pasa, 21 alerta (MOB); 100 pasa, 101 pregunta (INS).
export const THRESHOLDS = {
  EQU: { max: 10, action: 'validar-uno-a-uno' },
  HER: { max: 10, action: 'validar-uno-a-uno' },
  MOB: { max: 20, action: 'validar-uno-a-uno' },
  INS: { max: 100, action: 'confirmar' },
};

/**
 * Convierte `cantidad` (hoy string en Firestore) a número entero >= 0.
 * -> { ok:true, value } | { ok:false, reason }
 */
export function parseCantidad(raw) {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return { ok: false, reason: 'cantidad no numérica' };
    if (!Number.isInteger(raw)) return { ok: false, reason: 'cantidad con decimales' };
    if (raw < 0) return { ok: false, reason: 'cantidad negativa' };
    return { ok: true, value: raw };
  }
  const s = String(raw ?? '').trim();
  if (s === '') return { ok: false, reason: 'cantidad vacía' };
  const n = Number(s.replace(',', '.'));
  if (!/^-?\d+([.,]\d+)?$/.test(s) || !Number.isFinite(n)) {
    return { ok: false, reason: `cantidad no numérica ("${s}")` };
  }
  if (!Number.isInteger(n)) return { ok: false, reason: 'cantidad con decimales' };
  if (n < 0) return { ok: false, reason: 'cantidad negativa' };
  return { ok: true, value: n };
}

/**
 * Revisa si una cantidad requiere validación según el tipo.
 * -> { action: 'ok' | 'validar-uno-a-uno' | 'confirmar', threshold }
 */
export function checkQuantity(tipo, cantidad) {
  const prefix = prefixForTipo(tipo);
  const parsed = parseCantidad(cantidad);
  if (!prefix || !parsed.ok) return { action: 'ok', threshold: null };
  const t = THRESHOLDS[prefix];
  return parsed.value > t.max
    ? { action: t.action, threshold: t.max }
    : { action: 'ok', threshold: t.max };
}

/**
 * Datos incongruentes (D13): sin tipo / tipo raro / cantidad inválida.
 * -> { ok:true, prefix, cantidad } | { ok:false, motivo }
 */
export function validateRecordData(record) {
  const prefix = prefixForTipo(record?.tipo);
  if (!String(record?.tipo ?? '').trim()) return { ok: false, motivo: 'sin tipo' };
  if (!prefix) return { ok: false, motivo: `tipo no reconocido ("${record.tipo}")` };
  const q = parseCantidad(record?.cantidad);
  if (!q.ok) return { ok: false, motivo: q.reason };
  return { ok: true, prefix, cantidad: q.value };
}

export { usesUnits };

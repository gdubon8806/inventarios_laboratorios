// Validación de datos de un registro (item). Sirve a createItem/updateItem y al script de migración.
import { TIPOS } from '../constants/tipos';

// Convierte la cantidad a número entero >= 0.
// Devuelve { ok: true, value } o { ok: false, motivo }.
export function parseCantidad(raw) {
  if (typeof raw === 'number') {
    if (Number.isInteger(raw) && raw >= 0) return { ok: true, value: raw };
    return { ok: false, motivo: `cantidad inválida (${raw})` };
  }
  if (raw === undefined || raw === null) return { ok: false, motivo: 'cantidad vacía' };
  const texto = String(raw).trim();
  if (texto === '') return { ok: false, motivo: 'cantidad vacía' };
  const n = Number(texto.replace(',', '.'));
  if (!Number.isFinite(n) || !/^-?\d+([.,]\d+)?$/.test(texto)) {
    return { ok: false, motivo: `cantidad no numérica ("${texto}")` };
  }
  if (!Number.isInteger(n) || n < 0) return { ok: false, motivo: `cantidad inválida ("${texto}")` };
  return { ok: true, value: n };
}

// Motivos por los que un registro es "incongruente" (lista vacía = todo bien).
export function motivosIncongruencia({ tipo, cantidad }) {
  const motivos = [];
  if (typeof tipo !== 'string' || tipo.trim() === '') motivos.push('sin tipo');
  else if (!TIPOS.includes(tipo)) motivos.push(`tipo no reconocido ("${tipo}")`);
  const c = parseCantidad(cantidad);
  if (!c.ok) motivos.push(c.motivo);
  return motivos;
}

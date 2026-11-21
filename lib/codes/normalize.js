// Normalización de texto y clasificación de lo que el usuario escribe/escanea en el buscador.
// Módulo PURO.
import { CODE_DIGITS, formatCode } from './prefixes.js';

/** Minúsculas, sin tildes, sin apóstrofes, espacios recortados y colapsados. */
export function normalizeText(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`´]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const CODE_RE = /^(MOB|HER|INS|EQU)-?(\d+)$/;

/**
 * Clasifica la entrada del buscador.
 *  - { kind:'exact',   code:'EQU-000123' }                 6+ dígitos
 *  - { kind:'partial', prefix:'EQU', digits:'0001', exactCandidate:'EQU-000001' }   menos de 6 dígitos
 *  - { kind:'none' }                                        no parece un código -> buscar por nombre
 * Acepta mayúsculas/minúsculas, espacios y el guion opcional (algunos escáneres lo "comen").
 */
export function classifyCodeInput(input) {
  const cleaned = String(input ?? '').replace(/\s+/g, '').toUpperCase();
  const m = CODE_RE.exec(cleaned);
  if (!m) return { kind: 'none' };
  const [, prefix, digits] = m;
  if (digits.length >= CODE_DIGITS) {
    return { kind: 'exact', code: `${prefix}-${digits.replace(/^0+(?=\d{6})/, '')}` };
  }
  return {
    kind: 'partial',
    prefix,
    digits,
    exactCandidate: Number(digits) >= 1 ? formatCode(prefix, Number(digits)) : null,
  };
}

/** ¿El texto parece un código (exacto o parcial)? */
export function isCodeLike(input) {
  return classifyCodeInput(input).kind !== 'none';
}

/**
 * Rango para consultar por prefijo en Firestore con documentId():
 *   where(documentId(), '>=', start) y where(documentId(), '<', end)
 * prefixRange('EQU','0001') -> { start:'EQU-0001', end:'EQU-0001' }
 */
export function prefixRange(prefix, digits) {
  const start = `${String(prefix).toUpperCase()}-${digits}`;
  return { start, end: `${start}` };
}

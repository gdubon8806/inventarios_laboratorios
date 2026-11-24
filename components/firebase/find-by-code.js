// Búsqueda por código (escáner o escrito). Exacto = 1 lectura directa en `codigos/{codigo}`;
// parcial = rango por prefijo sobre el id del documento. Tolera códigos reemplazados y de baja.
import { collection, documentId, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { firestore, docRef } from './codes-shared';
import { classifyCodeInput, prefixRange } from '../../lib/codes/normalize';

async function loadTarget(codeData) {
  const regSnap = await getDoc(docRef(`items/${codeData.registroId}`));
  if (!regSnap.exists()) return null;
  const registro = { id: regSnap.id, ...regSnap.data() };
  let unidad = null;
  if (codeData.unidadId) {
    const uSnap = await getDoc(docRef(`items/${codeData.registroId}/unidades/${codeData.unidadId}`));
    if (uSnap.exists()) unidad = { id: uSnap.id, ...uSnap.data() };
  }
  return { registro, unidad };
}

/**
 * Resuelve un código canónico.
 * -> { status:'found',    code, registro, unidad|null }
 *    { status:'replaced', code, registro, unidad|null, replacedCode, notice }   (código viejo tras cambio de tipo)
 *    { status:'baja',     code, registro, unidad|null, motivoBaja, notice }      (SOLO admin)
 *    { status:'eliminado', code, notice }                                          (SOLO admin)
 *    { status:'not-found' }
 */
export async function resolveCode(code, { isAdmin = false, _depth = 0 } = {}) {
  const snap = await getDoc(docRef(`codigos/${code}`));
  if (!snap.exists()) return { status: 'not-found' };
  const data = snap.data();

  if (data.eliminado) {
    return isAdmin ? { status: 'eliminado', code, notice: `El código ${code} fue eliminado definitivamente` } : { status: 'not-found' };
  }
  if (data.reemplazado && data.reemplazadoPor && _depth < 5) {
    const next = await resolveCode(data.reemplazadoPor, { isAdmin, _depth: _depth + 1 });
    if (next.status === 'not-found') return next;
    return { ...next, status: next.status === 'found' ? 'replaced' : next.status, replacedCode: code, notice: `Código reemplazado por ${data.reemplazadoPor}` };
  }

  const target = await loadTarget(data);
  if (!target) return { status: 'not-found' };
  const enBaja = data.activo === false || target.registro.activo === false || target.unidad?.activo === false;
  if (enBaja) {
    if (!isAdmin) return { status: 'not-found' }; // el invitado no ve bajas
    const motivo = target.unidad?.motivoBaja ?? target.registro.motivoBaja ?? null;
    return { status: 'baja', code, ...target, motivoBaja: motivo, notice: `DADO DE BAJA${motivo ? `: ${motivo}` : ''}` };
  }
  if (data.reemplazado) {
    // Código viejo sin código nuevo directo (p. ej. INS -> unidades): lleva al registro
    return { status: 'replaced', code, ...target, replacedCode: code, notice: 'Este código fue reemplazado; se muestra el registro actual' };
  }
  return { status: 'found', code, ...target };
}

/**
 * Punto de entrada del buscador.
 * -> { status:'not-code' }                                   el texto no parece un código (buscar por nombre)
 *    resultado de resolveCode(...)                           código exacto
 *    { status:'list', matches:[{code,registroId,unidadId,labId,tipo}], exactCandidate: resultado|null }   parcial
 */
export async function findByCode(input, { isAdmin = false, max = 20 } = {}) {
  const c = classifyCodeInput(input);
  if (c.kind === 'none') return { status: 'not-code' };
  if (c.kind === 'exact') return resolveCode(c.code, { isAdmin });

  const exactCandidate = c.exactCandidate ? await resolveCode(c.exactCandidate, { isAdmin }) : null;
  const { start, end } = prefixRange(c.prefix, c.digits);
  const snap = await getDocs(
    query(collection(firestore, 'codigos'), where(documentId(), '>=', start), where(documentId(), '<=', end), limit(max)),
  );
  const matches = snap.docs
    .map((d) => ({ code: d.id, ...d.data() }))
    .filter((m) => !m.eliminado && (isAdmin || m.activo !== false))
    .map(({ code, registroId, unidadId, labId, tipo, activo }) => ({ code, registroId, unidadId, labId, tipo, activo }));
  return {
    status: 'list',
    matches,
    exactCandidate: exactCandidate && exactCandidate.status !== 'not-found' ? exactCandidate : null,
  };
}

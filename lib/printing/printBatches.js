// Lógica PURA de selección y partición en tandas (sin DOM). Se prueba con `node --test`.

export const MAX_BATCH = 100;

// label: { id, codigo, nombre, lab, tipo, estadoCodigo }
export function isPending(label) {
  return label?.estadoCodigo === 'pendienteImprimir';
}

export function filterLabels(labels, { onlyPending = true, tipo = 'todos' } = {}) {
  return (labels ?? []).filter((l) => {
    if (!l?.codigo) return false; // sin código no hay etiqueta
    if (onlyPending && !isPending(l)) return false;
    if (tipo && tipo !== 'todos' && l.tipo !== tipo) return false;
    return true;
  });
}

export function chunk(items, size = MAX_BATCH) {
  const n = Math.max(1, Math.floor(size));
  const out = [];
  for (let i = 0; i < (items ?? []).length; i += n) out.push(items.slice(i, i + n));
  return out;
}

export function batchLabel(index, total) {
  return `Parte ${index + 1} de ${total}`;
}

export function confirmQuestion(count, labName) {
  return `¿Imprimir ${count} ${count === 1 ? 'etiqueta' : 'etiquetas'} del laboratorio ${labName}?`;
}

export function summarize(labels) {
  const all = labels ?? [];
  const withCode = all.filter((l) => l?.codigo);
  const byTipo = {};
  for (const l of withCode) byTipo[l.tipo ?? 'Sin tipo'] = (byTipo[l.tipo ?? 'Sin tipo'] ?? 0) + 1;
  return {
    total: all.length,
    withoutCode: all.length - withCode.length,
    pending: withCode.filter(isPending).length,
    byTipo,
  };
}

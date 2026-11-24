// Estadísticas del laboratorio y agrupación de reportes. Módulo PURO (sin Firebase) para probarlo con node --test.
import { parseCantidad } from '../codes/thresholds.js';
import { usesUnits } from '../codes/prefixes.js';

/**
 * Agrupa reportes ABIERTOS por registroId.
 * -> Map registroId -> { reports, unidadIds:Set<string>, count }
 * `count` = unidades distintas con reporte abierto (+1 si hay algún reporte sin unidad, p. ej. un insumo).
 */
export function groupOpenReports(reports) {
  const map = new Map();
  for (const r of reports ?? []) {
    if (!r || r.estadoReporte === 'resuelto') continue;
    if (!map.has(r.registroId)) map.set(r.registroId, { reports: [], unidadIds: new Set(), count: 0 });
    const g = map.get(r.registroId);
    g.reports.push(r);
    if (r.unidadId) g.unidadIds.add(r.unidadId);
  }
  for (const g of map.values()) {
    const sinUnidad = g.reports.some((r) => !r.unidadId);
    g.count = g.unidadIds.size + (sinUnidad ? 1 : 0);
  }
  return map;
}

/**
 * Cuadro del laboratorio. `items` = SOLO registros activos del lab (todos, sin filtrar por búsqueda).
 * -> { registros, totalCantidad, reportadas, pendientesCodigo, pendientesImpresion, incongruentes, porValidar }
 * `reportadas` nunca supera la cantidad del registro (un reporte de una unidad dada de baja no inflaría el total).
 */
export function computeLabStats(items, reports) {
  const groups = groupOpenReports(reports);
  const stats = {
    registros: 0, totalCantidad: 0, reportadas: 0,
    pendientesCodigo: 0, pendientesImpresion: 0, incongruentes: 0, porValidar: 0,
  };
  for (const it of items ?? []) {
    if (!it || it.activo === false) continue;
    stats.registros += 1;
    const c = parseCantidad(it.cantidad);
    if (c.ok) stats.totalCantidad += c.value;
    const g = groups.get(it.id);
    if (g) stats.reportadas += c.ok ? Math.min(g.count, Math.max(c.value, 1)) : g.count;
    if (it.requiereValidacion) stats.incongruentes += 1;
    else if (it.pendienteValidar) stats.porValidar += 1;
    else if (!it.estadoCodigo || it.estadoCodigo === 'sinCodigo') stats.pendientesCodigo += 1;
    if (it.estadoCodigo === 'pendienteImprimir') stats.pendientesImpresion += 1;
  }
  return stats;
}

/** Color de la franja izquierda según el estado del código (sólo se muestra al admin). */
export function codeStripeColor(estadoCodigo) {
  if (estadoCodigo === 'pendienteImprimir') return '#d32f2f'; // rojo
  if (!estadoCodigo || estadoCodigo === 'sinCodigo') return '#ff9800'; // ámbar
  return null; // impreso: sin marca
}

/** Texto del chip "Reportado": "2 de 10 unidades reportadas" / "Reportado" (insumos). null si no hay reportes. */
export function reportedLabel(registro, count) {
  if (!count) return null;
  if (usesUnits(registro?.tipo)) {
    const total = parseCantidad(registro.cantidad);
    return `${count} de ${total.ok ? total.value : '?'} unidades reportadas`;
  }
  return 'Reportado';
}

/** Filtro por nombre insensible a tildes/mayúsculas/espacios y por tipos seleccionados. */
export function filterRecords(items, { text = '', tipos = [] } = {}, normalize) {
  const needle = normalize(text);
  return (items ?? []).filter((it) => {
    if (tipos.length > 0 && !tipos.includes(it.tipo)) return false;
    return normalize(it.equipo).includes(needle);
  });
}

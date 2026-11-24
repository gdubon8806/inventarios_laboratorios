// Modelo y construcción del Excel v2 (2 hojas por laboratorio + hoja oculta `_meta`).
// PURO: no importa Firebase ni SheetJS; recibe la instancia de SheetJS inyectada.
import {
  META_SHEET,
  SCHEMA_VERSION,
  REGISTRO_FIELDS,
  UNIDAD_FIELDS,
  isInsumo,
  normText,
  parseCantidad,
  parseFecha,
  boolLabel,
  estadoLabel,
  parseEstado,
  uniqueSheetName,
  sanitizeSheetName,
} from './columns.js';

const isActive = (x) => x?.activo !== false;

export function registroRow(item, { codigo } = {}) {
  const ins = isInsumo(item.tipo);
  const cant = parseCantidad(item.cantidad);
  const fecha = parseFecha(item.fechaVencimiento);
  const estadoKey = parseEstado(item.estado) || 'bueno';
  return [
    item.id ?? '',
    codigo ?? item.codigo ?? '',
    normText(item.equipo),
    normText(item.tipo),
    normText(item.marca),
    normText(item.modelo),
    cant.ok && !cant.empty ? cant.value : normText(item.cantidad),
    normText(item.ubicacion),
    normText(item.columnadelocalizacion),
    ins ? normText(item.numeroSerie) : '',
    ins ? normText(item.codigoFundaempresa) : '',
    normText(item.observaciones),
    boolLabel(item.tieneVencimiento === true),
    item.tieneVencimiento === true && fecha.ok && !fecha.empty ? fecha.value : '',
    ins ? estadoLabel(estadoKey) : '',
    boolLabel(isActive(item)),
  ];
}

export function unidadRow(u, registro) {
  const estadoKey = parseEstado(u.estado) || 'bueno';
  return [
    u.id ?? '',
    u.itemId ?? registro?.id ?? '',
    u.codigo ?? '',
    normText(registro?.equipo),
    normText(u.numeroSerie),
    normText(u.codigoFundaempresa),
    estadoLabel(estadoKey),
    normText(u.observaciones),
    boolLabel(isActive(u)),
  ];
}

/**
 * Construye el modelo de hojas.
 * @param {{labs: Array<{id,name}>, itemsByLab: Record<string, any[]>, unitsByItem: Record<string, any[]>,
 *          incluirBajas?: boolean, exportadoEn?: string}} input
 */
export function buildExportModel({ labs, itemsByLab, unitsByItem = {}, incluirBajas = false, exportadoEn }) {
  const used = new Set();
  const sheets = [];
  const exportDate = exportadoEn || new Date().toISOString();

  for (const lab of labs) {
    if (lab.activo === false && !incluirBajas) continue;
    let items = itemsByLab[lab.id] || [];
    if (!incluirBajas) items = items.filter(isActive);

    const regName = uniqueSheetName(lab.name || 'Laboratorio', used);
    sheets.push({
      name: regName,
      kind: 'registros',
      idLab: lab.id,
      labName: lab.name || '',
      headers: REGISTRO_FIELDS.map((f) => f.header),
      hiddenCols: REGISTRO_FIELDS.map((f, i) => (f.hidden ? i : -1)).filter((i) => i >= 0),
      rows: items.map((it) => registroRow(it)),
    });

    const unitRows = [];
    for (const it of items) {
      if (isInsumo(it.tipo)) continue;
      let us = unitsByItem[it.id] || [];
      if (!incluirBajas) us = us.filter(isActive);
      for (const u of us) unitRows.push(unidadRow({ ...u, itemId: u.itemId ?? it.id }, it));
    }
    if (unitRows.length > 0) {
      const base = sanitizeSheetName(lab.name || 'Laboratorio').slice(0, 27) + ' (U)';
      sheets.push({
        name: uniqueSheetName(base, used),
        kind: 'unidades',
        idLab: lab.id,
        labName: lab.name || '',
        headers: UNIDAD_FIELDS.map((f) => f.header),
        hiddenCols: UNIDAD_FIELDS.map((f, i) => (f.hidden ? i : -1)).filter((i) => i >= 0),
        rows: unitRows,
      });
    }
  }

  return {
    meta: { version: SCHEMA_VERSION, exportadoEn: exportDate, incluyeBajas: !!incluirBajas },
    sheets,
  };
}

export function metaRows(model) {
  const rows = [
    ['clave', 'valor'],
    ['version', model.meta.version],
    ['exportadoEn', model.meta.exportadoEn],
    ['incluyeBajas', model.meta.incluyeBajas ? 'Sí' : 'No'],
    [],
    ['hoja', 'tipo', 'idLab', 'laboratorio'],
  ];
  for (const s of model.sheets) rows.push([s.name, s.kind, s.idLab, s.labName]);
  return rows;
}

/** Crea el workbook SheetJS a partir del modelo. `XLSX` es la instancia de SheetJS. */
export function buildWorkbook(XLSX, model) {
  const wb = XLSX.utils.book_new();
  for (const s of model.sheets) {
    const ws = XLSX.utils.aoa_to_sheet([s.headers, ...s.rows]);
    ws['!cols'] = s.headers.map((h, i) => ({ wch: Math.max(12, Math.min(40, String(h).length + 6)), hidden: s.hiddenCols.includes(i) }));
    if (s.headers.length > 0) {
      const lastCol = XLSX.utils.encode_col(s.headers.length - 1);
      ws['!autofilter'] = { ref: `A1:${lastCol}${Math.max(1, s.rows.length + 1)}` };
    }
    XLSX.utils.book_append_sheet(wb, ws, s.name);
  }
  const meta = XLSX.utils.aoa_to_sheet(metaRows(model));
  XLSX.utils.book_append_sheet(wb, meta, META_SHEET);
  wb.Workbook = { Sheets: wb.SheetNames.map((n) => ({ Hidden: n === META_SHEET ? 1 : 0 })) };
  return wb;
}

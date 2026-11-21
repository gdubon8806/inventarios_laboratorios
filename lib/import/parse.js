// Lectura del Excel v2 -> filas crudas. PURO: la instancia de SheetJS (`XLSX`) se inyecta.
import {
  META_SHEET,
  SCHEMA_VERSION,
  REGISTRO_FIELDS,
  UNIDAD_FIELDS,
  REGISTRO_REQUIRED_HEADERS,
  UNIDAD_REQUIRED_HEADERS,
  headerLookup,
  normText,
  normHeader,
} from './columns.js';

const REG_LOOKUP = headerLookup(REGISTRO_FIELDS);
const UNI_LOOKUP = headerLookup(UNIDAD_FIELDS);

export function readWorkbookBuffer(XLSX, buffer) {
  // cellDates=false (por defecto): las fechas llegan como serial numérico o texto; ambos se manejan en parseFecha.
  return XLSX.read(buffer, { type: 'array' });
}

function sheetRows(XLSX, ws) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: false });
}

function parseMeta(rows) {
  const meta = { version: null, exportadoEn: null, incluyeBajas: false, sheets: [] };
  let inSheets = false;
  for (const r of rows) {
    const k = normHeader(r[0] ?? '');
    if (!inSheets) {
      if (k === 'version') meta.version = Number(r[1]);
      else if (k === 'exportadoen') meta.exportadoEn = normText(r[1]) || null;
      else if (k === 'incluyebajas') meta.incluyeBajas = normHeader(r[1] ?? '') === 'si';
      else if (k === 'hoja') inSheets = true;
    } else if (normText(r[0]) !== '') {
      meta.sheets.push({
        name: normText(r[0]),
        kind: normHeader(r[1] ?? ''),
        idLab: normText(r[2]),
        labName: normText(r[3]),
      });
    }
  }
  return meta;
}

/**
 * @returns {{ meta, registros: object[], unidades: object[], fileErrors: {code,message}[] }}
 * Cada fila lleva `_sheet`, `_row` (fila de Excel, 1-based) e `_idLab` (según `_meta`).
 */
export function parseWorkbook(XLSX, wb) {
  const fileErrors = [];
  const out = { meta: null, registros: [], unidades: [], fileErrors };

  const metaWs = wb?.Sheets?.[META_SHEET];
  if (!metaWs) {
    fileErrors.push({
      code: 'E_FILE_META',
      message: 'El archivo no tiene la hoja oculta "_meta": no es una exportación válida de esta app. Descargue una nueva exportación y edítela.',
    });
    return out;
  }
  const meta = parseMeta(sheetRows(XLSX, metaWs));
  out.meta = meta;
  if (meta.version !== SCHEMA_VERSION) {
    fileErrors.push({
      code: 'E_FILE_VERSION',
      message: `Versión de esquema ${meta.version ?? 'desconocida'} no soportada (se esperaba ${SCHEMA_VERSION}). Descargue una exportación nueva.`,
    });
    return out;
  }
  if (!meta.exportadoEn || Number.isNaN(Date.parse(meta.exportadoEn))) {
    fileErrors.push({ code: 'E_FILE_META', message: 'La hoja "_meta" no tiene una fecha de exportación válida.' });
  }
  if (meta.sheets.length === 0) {
    fileErrors.push({ code: 'E_FILE_META', message: 'La hoja "_meta" no lista ninguna hoja de datos.' });
  }

  for (const s of meta.sheets) {
    const ws = wb.Sheets[s.name];
    if (!ws) {
      fileErrors.push({ code: 'E_SHEET_MISSING', message: `Falta la hoja "${s.name}" (laboratorio "${s.labName}"). No se puede omitir ni renombrar.` });
      continue;
    }
    if (s.kind !== 'registros' && s.kind !== 'unidades') {
      fileErrors.push({ code: 'E_FILE_META', message: `Tipo de hoja desconocido para "${s.name}".` });
      continue;
    }
    const rows = sheetRows(XLSX, ws);
    if (rows.length === 0) {
      fileErrors.push({ code: 'E_SHEET_EMPTY', message: `La hoja "${s.name}" está vacía (sin encabezados).` });
      continue;
    }
    const lookup = s.kind === 'registros' ? REG_LOOKUP : UNI_LOOKUP;
    const required = s.kind === 'registros' ? REGISTRO_REQUIRED_HEADERS : UNIDAD_REQUIRED_HEADERS;
    const fields = s.kind === 'registros' ? REGISTRO_FIELDS : UNIDAD_FIELDS;

    const colKey = rows[0].map((h) => lookup.get(normHeader(h ?? '')) || null);
    const present = new Set(colKey.filter(Boolean));
    const missing = required.filter((k) => !present.has(k));
    if (missing.length > 0) {
      const names = missing.map((k) => fields.find((f) => f.key === k)?.header || k);
      fileErrors.push({ code: 'E_COLUMNS', message: `La hoja "${s.name}" no tiene las columnas obligatorias: ${names.join(', ')}.` });
      continue;
    }

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (r.every((c) => normText(c) === '')) continue;
      const obj = { _sheet: s.name, _row: i + 1, _idLab: s.idLab, _labName: s.labName };
      colKey.forEach((k, ci) => {
        if (k) obj[k] = r[ci] ?? '';
      });
      (s.kind === 'registros' ? out.registros : out.unidades).push(obj);
    }
  }
  return out;
}

// Fixtures compartidas por los tests de lib/import (no es un test).
import * as XLSX from '../../vendor/xlsx.mjs';
import { buildExportModel, buildWorkbook } from './workbook.js';
import { REGISTRO_FIELDS, UNIDAD_FIELDS } from './columns.js';
import { parseWorkbook, readWorkbookBuffer } from './parse.js';
import { validateImport } from './validate.js';

export { XLSX };
export const EXPORT_AT = '2026-11-21T10:00:00.000Z';
const OLD = '2026-11-01T00:00:00.000Z';
const NEWER = '2026-11-22T00:00:00.000Z';
export { OLD, NEWER };

export function makeCurrent() {
  const labs = [
    { id: 'L1', name: 'Redes 1' },
    { id: 'L2', name: 'Química' },
  ];
  const base = { activo: true, ultimaModificacion: OLD };
  const items = [
    // i1: Equipo con 3 unidades (código por unidad, el registro no lleva código)
    { ...base, id: 'i1', idLab: 'L1', equipo: 'Router', marca: 'Cisco', modelo: '2901', tipo: 'Equipo', cantidad: 3, ubicacion: 'A1', columnadelocalizacion: 'C1', observaciones: 'ok', tieneVencimiento: false },
    // i2: Insumo con código en el registro
    { ...base, id: 'i2', idLab: 'L1', equipo: 'Cable UTP', marca: 'Belden', modelo: 'Cat6', tipo: 'Suministro', cantidad: 50, ubicacion: 'B2', columnadelocalizacion: '', observaciones: '', codigo: 'INS-000001', numeroSerie: '', codigoFundaempresa: '', estado: 'bueno', tieneVencimiento: true, fechaVencimiento: '2027-01-31' },
    // i3: Mobiliario legado sin código, cantidad string, sin unidades
    { ...base, id: 'i3', idLab: 'L1', equipo: 'Silla', marca: 'X', modelo: 'Y', tipo: 'Mobiliario', cantidad: '5', ubicacion: '', columnadelocalizacion: '', observaciones: [] },
    // i4: legado incongruente (sin tipo, cantidad rara)
    { ...base, id: 'i4', idLab: 'L2', equipo: 'Cosa rara', marca: '', modelo: '', tipo: '', cantidad: '5 pzas', ubicacion: '', columnadelocalizacion: '', observaciones: '' },
    // i5: Herramienta con 2 unidades en otro lab
    { ...base, id: 'i5', idLab: 'L2', equipo: 'Taladro', marca: 'Bosch', modelo: 'GSB', tipo: 'Herramienta', cantidad: 2, ubicacion: '', columnadelocalizacion: '', observaciones: '' },
  ];
  const unidades = [
    { ...base, id: 'u1', itemId: 'i1', idLab: 'L1', codigo: 'EQU-000001', numeroSerie: 'SN1', codigoFundaempresa: 'F1', estado: 'bueno', observaciones: 'obs1' },
    { ...base, id: 'u2', itemId: 'i1', idLab: 'L1', codigo: 'EQU-000002', numeroSerie: 'SN2', codigoFundaempresa: '', estado: 'bueno', observaciones: '' },
    { ...base, id: 'u3', itemId: 'i1', idLab: 'L1', codigo: 'EQU-000003', numeroSerie: '', codigoFundaempresa: '', estado: 'malo', observaciones: '' },
    { ...base, id: 'u4', itemId: 'i5', idLab: 'L2', codigo: 'HER-000001', numeroSerie: '', codigoFundaempresa: '', estado: 'bueno', observaciones: '' },
    { ...base, id: 'u5', itemId: 'i5', idLab: 'L2', codigo: 'HER-000002', numeroSerie: '', codigoFundaempresa: '', estado: 'bueno', observaciones: '' },
  ];
  return { labs, items, unidades };
}

export function exportModel(current, opts = {}) {
  const itemsByLab = {};
  for (const it of current.items) (itemsByLab[it.idLab] ||= []).push(it);
  const unitsByItem = {};
  for (const u of current.unidades) (unitsByItem[u.itemId] ||= []).push(u);
  return buildExportModel({ labs: current.labs, itemsByLab, unitsByItem, exportadoEn: EXPORT_AT, ...opts });
}

const colIndex = (fields, key) => fields.findIndex((f) => f.key === key);

/** Localiza una fila del modelo por id (registro) o id (unidad). */
export function findRow(model, kind, id) {
  for (const s of model.sheets) {
    if (s.kind !== kind) continue;
    const i = s.rows.findIndex((r) => r[0] === id);
    if (i >= 0) return { sheet: s, index: i, row: s.rows[i] };
  }
  throw new Error(`fila ${kind}:${id} no encontrada`);
}

export function setCell(model, kind, id, key, value) {
  const { row } = findRow(model, kind, id);
  const fields = kind === 'registros' ? REGISTRO_FIELDS : UNIDAD_FIELDS;
  row[colIndex(fields, key)] = value;
}

export function addRow(model, kind, labId, partial) {
  const sheet = model.sheets.find((s) => s.kind === kind && s.idLab === labId);
  const fields = kind === 'registros' ? REGISTRO_FIELDS : UNIDAD_FIELDS;
  const row = fields.map(() => '');
  for (const [k, v] of Object.entries(partial)) row[colIndex(fields, k)] = v;
  sheet.rows.push(row);
  return row;
}

export function removeRow(model, kind, id) {
  const { sheet, index } = findRow(model, kind, id);
  sheet.rows.splice(index, 1);
}

/** modelo -> xlsx en memoria -> parse -> validación contra `current` (ida y vuelta completa por SheetJS). */
export function run(model, current) {
  const wb = buildWorkbook(XLSX, model);
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const parsed = parseWorkbook(XLSX, readWorkbookBuffer(XLSX, buf));
  return { parsed, report: validateImport({ parsed, current }) };
}

export const codes = (res) => res.issues.map((i) => i.code);
export function rowOf(report, kind, id) {
  return report.rows.find((r) => r.kind === kind && r.id === id);
}
export function newRows(report) {
  return report.rows.filter((r) => r.status === 'new' || (r.kind && r.id === ''));
}

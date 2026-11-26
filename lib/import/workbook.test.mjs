import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExportModel, buildWorkbook, unidadRow } from './workbook.js';
import { META_SHEET, UNIDAD_FIELDS, parseBool, parseCantidad, parseFecha, sanitizeSheetName, uniqueSheetName, canonicalTipo, parseEstado } from './columns.js';
import { parseWorkbook, readWorkbookBuffer } from './parse.js';
import { XLSX, exportModel, makeCurrent } from './fixtures.mjs';

test('modelo: 2 hojas por laboratorio (Registros + Unidades) y _meta con id de lab por hoja', () => {
  const current = makeCurrent();
  const model = exportModel(current);
  const kinds = model.sheets.map((s) => `${s.idLab}:${s.kind}`);
  assert.deepEqual(kinds, ['L1:registros', 'L1:unidades', 'L2:registros', 'L2:unidades']);
  assert.equal(model.sheets[0].name, 'Redes 1');
  assert.equal(model.sheets[2].name, 'Química');
  assert.ok(model.sheets.every((s) => s.name.length <= 31));
});

test('modelo: el registro no-insumo no lleva código ni serie/estado; el insumo sí', () => {
  const model = exportModel(makeCurrent());
  const regs = model.sheets[0].rows;
  const i1 = regs.find((r) => r[0] === 'i1');
  const i2 = regs.find((r) => r[0] === 'i2');
  assert.equal(i1[1], ''); // código
  assert.equal(i1[14], ''); // estado
  assert.equal(i2[1], 'INS-000001');
  assert.equal(i2[14], 'Bueno');
  assert.equal(i2[13], '2027-01-31'); // fecha ISO como texto
  const units = model.sheets[1].rows;
  assert.deepEqual(units.map((r) => r[2]), ['EQU-000001', 'EQU-000002', 'EQU-000003']);
});

test('export: solo activos por defecto; incluirBajas agrega los dados de baja', () => {
  const current = makeCurrent();
  current.items[2].activo = false;
  current.unidades[0].activo = false;
  const solo = exportModel(current);
  assert.equal(solo.sheets[0].rows.some((r) => r[0] === 'i3'), false);
  assert.equal(solo.sheets[1].rows.some((r) => r[0] === 'u1'), false);
  const todo = exportModel(current, { incluirBajas: true });
  assert.equal(todo.sheets[0].rows.find((r) => r[0] === 'i3')[15], 'No');
  const colActivo = todo.sheets[1].headers.indexOf('Activo'); // la columna se ubica por su encabezado, no por posición fija
  assert.equal(todo.sheets[1].rows.find((r) => r[0] === 'u1')[colActivo], 'No');
  assert.equal(todo.meta.incluyeBajas, true);
});

test('export: laboratorio dado de baja no se exporta salvo incluirBajas', () => {
  const current = makeCurrent();
  current.labs[1].activo = false;
  assert.equal(exportModel(current).sheets.some((s) => s.idLab === 'L2'), false);
  assert.equal(exportModel(current, { incluirBajas: true }).sheets.some((s) => s.idLab === 'L2'), true);
});

test('nombres de hoja: saneados, ≤31 caracteres, únicos y distintos de _meta', () => {
  assert.equal(sanitizeSheetName('Lab: Química/Física [A]?'), 'Lab Química Física A');
  assert.equal(sanitizeSheetName(''), 'Hoja');
  assert.equal(sanitizeSheetName('x'.repeat(50)).length, 31);
  const used = new Set();
  const a = uniqueSheetName('Redes', used);
  const b = uniqueSheetName('redes', used);
  const c = uniqueSheetName('_meta', used);
  assert.notEqual(a.toLowerCase(), b.toLowerCase());
  assert.notEqual(c.toLowerCase(), META_SHEET);
  const largo = 'Laboratorio de Electrónica Digital Avanzada y Control';
  const labs = [{ id: 'A', name: largo }, { id: 'B', name: largo }];
  const model = buildExportModel({ labs, itemsByLab: { A: [], B: [] }, unitsByItem: {} });
  const names = model.sheets.map((s) => s.name.toLowerCase());
  assert.equal(new Set(names).size, names.length);
  assert.ok(model.sheets.every((s) => s.name.length <= 31));
});

test('workbook: _meta oculta, columnas ID ocultas, y el ciclo exportar→leer conserva todo', () => {
  const model = exportModel(makeCurrent());
  const wb = buildWorkbook(XLSX, model);
  assert.equal(wb.SheetNames.at(-1), META_SHEET);
  assert.equal(wb.Workbook.Sheets.find((s, i) => wb.SheetNames[i] === META_SHEET).Hidden, 1);
  assert.equal(wb.Sheets['Redes 1']['!cols'][0].hidden, true); // ID
  assert.equal(wb.Sheets['Redes 1']['!cols'][1].hidden, false); // Código visible

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const parsed = parseWorkbook(XLSX, readWorkbookBuffer(XLSX, buf));
  assert.deepEqual(parsed.fileErrors, []);
  assert.equal(parsed.meta.version, 1);
  assert.equal(parsed.meta.exportadoEn, model.meta.exportadoEn);
  assert.equal(parsed.meta.sheets.length, 4);
  assert.equal(parsed.registros.length, 5);
  assert.equal(parsed.unidades.length, 5);
  const r = parsed.registros.find((x) => x.id === 'i2');
  assert.equal(r.codigo, 'INS-000001');
  assert.equal(r._idLab, 'L1');
  assert.equal(r._sheet, 'Redes 1');
});

test('serie con ceros a la izquierda se conserva como texto en la ida y vuelta', () => {
  const current = makeCurrent();
  current.unidades[0].numeroSerie = '000123';
  const model = exportModel(current);
  const wb = buildWorkbook(XLSX, model);
  const parsed = parseWorkbook(XLSX, readWorkbookBuffer(XLSX, XLSX.write(wb, { type: 'array', bookType: 'xlsx' })));
  assert.equal(String(parsed.unidades.find((u) => u.id === 'u1').serie), '000123');
});

test('helpers: fechas, cantidades, booleanos, tipos y estados', () => {
  assert.equal(parseFecha(46096).value, '2026-03-15'); // serial de Excel
  assert.equal(parseFecha('2026-3-5').value, '2026-03-05');
  assert.equal(parseFecha('05/03/2026').value, '2026-03-05');
  assert.equal(parseFecha(new Date(2026, 2, 5)).value, '2026-03-05');
  assert.equal(parseFecha({ toDate: () => new Date(2026, 2, 5, 12) }).value, '2026-03-05');
  assert.equal(parseFecha('').empty, true);
  assert.equal(parseFecha('2026-02-29').ok, false);
  assert.equal(parseFecha('2024-02-29').ok, true);
  assert.equal(parseCantidad('12').value, 12);
  assert.equal(parseCantidad('12,0').value, 12);
  assert.equal(parseCantidad('1.5').ok, false);
  assert.equal(parseCantidad(-3).ok, false);
  assert.equal(parseCantidad('').empty, true);
  assert.equal(parseBool('Sí'), true);
  assert.equal(parseBool('no'), false);
  assert.equal(parseBool(''), null);
  assert.equal(parseBool('quizás'), undefined);
  assert.equal(canonicalTipo('Insumo'), 'Suministro');
  assert.equal(canonicalTipo('  mobiliario '), 'Mobiliario');
  assert.equal(canonicalTipo('Otro'), null);
  assert.equal(parseEstado('Reparación'), 'reparacion');
  assert.equal(parseEstado('Reportado'), undefined);
});

// Guardia de consistencia con lib/codes (otro módulo puro): si cambian umbrales o prefijos, este test avisa.
import { THRESHOLDS as IMPORT_TH, PREFIJOS } from './columns.js';
import { THRESHOLDS as CODES_TH } from '../codes/thresholds.js';
import { TIPO_TO_PREFIX } from '../codes/prefixes.js';

test('constantes de import coinciden con lib/codes (umbrales D11 y prefijos)', () => {
  assert.deepEqual(PREFIJOS, TIPO_TO_PREFIX);
  for (const [tipo, prefix] of Object.entries(PREFIJOS)) assert.equal(IMPORT_TH[tipo], CODES_TH[prefix].max, tipo);
});

test('unidadRow: cada unidad lleva nombre, tipo, marca, modelo, ubicación, columna y cantidad del registro (la unidad puede tener su marca)', () => {
  const reg = { id: 'r1', equipo: 'Multímetro', tipo: 'Herramienta', marca: 'Fluke', modelo: '117', ubicacion: 'Cajón 2', columnadelocalizacion: 'B1', cantidad: 15 };
  const fila = unidadRow({ id: 'u1', itemId: 'r1', codigo: 'HER-000001', marca: 'Uni-T' }, reg);
  const h = UNIDAD_FIELDS.map((f) => f.header);
  assert.equal(fila.length, h.length);
  const col = (n) => fila[h.indexOf(n)];
  assert.equal(col('Registro'), 'Multímetro');
  assert.equal(col('Tipo'), 'Herramienta');
  assert.equal(col('Marca'), 'Uni-T'); // marca propia de la unidad
  assert.equal(col('Modelo'), '117'); // sin modelo propio: el del registro
  assert.equal(col('Ubicación'), 'Cajón 2');
  assert.equal(col('Columna de localización'), 'B1');
  assert.equal(col('Cantidad del registro'), 15);
});

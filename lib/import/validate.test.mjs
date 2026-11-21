import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmationsSatisfied } from './validate.js';
import { parseWorkbook, readWorkbookBuffer } from './parse.js';
import { validateImport } from './validate.js';
import { buildWorkbook } from './workbook.js';
import { META_SHEET } from './columns.js';
import { NEWER, XLSX, addRow, codes, exportModel, makeCurrent, removeRow, rowOf, run, setCell } from './fixtures.mjs';

const errCodes = (res) => res.issues.filter((i) => i.level === 'error').map((i) => i.code);
const warnCodes = (res) => res.issues.filter((i) => i.level === 'warning').map((i) => i.code);

function ctx() {
  const current = makeCurrent();
  return { current, model: exportModel(current) };
}

// ---------------------------------------------------------------------------------------------
test('exportación sin tocar: 0 cambios, 0 errores, nada que aplicar', () => {
  const { current, model } = ctx();
  const { report } = run(model, current);
  assert.deepEqual(report.fileErrors, []);
  assert.equal(report.summary.errorRows, 0);
  assert.equal(report.summary.modified + report.summary.new + report.summary.removed, 0);
  assert.equal(report.summary.unchanged, report.rows.length);
  assert.equal(report.canApply, false);
});

// ---------------------------------------------------------------------------------------------
test('archivo: sin _meta / versión distinta / hoja faltante / columnas faltantes', () => {
  const { current, model } = ctx();
  const wb = buildWorkbook(XLSX, model);

  const sinMeta = structuredClone({ SheetNames: wb.SheetNames.filter((n) => n !== META_SHEET), Sheets: { ...wb.Sheets } });
  delete sinMeta.Sheets[META_SHEET];
  assert.equal(validateImport({ parsed: parseWorkbook(XLSX, sinMeta), current }).fileErrors[0].code, 'E_FILE_META');

  const metaWs = wb.Sheets[META_SHEET];
  const verCell = Object.keys(metaWs).find((k) => metaWs[k].v === 1);
  metaWs[verCell].v = 99;
  assert.equal(parseWorkbook(XLSX, wb).fileErrors[0].code, 'E_FILE_VERSION');
  metaWs[verCell].v = 1;

  const firstSheet = model.sheets[0].name;
  const saved = wb.Sheets[firstSheet];
  delete wb.Sheets[firstSheet];
  assert.ok(parseWorkbook(XLSX, wb).fileErrors.some((e) => e.code === 'E_SHEET_MISSING'));
  wb.Sheets[firstSheet] = saved;

  saved.B1.v = 'Cualquier cosa'; // columna "Código" renombrada
  const pe = parseWorkbook(XLSX, wb);
  assert.ok(pe.fileErrors.some((e) => e.code === 'E_COLUMNS'));
  assert.equal(validateImport({ parsed: pe, current }).canApply, false);
});

// ---------------------------------------------------------------------------------------------
test('código: no se puede cambiar, borrar ni inventar', () => {
  let { current, model } = ctx();
  setCell(model, 'unidades', 'u1', 'codigo', 'EQU-000999');
  let { report } = run(model, current);
  assert.ok(errCodes(rowOf(report, 'unidad', 'u1')).includes('E_CODE_CHANGED'));
  assert.equal(report.canApply, false);

  ({ current, model } = ctx());
  setCell(model, 'unidades', 'u1', 'codigo', '');
  ({ report } = run(model, current));
  assert.ok(errCodes(rowOf(report, 'unidad', 'u1')).includes('E_CODE_MISSING'));

  ({ current, model } = ctx());
  setCell(model, 'registros', 'i2', 'codigo', 'INS-000777');
  ({ report } = run(model, current));
  assert.ok(errCodes(rowOf(report, 'registro', 'i2')).includes('E_CODE_CHANGED'));

  // registro legado sin código al que le escriben uno: lo asigna el sistema, no el usuario
  ({ current, model } = ctx());
  setCell(model, 'registros', 'i3', 'codigo', 'MOB-000001');
  ({ report } = run(model, current));
  assert.ok(errCodes(rowOf(report, 'registro', 'i3')).includes('E_CODE_INVENTED'));
});

test('código: prefijo no coincide con el tipo y formato inválido', () => {
  const { current, model } = ctx();
  setCell(model, 'registros', 'i2', 'codigo', 'EQU-000001'); // insumo con prefijo EQU
  setCell(model, 'unidades', 'u4', 'codigo', 'XYZ-1');
  const { report } = run(model, current);
  assert.ok(errCodes(rowOf(report, 'registro', 'i2')).includes('E_PREFIX_TYPE'));
  assert.ok(errCodes(rowOf(report, 'unidad', 'u4')).includes('E_CODE_FORMAT'));
});

test('código: duplicado dentro del archivo', () => {
  const { current, model } = ctx();
  setCell(model, 'unidades', 'u2', 'codigo', 'EQU-000001'); // igual al de u1
  const { report } = run(model, current);
  assert.ok(errCodes(rowOf(report, 'unidad', 'u2')).includes('E_CODE_DUP_FILE'));
  assert.ok(errCodes(rowOf(report, 'unidad', 'u1')).includes('E_CODE_DUP_FILE'));
});

test('filas nuevas: con código ajeno o inventado -> error', () => {
  let { current, model } = ctx();
  addRow(model, 'registros', 'L1', { nombre: 'Nuevo', tipo: 'Suministro', cantidad: 3, codigo: 'INS-000001', activo: 'Sí' });
  let { report } = run(model, current);
  assert.ok(report.rows.some((r) => r.status === 'error' && errCodes(r).includes('E_CODE_ON_NEW')));

  ({ current, model } = ctx());
  addRow(model, 'registros', 'L1', { nombre: 'Nuevo', tipo: 'Suministro', cantidad: 3, codigo: 'INS-009999' });
  ({ report } = run(model, current));
  assert.ok(report.rows.some((r) => errCodes(r).includes('E_CODE_INVENTED')));
});

// ---------------------------------------------------------------------------------------------
test('tipo: cambiar el tipo de un registro con código/unidades -> error', () => {
  const { current, model } = ctx();
  setCell(model, 'registros', 'i1', 'tipo', 'Mobiliario');
  setCell(model, 'registros', 'i2', 'tipo', 'Equipo');
  const { report } = run(model, current);
  assert.ok(errCodes(rowOf(report, 'registro', 'i1')).includes('E_TYPE_CHANGED'));
  assert.ok(errCodes(rowOf(report, 'registro', 'i2')).includes('E_TYPE_CHANGED'));
});

test('tipo: fuera del catálogo / vacío -> error; reparar dato incongruente sin código -> amarillo', () => {
  let { current, model } = ctx();
  setCell(model, 'registros', 'i3', 'tipo', 'Gadget');
  let { report } = run(model, current);
  assert.ok(errCodes(rowOf(report, 'registro', 'i3')).includes('E_TYPE_INVALID'));

  ({ current, model } = ctx());
  setCell(model, 'registros', 'i1', 'tipo', '');
  ({ report } = run(model, current));
  assert.ok(errCodes(rowOf(report, 'registro', 'i1')).includes('E_EMPTIED'));

  // i4: sin tipo y sin código -> asignar un tipo válido es una reparación permitida (D13)
  ({ current, model } = ctx());
  setCell(model, 'registros', 'i4', 'tipo', 'Equipo');
  setCell(model, 'registros', 'i4', 'cantidad', 5);
  ({ report } = run(model, current));
  const r = rowOf(report, 'registro', 'i4');
  assert.equal(r.status, 'modified');
  assert.deepEqual(r.changes.map((c) => c.field).sort(), ['cantidad', 'tipo']);
  assert.equal(report.canApply, true);
});

test('tipo: se acepta "Insumo" y distinta capitalización como el mismo tipo', () => {
  const { current, model } = ctx();
  setCell(model, 'registros', 'i2', 'tipo', 'insumo');
  setCell(model, 'registros', 'i1', 'tipo', 'EQUIPO');
  const { report } = run(model, current);
  assert.equal(rowOf(report, 'registro', 'i2').status, 'unchanged');
  assert.equal(rowOf(report, 'registro', 'i1').status, 'unchanged');
});

// ---------------------------------------------------------------------------------------------
test('cantidad: inválida (texto, decimal, negativa) -> error', () => {
  for (const bad of ['abc', 2.5, -1, '3 pzas']) {
    const { current, model } = ctx();
    setCell(model, 'registros', 'i2', 'cantidad', bad);
    const { report } = run(model, current);
    assert.ok(errCodes(rowOf(report, 'registro', 'i2')).includes('E_QTY_INVALID'), `cantidad=${bad}`);
  }
});

test('cantidad: registro con unidades no se cambia por Excel; insumo sí (amarillo); legado sin unidades sí', () => {
  const { current, model } = ctx();
  setCell(model, 'registros', 'i1', 'cantidad', 10); // 3 unidades activas
  setCell(model, 'registros', 'i2', 'cantidad', 60); // insumo
  setCell(model, 'registros', 'i3', 'cantidad', 8); // mobiliario legado sin unidades
  const { report } = run(model, current);
  assert.ok(errCodes(rowOf(report, 'registro', 'i1')).includes('E_QTY_CHANGED_UNITS'));
  assert.equal(rowOf(report, 'registro', 'i2').status, 'modified');
  assert.equal(rowOf(report, 'registro', 'i3').status, 'modified');
});

test('cantidad: vacía donde había valor -> error', () => {
  const { current, model } = ctx();
  setCell(model, 'registros', 'i2', 'cantidad', '');
  const { report } = run(model, current);
  assert.ok(errCodes(rowOf(report, 'registro', 'i2')).includes('E_EMPTIED'));
});

// ---------------------------------------------------------------------------------------------
test('campo lleno que queda vacío -> error (registro y unidad)', () => {
  const { current, model } = ctx();
  setCell(model, 'registros', 'i1', 'marca', '');
  setCell(model, 'registros', 'i1', 'observaciones', '');
  setCell(model, 'unidades', 'u1', 'serie', '');
  const { report } = run(model, current);
  const r = rowOf(report, 'registro', 'i1');
  assert.equal(errCodes(r).filter((c) => c === 'E_EMPTIED').length, 2);
  assert.ok(errCodes(rowOf(report, 'unidad', 'u1')).includes('E_EMPTIED'));
  assert.equal(report.canApply, false);
});

test('campo vacío que sigue vacío NO es error', () => {
  const { current, model } = ctx();
  const { report } = run(model, current);
  assert.equal(report.summary.errorRows, 0);
});

test('estado: vaciar un estado distinto de bueno -> error; valor inválido -> error; cambio válido -> amarillo', () => {
  let { current, model } = ctx();
  setCell(model, 'unidades', 'u3', 'estado', ''); // era malo
  let { report } = run(model, current);
  assert.ok(errCodes(rowOf(report, 'unidad', 'u3')).includes('E_EMPTIED'));

  ({ current, model } = ctx());
  setCell(model, 'unidades', 'u1', 'estado', 'Reportado'); // "reportado" es derivado, no un estado
  ({ report } = run(model, current));
  assert.ok(errCodes(rowOf(report, 'unidad', 'u1')).includes('E_ESTADO_INVALID'));

  ({ current, model } = ctx());
  setCell(model, 'unidades', 'u1', 'estado', 'Reparación');
  setCell(model, 'registros', 'i2', 'estado', 'Malo');
  ({ report } = run(model, current));
  assert.equal(rowOf(report, 'unidad', 'u1').status, 'modified');
  assert.equal(rowOf(report, 'registro', 'i2').status, 'modified');
  assert.equal(report.canApply, true);
});

test('serie/Fundaempresa/estado en registro con unidades se editan por unidad -> error', () => {
  const { current, model } = ctx();
  setCell(model, 'registros', 'i1', 'serie', 'ZZZ');
  const { report } = run(model, current);
  assert.ok(errCodes(rowOf(report, 'registro', 'i1')).includes('E_PER_UNIT'));
});

// ---------------------------------------------------------------------------------------------
test('amarillo: cambios de nombre/modelo/marca/ubicación/serie quedan como advertencia con resumen', () => {
  const { current, model } = ctx();
  setCell(model, 'registros', 'i1', 'nombre', 'Router Cisco');
  setCell(model, 'registros', 'i1', 'modelo', '2911');
  setCell(model, 'unidades', 'u2', 'serie', 'SN2-B');
  const { report } = run(model, current);
  const r = rowOf(report, 'registro', 'i1');
  assert.equal(r.status, 'modified');
  assert.deepEqual(r.changes.map((c) => c.field).sort(), ['modelo', 'nombre']);
  assert.ok(r.changes.every((c) => c.severity === 'warning'));
  assert.equal(r.changes.find((c) => c.field === 'modelo').old, '2901');
  assert.equal(r.changes.find((c) => c.field === 'modelo').new, '2911');
  assert.equal(report.summary.modified, 2);
  assert.equal(report.needsConfirm.warnings, 2);
  assert.equal(report.canApply, true);
  assert.equal(report.plan.updates.length, 2);
});

// ---------------------------------------------------------------------------------------------
test('vencimiento: obligatoria la fecha si tiene vencimiento = Sí', () => {
  let { current, model } = ctx();
  setCell(model, 'registros', 'i1', 'tieneVencimiento', 'Sí');
  let { report } = run(model, current);
  assert.ok(errCodes(rowOf(report, 'registro', 'i1')).includes('E_VENC_REQUIRED'));

  ({ current, model } = ctx());
  setCell(model, 'registros', 'i1', 'tieneVencimiento', 'Sí');
  setCell(model, 'registros', 'i1', 'fechaVencimiento', '2027-06-30');
  ({ report } = run(model, current));
  const r = rowOf(report, 'registro', 'i1');
  assert.equal(r.status, 'modified');
  assert.deepEqual(r.changes.map((c) => c.field).sort(), ['fechaVencimiento', 'tieneVencimiento']);
});

test('vencimiento: fechas inválidas o fuera de 2000–2100 -> error; serial de Excel y DD/MM/AAAA aceptados', () => {
  for (const bad of ['2026-02-30', '1999-12-31', '2101-01-01', 'mañana', '31/13/2026']) {
    const { current, model } = ctx();
    setCell(model, 'registros', 'i2', 'fechaVencimiento', bad);
    const { report } = run(model, current);
    assert.ok(errCodes(rowOf(report, 'registro', 'i2')).includes('E_DATE_INVALID'), `fecha=${bad}`);
  }
  const { current, model } = ctx();
  setCell(model, 'registros', 'i2', 'fechaVencimiento', 46096); // serial de Excel = 2026-03-15
  let { report } = run(model, current);
  assert.equal(rowOf(report, 'registro', 'i2').changes.find((c) => c.field === 'fechaVencimiento').new, '2026-03-15');

  const m2 = ctx().model;
  setCell(m2, 'registros', 'i2', 'fechaVencimiento', '15/03/2026');
  ({ report } = run(m2, ctx().current));
  assert.equal(rowOf(report, 'registro', 'i2').changes.find((c) => c.field === 'fechaVencimiento').new, '2026-03-15');
});

test('vencimiento: tiene = No con fecha escrita -> aviso y se ignora; pasar de Sí a No limpia la fecha', () => {
  const { current, model } = ctx();
  setCell(model, 'registros', 'i1', 'tieneVencimiento', 'No');
  setCell(model, 'registros', 'i1', 'fechaVencimiento', '2027-01-01');
  setCell(model, 'registros', 'i2', 'tieneVencimiento', 'No');
  setCell(model, 'registros', 'i2', 'fechaVencimiento', '');
  const { report } = run(model, current);
  assert.ok(warnCodes(rowOf(report, 'registro', 'i1')).includes('W_VENC_IGNORED'));
  assert.equal(rowOf(report, 'registro', 'i1').status, 'unchanged');
  const r2 = rowOf(report, 'registro', 'i2');
  assert.equal(r2.status, 'modified');
  assert.equal(r2.changes.find((c) => c.field === 'fechaVencimiento').newRaw, null);
});

// ---------------------------------------------------------------------------------------------
test('filas nuevas: validas, obligatorios y tipo del catálogo', () => {
  let { current, model } = ctx();
  addRow(model, 'registros', 'L1', { nombre: 'Etiquetas', tipo: 'Suministro', cantidad: 20 });
  let { report } = run(model, current);
  let n = report.rows.find((r) => r.status === 'new');
  assert.ok(n, 'fila nueva reconocida');
  assert.equal(report.summary.new, 1);
  assert.equal(report.plan.creates.length, 1);
  assert.equal(report.plan.creates[0].data.unidades, 0);
  assert.equal(report.canApply, true);

  ({ current, model } = ctx());
  addRow(model, 'registros', 'L1', { marca: 'solo marca' }); // una fila totalmente vacía se ignora
  ({ report } = run(model, current));
  const bad = report.rows.find((r) => r.id === '' && r.status === 'error');
  assert.equal(errCodes(bad).filter((c) => c === 'E_REQUIRED_NEW').length, 3);

  ({ current, model } = ctx());
  addRow(model, 'registros', 'L1', { nombre: 'X', tipo: 'Gadget', cantidad: 1 });
  ({ report } = run(model, current));
  assert.ok(report.rows.some((r) => errCodes(r).includes('E_TYPE_INVALID')));
});

test('filas nuevas: serie/estado de no-insumo se llenan por unidad -> error', () => {
  const { current, model } = ctx();
  addRow(model, 'registros', 'L1', { nombre: 'PC', tipo: 'Equipo', cantidad: 2, serie: 'ABC' });
  const { report } = run(model, current);
  assert.ok(report.rows.some((r) => errCodes(r).includes('E_PER_UNIT')));
});

test('umbrales D11: HER/EQU > 10, MOB > 20, INS > 100 exigen validación individual; el umbral exacto no', () => {
  const casos = [
    ['Herramienta', 10, false], ['Herramienta', 11, true],
    ['Equipo', 10, false], ['Equipo', 11, true],
    ['Mobiliario', 20, false], ['Mobiliario', 21, true],
    ['Suministro', 100, false], ['Suministro', 101, true],
  ];
  for (const [tipo, cant, expect] of casos) {
    const { current, model } = ctx();
    addRow(model, 'registros', 'L1', { nombre: `n-${tipo}`, tipo, cantidad: cant });
    const { report } = run(model, current);
    const r = report.rows.find((x) => x.status === 'new');
    assert.ok(r, `${tipo} ${cant}`);
    assert.equal(r.needsRowConfirm, expect, `${tipo} ${cant}`);
    assert.equal(report.needsConfirm.thresholdRowKeys.length, expect ? 1 : 0);
  }
});

test('umbral: subir la cantidad de un insumo por encima de 100 exige validación', () => {
  const { current, model } = ctx();
  setCell(model, 'registros', 'i2', 'cantidad', 150);
  const { report } = run(model, current);
  assert.equal(rowOf(report, 'registro', 'i2').needsRowConfirm, true);
  assert.ok(warnCodes(rowOf(report, 'registro', 'i2')).includes('W_THRESHOLD'));
});

test('unidades nuevas desde Excel no se permiten (la cantidad se deriva de las unidades)', () => {
  const { current, model } = ctx();
  addRow(model, 'unidades', 'L1', { registroId: 'i1', codigo: '', serie: 'N' });
  const { report } = run(model, current);
  assert.ok(report.rows.some((r) => errCodes(r).includes('E_UNIT_NEW_NOT_ALLOWED')));
});

// ---------------------------------------------------------------------------------------------
test('ausentes y Activo=No: baja lógica con confirmación; nunca borrado', () => {
  const { current, model } = ctx();
  removeRow(model, 'registros', 'i3'); // ausente
  setCell(model, 'unidades', 'u3', 'activo', 'No'); // baja explícita de una unidad
  const { report } = run(model, current);
  assert.equal(report.removedRows.length, 1);
  assert.equal(report.removedRows[0].id, 'i3');
  assert.equal(rowOf(report, 'unidad', 'u3').status, 'removed');
  assert.equal(report.summary.removed, 2);
  assert.equal(report.needsConfirm.bajas, 2);
  assert.equal(report.plan.bajas.length, 2);
  assert.equal(report.canApply, true);
});

test('Activo No -> Sí restaura', () => {
  const current = makeCurrent();
  current.unidades[1].activo = false; // u2 de baja
  const model = exportModel(current, { incluirBajas: true });
  setCell(model, 'unidades', 'u2', 'activo', 'Sí');
  const { report } = run(model, current);
  assert.equal(rowOf(report, 'unidad', 'u2').status, 'restored');
  assert.equal(report.plan.restores.length, 1);
});

test('ausentes: lo creado/modificado después de exportar se ignora, no se da de baja', () => {
  const { current, model } = ctx();
  current.items.push({ id: 'i9', idLab: 'L1', equipo: 'Nuevo en app', tipo: 'Suministro', cantidad: 1, activo: true, ultimaModificacion: NEWER, codigo: 'INS-000009' });
  const { report } = run(model, current);
  assert.equal(report.removedRows.length, 0);
  assert.equal(report.ignoredNewer.length, 1);
  assert.equal(report.ignoredNewer[0].id, 'i9');
});

test('ausentes: ítems de laboratorios fuera del archivo no se tocan; inactivos tampoco', () => {
  const current = makeCurrent();
  current.items[4].activo = false; // i5 ya de baja
  const model = exportModel(current); // i5 no se exporta
  const { report } = run(model, current);
  assert.equal(report.removedRows.length, 0);
});

// ---------------------------------------------------------------------------------------------
test('concurrencia: registro/unidad cambiados en la app tras exportar -> error si el Excel también los cambia', () => {
  const { current, model } = ctx();
  current.items[0].ultimaModificacion = NEWER;
  current.unidades[0].ultimaModificacion = NEWER;
  setCell(model, 'registros', 'i1', 'modelo', '2911'); // fila tocada en Excel
  setCell(model, 'unidades', 'u1', 'serie', 'NEW');
  const { report } = run(model, current);
  assert.ok(errCodes(rowOf(report, 'registro', 'i1')).includes('E_CONCURRENT'));
  assert.ok(errCodes(rowOf(report, 'unidad', 'u1')).includes('E_CONCURRENT'));
});

test('concurrencia: fila sin cambios no se bloquea aunque la app la haya tocado (no hay cambio que pisar)', () => {
  const { current, model } = ctx();
  current.items[1].ultimaModificacion = NEWER; // i2 cambió en la app, el Excel no la tocó
  const { report } = run(model, current);
  assert.equal(rowOf(report, 'registro', 'i2').status, 'unchanged');
});

test('ids: desconocido, duplicado y laboratorio cambiado -> error', () => {
  let { current, model } = ctx();
  setCell(model, 'registros', 'i3', 'id', 'zzz');
  let { report } = run(model, current);
  assert.ok(report.rows.some((r) => errCodes(r).includes('E_ID_UNKNOWN')));

  ({ current, model } = ctx());
  const dup = model.sheets[0].rows[0].slice();
  model.sheets[0].rows.push(dup);
  ({ report } = run(model, current));
  assert.ok(report.rows.some((r) => errCodes(r).includes('E_ID_DUP')));

  ({ current, model } = ctx());
  const { parsed } = run(model, current);
  parsed.registros[0]._idLab = 'L2';
  report = validateImport({ parsed, current });
  assert.ok(errCodes(report.rows[0]).includes('E_LAB_CHANGED'));
});

test('un archivo con errores nunca se puede aplicar, y al corregirlo se revalida limpio', () => {
  const { current, model } = ctx();
  setCell(model, 'unidades', 'u1', 'codigo', 'EQU-000999');
  setCell(model, 'registros', 'i1', 'nombre', 'Router Cisco');
  let { report } = run(model, current);
  assert.equal(report.canApply, false);
  assert.equal(confirmationsSatisfied(report, { warnings: true, bajas: true }), false);

  setCell(model, 'unidades', 'u1', 'codigo', 'EQU-000001'); // corregido
  ({ report } = run(model, current));
  assert.equal(report.canApply, true);
  assert.equal(report.summary.errorRows, 0);
});

test('confirmationsSatisfied exige amarillos, bajas y umbrales por fila', () => {
  const { current, model } = ctx();
  setCell(model, 'registros', 'i1', 'nombre', 'X');
  removeRow(model, 'registros', 'i3');
  addRow(model, 'registros', 'L1', { nombre: 'Lote', tipo: 'Suministro', cantidad: 500 });
  const { report } = run(model, current);
  assert.equal(confirmationsSatisfied(report, {}), false);
  assert.equal(confirmationsSatisfied(report, { warnings: true, bajas: true }), false);
  assert.equal(confirmationsSatisfied(report, { warnings: true, bajas: true, thresholdKeys: report.needsConfirm.thresholdRowKeys }), true);
});

test('incongruentes legados que no se tocan no bloquean (quedan sin cambios)', () => {
  const { current, model } = ctx();
  const { report } = run(model, current);
  assert.equal(rowOf(report, 'registro', 'i4').status, 'unchanged');
  assert.equal(report.summary.errorRows, 0);
});

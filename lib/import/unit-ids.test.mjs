// Las unidades reales usan IDs que se repiten en cada registro (items/{id}/unidades/u0001, u0002…).
// La importación debe identificar cada unidad por registro + ID, no solo por ID.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOps } from './apply.js';
import { UNIDAD_FIELDS } from './columns.js';
import { exportModel, makeCurrent, run } from './fixtures.mjs';

function currentWithRepeatedIds() {
  const current = makeCurrent();
  const perItem = {};
  for (const u of current.unidades) {
    perItem[u.itemId] = (perItem[u.itemId] || 0) + 1;
    u.id = `u${String(perItem[u.itemId]).padStart(4, '0')}`; // i1: u0001-u0003, i5: u0001-u0002
  }
  return current;
}

const col = (key) => UNIDAD_FIELDS.findIndex((f) => f.key === key);
function unitRow(model, itemId, id) {
  for (const s of model.sheets) {
    if (s.kind !== 'unidades') continue;
    const r = s.rows.find((x) => x[col('id')] === id && x[col('registroId')] === itemId);
    if (r) return r;
  }
  throw new Error(`unidad ${itemId}/${id} no encontrada`);
}

test('IDs de unidad repetidos entre registros: exportación sin tocar no da errores', () => {
  const current = currentWithRepeatedIds();
  const { report } = run(exportModel(current), current);
  assert.equal(report.summary.errorRows, 0, JSON.stringify(report.rows.filter((r) => r.status === 'error').map((r) => r.issues), null, 1));
  assert.equal(report.summary.modified + report.summary.removed, 0);
  assert.equal(report.canApply, false);
});

test('IDs de unidad repetidos: un cambio afecta solo a la unidad de ESE registro', () => {
  const current = currentWithRepeatedIds();
  const model = exportModel(current);
  unitRow(model, 'i5', 'u0001')[col('serie')] = 'NUEVA';
  const { report } = run(model, current);
  assert.equal(report.summary.errorRows, 0);
  assert.equal(report.summary.modified, 1);
  assert.deepEqual(report.plan.updates.map((u) => [u.itemId, u.id, u.fields.serie]), [['i5', 'u0001', 'NUEVA']]);
  const ops = buildOps({ report, current, importId: 'imp_t', author: { uid: 'a', email: null }, codes: new Map() });
  assert.deepEqual(ops.map((o) => o.path.join('/')), ['items/i5/unidades/u0001']);
});

test('IDs de unidad repetidos: quitar una fila da de baja solo esa unidad', () => {
  const current = currentWithRepeatedIds();
  const model = exportModel(current);
  const sheet = model.sheets.find((s) => s.kind === 'unidades' && s.rows.some((r) => r[col('registroId')] === 'i1'));
  sheet.rows = sheet.rows.filter((r) => !(r[col('registroId')] === 'i1' && r[col('id')] === 'u0002'));
  const { report } = run(model, current);
  assert.equal(report.summary.errorRows, 0);
  assert.deepEqual(report.plan.bajas.map((b) => [b.kind, b.itemId, b.id]), [['unidad', 'i1', 'u0002']]);
});

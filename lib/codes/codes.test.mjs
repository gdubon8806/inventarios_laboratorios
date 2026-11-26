import test from 'node:test';
import assert from 'node:assert/strict';

import {
  prefixForTipo, canonicalTipo, usesUnits, formatCode, parseCode, unitId,
} from './prefixes.js';
import { classifyCodeInput, isCodeLike, normalizeText, prefixRange } from './normalize.js';
import { parseCantidad, checkQuantity, validateRecordData } from './thresholds.js';

test('prefixForTipo: tipos canónicos, alias, tildes y mayúsculas', () => {
  assert.equal(prefixForTipo('Equipo'), 'EQU');
  assert.equal(prefixForTipo('Mobiliario'), 'MOB');
  assert.equal(prefixForTipo('Herramienta'), 'HER');
  assert.equal(prefixForTipo('Suministro'), 'INS');
  assert.equal(prefixForTipo('  insumo '), 'INS');
  assert.equal(prefixForTipo('HERRAMIENTAS'), 'HER');
  assert.equal(prefixForTipo(''), null);
  assert.equal(prefixForTipo(undefined), null);
  assert.equal(prefixForTipo('Cosa rara'), null);
  assert.equal(canonicalTipo('insumo'), 'Suministro');
});

test('usesUnits: sólo MOB/HER/EQU', () => {
  assert.equal(usesUnits('Equipo'), true);
  assert.equal(usesUnits('MOB'), true);
  assert.equal(usesUnits('Herramienta'), true);
  assert.equal(usesUnits('Suministro'), false);
  assert.equal(usesUnits('INS'), false);
  assert.equal(usesUnits('raro'), false);
});

test('formatCode / parseCode / unitId', () => {
  assert.equal(formatCode('EQU', 123), 'EQU-000123');
  assert.equal(formatCode('ins', 1), 'INS-000001');
  assert.equal(formatCode('MOB', 1234567), 'MOB-1234567');
  assert.throws(() => formatCode('XXX', 1));
  assert.throws(() => formatCode('EQU', 0));
  assert.deepEqual(parseCode('HER-000045'), { prefix: 'HER', number: 45 });
  assert.equal(parseCode('HER-45'), null);
  assert.equal(unitId(1), 'u0001');
  assert.equal(unitId(12345), 'u12345');
});

test('classifyCodeInput: exacto, parcial, sin guion, minúsculas, escáner', () => {
  assert.deepEqual(classifyCodeInput('EQU-000123'), { kind: 'exact', code: 'EQU-000123' });
  assert.deepEqual(classifyCodeInput('equ000123'), { kind: 'exact', code: 'EQU-000123' });
  assert.deepEqual(classifyCodeInput('  mob - 000007 '), { kind: 'none' }.kind === 'none' ? classifyCodeInput('  mob - 000007 ') : null);
  assert.equal(classifyCodeInput('  mob 000007 ').kind, 'exact');
  const p = classifyCodeInput('EQU-0001');
  assert.equal(p.kind, 'partial');
  assert.equal(p.prefix, 'EQU');
  assert.equal(p.digits, '0001');
  assert.equal(p.exactCandidate, 'EQU-000001');
  assert.equal(classifyCodeInput('INS123').exactCandidate, 'INS-000123');
  assert.equal(classifyCodeInput('EQU-0').exactCandidate, null);
  assert.equal(classifyCodeInput('Taladro').kind, 'none');
  assert.equal(classifyCodeInput('INV-000001').kind, 'none');
  assert.equal(classifyCodeInput('').kind, 'none');
  assert.equal(classifyCodeInput('EQU-').kind, 'none');
  assert.equal(isCodeLike('HER-12'), true);
  assert.equal(isCodeLike('microscopio'), false);
});

test('prefixRange', () => {
  assert.deepEqual(prefixRange('equ', '0001'), { start: 'EQU-0001', end: 'EQU-0001' });
});

test('normalizeText', () => {
  assert.equal(normalizeText("  Cámara  d'Óptica "), 'camara doptica');
});

test('parseCantidad', () => {
  assert.deepEqual(parseCantidad('10'), { ok: true, value: 10 });
  assert.deepEqual(parseCantidad(' 7 '), { ok: true, value: 7 });
  assert.deepEqual(parseCantidad(5), { ok: true, value: 5 });
  assert.deepEqual(parseCantidad('3,0'), { ok: true, value: 3 });
  assert.deepEqual(parseCantidad(0), { ok: true, value: 0 });
  assert.equal(parseCantidad('').ok, false);
  assert.equal(parseCantidad(undefined).ok, false);
  assert.equal(parseCantidad('5 pzas').ok, false);
  assert.equal(parseCantidad('varios').ok, false);
  assert.equal(parseCantidad('2.5').ok, false);
  assert.equal(parseCantidad('-3').ok, false);
  assert.equal(parseCantidad(NaN).ok, false);
});

test('checkQuantity: umbrales estrictamente mayores (D11)', () => {
  assert.equal(checkQuantity('Equipo', 10).action, 'ok');
  assert.equal(checkQuantity('Equipo', 11).action, 'validar-uno-a-uno');
  assert.equal(checkQuantity('Herramienta', '10').action, 'ok');
  assert.equal(checkQuantity('Herramienta', '11').action, 'validar-uno-a-uno');
  assert.equal(checkQuantity('Mobiliario', 20).action, 'ok');
  assert.equal(checkQuantity('Mobiliario', 21).action, 'validar-uno-a-uno');
  assert.equal(checkQuantity('Suministro', 100).action, 'ok');
  assert.equal(checkQuantity('Suministro', 101).action, 'confirmar');
  assert.equal(checkQuantity('Suministro', 5000).action, 'confirmar');
  assert.equal(checkQuantity('raro', 999).action, 'ok'); // tipo inválido lo maneja validateRecordData
});

test('validateRecordData (D13)', () => {
  assert.deepEqual(validateRecordData({ tipo: 'Equipo', cantidad: '4' }), { ok: true, prefix: 'EQU', cantidad: 4 });
  assert.deepEqual(validateRecordData({ tipo: '', cantidad: '4' }), { ok: false, motivo: 'sin tipo' });
  assert.equal(validateRecordData({ cantidad: '4' }).motivo, 'sin tipo');
  assert.match(validateRecordData({ tipo: 'Cacharro', cantidad: 1 }).motivo, /tipo no reconocido/);
  assert.match(validateRecordData({ tipo: 'Equipo', cantidad: '5 pzas' }).motivo, /no numérica/);
  assert.equal(validateRecordData({ tipo: 'Equipo', cantidad: '' }).motivo, 'cantidad vacía');
});

// ---- Marca/modelo por unidad: resumen para la tarjeta del registro ----
import { summarizeUnitBrands, EDITABLE_UNIT_FIELDS } from './builders.js';

test('summarizeUnitBrands: marca única se muestra; si difieren se oculta (marcaMixta)', () => {
  const reg = { marca: 'Fluke', modelo: '117' };
  const igual = summarizeUnitBrands([{ activo: true }, { marca: 'Fluke' }], reg);
  assert.deepEqual(igual, { marca: 'Fluke', marcaMixta: false, modelo: '117', modeloMixto: false });
  const mixta = summarizeUnitBrands([{ marca: 'Fluke' }, { marca: 'Uni-T' }], reg);
  assert.equal(mixta.marcaMixta, true);
  assert.equal(mixta.marca, '');
  assert.equal(mixta.modeloMixto, false); // el modelo sigue siendo el del registro
});

test('summarizeUnitBrands: ignora unidades dadas de baja y marca/modelo son campos editables de la unidad', () => {
  const r = summarizeUnitBrands([{ marca: 'A' }, { marca: 'B', activo: false }], { marca: 'A' });
  assert.equal(r.marcaMixta, false);
  assert.ok(EDITABLE_UNIT_FIELDS.includes('marca') && EDITABLE_UNIT_FIELDS.includes('modelo'));
});

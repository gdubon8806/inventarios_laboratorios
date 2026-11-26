import test from 'node:test';
import assert from 'node:assert/strict';
import { enfoqueDesdeArea, normalizarEnfoque, estiloEnfoque } from './enfoque.js';

test('enfoqueDesdeArea: centro de la zona, zoom y área redondeados', () => {
  const e = enfoqueDesdeArea({ x: 10, y: 20, width: 50, height: 40 }, 2.123);
  assert.deepEqual(e, { x: 35, y: 40, zoom: 2.12, area: { x: 10, y: 20, width: 50, height: 40 } });
  assert.equal(enfoqueDesdeArea(null), null);
});

test('normalizarEnfoque: datos viejos o dañados = sin enfoque; valores fuera de rango se limitan', () => {
  assert.equal(normalizarEnfoque(undefined), null);
  assert.equal(normalizarEnfoque({ x: 'a', y: 3 }), null);
  assert.deepEqual(normalizarEnfoque({ x: 150, y: -5, zoom: 9 }), { x: 100, y: 0, zoom: 4, area: null });
  assert.equal(normalizarEnfoque({ x: 50, y: 50 }).zoom, 1);
});

test('estiloEnfoque: sin enfoque no cambia nada; con zoom escala desde el punto enfocado', () => {
  assert.deepEqual(estiloEnfoque(null), {});
  assert.deepEqual(estiloEnfoque({ x: 30, y: 60, zoom: 1 }), { objectPosition: '30% 60%' });
  assert.deepEqual(estiloEnfoque({ x: 30, y: 60, zoom: 2 }), { objectPosition: '30% 60%', transform: 'scale(2)', transformOrigin: '30% 60%' });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_BATCH, filterLabels, chunk, batchLabel, confirmQuestion, summarize } from './printBatches.js';

const mk = (n, over = {}) =>
  Array.from({ length: n }, (_, i) => ({ id: `id${i}`, codigo: `EQU-${String(i).padStart(6, '0')}`, tipo: 'Equipo', estadoCodigo: 'pendienteImprimir', ...over }));

test('chunk parte en tandas de <=100', () => {
  const parts = chunk(mk(250));
  assert.deepEqual(parts.map((p) => p.length), [100, 100, 50]);
  assert.equal(MAX_BATCH, 100);
  assert.deepEqual(chunk(mk(100)).map((p) => p.length), [100]);
  assert.deepEqual(chunk([]), []);
});

test('batchLabel y pregunta de confirmación exacta', () => {
  assert.equal(batchLabel(0, 2), 'Parte 1 de 2');
  assert.equal(confirmQuestion(128, 'Redes 1'), '¿Imprimir 128 etiquetas del laboratorio Redes 1?');
  assert.equal(confirmQuestion(1, 'Redes 1'), '¿Imprimir 1 etiqueta del laboratorio Redes 1?');
});

test('filterLabels: solo pendientes / todas / por tipo / sin código excluido', () => {
  const labels = [
    ...mk(3),
    { id: 'a', codigo: 'HER-000001', tipo: 'Herramienta', estadoCodigo: 'impreso' },
    { id: 'b', codigo: '', tipo: 'Equipo', estadoCodigo: 'sinCodigo' },
  ];
  assert.equal(filterLabels(labels, { onlyPending: true }).length, 3);
  assert.equal(filterLabels(labels, { onlyPending: false }).length, 4); // excluye la sin código
  assert.equal(filterLabels(labels, { onlyPending: false, tipo: 'Herramienta' }).length, 1);
  assert.equal(filterLabels(labels, { onlyPending: true, tipo: 'Herramienta' }).length, 0);
});

test('summarize cuenta pendientes, sin código y por tipo', () => {
  const s = summarize([...mk(2), { id: 'x', codigo: 'HER-000001', tipo: 'Herramienta', estadoCodigo: 'impreso' }, { id: 'y', codigo: '' }]);
  assert.deepEqual(s, { total: 4, withoutCode: 1, pending: 2, byTipo: { Equipo: 2, Herramienta: 1 } });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SIZE, sanitizeSize, loadSize, saveSize, code128bModules, computeLayout, fitSvg, buildLabelsHtml, escapeHtml,
} from './labelLayout.js';

test('módulos Code128B: EQU-000123 (10 chars) = 145', () => {
  assert.equal(code128bModules('EQU-000123'), 145);
});

test('50x30 mm: EQU-000123 cabe con módulo 0.25 mm y barras >= 8 mm', () => {
  const l = computeLayout(DEFAULT_SIZE, 'EQU-000123');
  assert.equal(l.moduleMm, 0.25);
  assert.equal(l.barcodeWidthMm, 36.25);
  assert.ok(l.barcodeWidthMm <= 50 - 2 * 3); // respeta zona de silencio de 3 mm
  assert.ok(l.barcodeHeightMm >= 8);
  assert.equal(l.fits, true);
});

test('etiqueta muy angosta: no cabe y lo reporta', () => {
  const l = computeLayout({ widthMm: 30, heightMm: 30 }, 'EQU-000123');
  assert.equal(l.fits, false);
  assert.ok(l.problems.length >= 1);
});

test('etiqueta grande usa módulo mayor, múltiplo del punto (0.125) y tope 0.5', () => {
  const l = computeLayout({ widthMm: 100, heightMm: 50 }, 'EQU-000123');
  assert.equal(l.moduleMm % 0.125, 0);
  assert.ok(l.moduleMm <= 0.5 && l.moduleMm > 0.25);
  assert.ok(l.barcodeWidthMm <= 100 - 6);
});

test('etiqueta muy baja reporta problema de altura', () => {
  const l = computeLayout({ widthMm: 50, heightMm: 20 }, 'EQU-000123');
  assert.equal(l.fits, false);
});

test('sanitizeSize rechaza valores absurdos', () => {
  assert.deepEqual(sanitizeSize({ widthMm: 'x', heightMm: 5 }), DEFAULT_SIZE);
  assert.deepEqual(sanitizeSize({ widthMm: 40, heightMm: 25 }), { widthMm: 40, heightMm: 25 });
});

test('loadSize/saveSize con storage simulado', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.deepEqual(loadSize(storage), DEFAULT_SIZE);
  saveSize({ widthMm: 40, heightMm: 25 }, storage);
  assert.deepEqual(loadSize(storage), { widthMm: 40, heightMm: 25 });
  storage.setItem('etiquetas.tamano', '{roto');
  assert.deepEqual(loadSize(storage), DEFAULT_SIZE);
});

test('fitSvg escala a mm y agrega viewBox', () => {
  const out = fitSvg('<svg width="145" height="100" x="0" y="0"><rect/></svg>', 36.25, 12);
  assert.match(out, /viewBox="0 0 145 100"/);
  assert.match(out, /width:36.25mm;height:12mm/);
  assert.doesNotMatch(out.split('>')[0], /\swidth="145"/);
});

test('buildLabelsHtml: una etiqueta por página, @page del tamaño, escapa HTML y omite sin código', () => {
  const html = buildLabelsHtml(
    [
      { codigo: 'EQU-000001', nombre: 'Router <b>X</b>', lab: 'Redes 1' },
      { codigo: '', nombre: 'sin código', lab: 'Redes 1' },
      { codigo: 'HER-000002', nombre: 'Taladro', lab: 'Redes 1' },
    ],
    { widthMm: 50, heightMm: 30 },
    { renderBarcode: () => '<svg width="145" height="100"></svg>' },
  );
  assert.match(html, /@page \{ size: 50mm 30mm; margin: 0; \}/);
  assert.equal((html.match(/class="label/g) ?? []).length, 2);
  assert.equal((html.match(/class="label last"/g) ?? []).length, 1);
  assert.match(html, /Router &lt;b&gt;X&lt;\/b&gt;/);
  assert.doesNotMatch(html, /sin código/);
  assert.match(html, /EQU-000001/);
});

test('border=true agrega borde (calibración)', () => {
  const html = buildLabelsHtml([{ codigo: 'EQU-000001', nombre: 'n', lab: 'l' }], DEFAULT_SIZE, {
    renderBarcode: () => '<svg width="1" height="1"></svg>',
    border: true,
  });
  assert.match(html, /border: 0\.3mm solid #000/);
});

test('escapeHtml', () => {
  assert.equal(escapeHtml(`<a href="x">&'`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
});

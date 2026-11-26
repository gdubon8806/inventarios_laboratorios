import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PRINTER_ID, defaultPrinterSettings, dotMmFromDpi, layoutOptions, loadPrinterSettings, printerWarnings,
  sanitizePrinterSettings, savePrinterSettings, findPreset, PRINTER_STORAGE_KEY,
} from './printers.js';
import { computeLayout, buildLabelsHtml } from './labelLayout.js';

const memStorage = () => {
  const mem = new Map();
  return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
};

test('la impresora predeterminada es la Vortek: rollo 110 mm, zona efectiva 100 mm, etiqueta 100x50', () => {
  const s = defaultPrinterSettings();
  assert.equal(DEFAULT_PRINTER_ID, 'vortek');
  assert.equal(s.printerId, 'vortek');
  assert.equal(s.maxRollWidthMm, 110);
  assert.equal(s.maxPrintWidthMm, 100);
  assert.deepEqual([s.widthMm, s.heightMm], [100, 50]);
});

test('dotMmFromDpi: 203 dpi ≈ 0.1251 mm, 300 dpi ≈ 0.0847 mm y valores inválidos usan 203', () => {
  assert.equal(dotMmFromDpi(203), 0.1251);
  assert.equal(dotMmFromDpi(300), 0.0847);
  assert.equal(dotMmFromDpi('x'), 0.1251);
});

test('sanitizePrinterSettings: perfil desconocido cae en la Vortek; en Vortek los límites son los del fabricante', () => {
  const s = sanitizePrinterSettings({ printerId: 'rara', widthMm: 60, heightMm: 40, maxPrintWidthMm: 5 });
  assert.equal(s.printerId, 'vortek');
  assert.equal(s.maxPrintWidthMm, 100); // no se puede cambiar en la Vortek
  assert.deepEqual([s.widthMm, s.heightMm], [60, 40]);
});

test('«Otra impresora»: límites editables, vacío = sin límite, resolución solo 203/300/600', () => {
  const sin = sanitizePrinterSettings({ printerId: 'otra', widthMm: 50, heightMm: 30, dpi: 999 });
  assert.equal(sin.dpi, 203);
  assert.equal(sin.maxRollWidthMm, null);
  assert.equal(sin.maxPrintWidthMm, null);
  const con = sanitizePrinterSettings({ printerId: 'otra', widthMm: 80, heightMm: 40, dpi: 300, maxRollWidthMm: '90', maxPrintWidthMm: '80' });
  assert.deepEqual([con.dpi, con.maxRollWidthMm, con.maxPrintWidthMm], [300, 90, 80]);
});

test('guardar y cargar con storage simulado; dato roto vuelve al predeterminado', () => {
  const st = memStorage();
  assert.deepEqual(loadPrinterSettings(st), defaultPrinterSettings());
  savePrinterSettings({ printerId: 'otra', widthMm: 60, heightMm: 40, dpi: 300 }, st);
  const s = loadPrinterSettings(st);
  assert.deepEqual([s.printerId, s.widthMm, s.heightMm, s.dpi], ['otra', 60, 40, 300]);
  st.setItem(PRINTER_STORAGE_KEY, '{roto');
  assert.deepEqual(loadPrinterSettings(st), defaultPrinterSettings());
});

test('avisos: ancho mayor al rollo = error; mayor a la zona efectiva = aviso informativo; 100 mm sin avisos', () => {
  assert.deepEqual(printerWarnings({ printerId: 'vortek', widthMm: 100, heightMm: 50 }), []);
  const info = printerWarnings({ printerId: 'vortek', widthMm: 105, heightMm: 50 });
  assert.equal(info.length, 1);
  assert.equal(info[0].severity, 'info');
  const error = printerWarnings({ printerId: 'vortek', widthMm: 120, heightMm: 50 });
  assert.equal(error[0].severity, 'error');
});

test('Vortek 100x50: el código cabe, módulo múltiplo del punto (203 dpi) y textos más grandes que en 50x30', () => {
  const opts = layoutOptions(defaultPrinterSettings());
  const l = computeLayout({ widthMm: 100, heightMm: 50 }, 'EQU-000123', opts);
  assert.equal(l.fits, true);
  assert.ok(l.scale > 1);
  assert.ok(l.fonts.codeMm > 3.2);
  const puntos = l.moduleMm / opts.dotMm;
  assert.ok(Math.abs(puntos - Math.round(puntos)) < 0.01, 'el módulo debe ser múltiplo del punto');
  assert.ok(l.barcodeWidthMm <= 100 - 6);
});

test('etiqueta de 110 mm en la Vortek: el contenido se centra en la zona efectiva de 100 mm', () => {
  const opts = layoutOptions(defaultPrinterSettings());
  const l = computeLayout({ widthMm: 110, heightMm: 50 }, 'EQU-000123', opts);
  assert.equal(l.printableWidthMm, 100);
  assert.equal(l.sidePadMm, 8); // (110 - 100) / 2 + 3 mm de zona de silencio
  assert.ok(l.barcodeWidthMm <= 100 - 6);
  const html = buildLabelsHtml([{ codigo: 'EQU-000123', nombre: 'X', lab: 'Y' }], { widthMm: 110, heightMm: 50 }, { renderBarcode: () => '<svg width="145" height="100"></svg>', ...opts });
  assert.match(html, /@page \{ size: 110mm 50mm; margin: 0; \}/);
  assert.match(html, /padding: 1\.5mm 8mm;/);
  assert.match(html, /\.lab \{[^}]*color: #000;/); // térmica directa: solo negro, sin grises
});

test('sin límite de zona efectiva el comportamiento anterior no cambia (50x30)', () => {
  const l = computeLayout({ widthMm: 50, heightMm: 30 }, 'EQU-000123');
  assert.equal(l.sidePadMm, 3);
  assert.equal(l.scale, 1);
  assert.equal(l.moduleMm, 0.25);
});

test('findPreset reconoce los tamaños frecuentes', () => {
  assert.ok(findPreset({ widthMm: 100, heightMm: 50 }));
  assert.equal(findPreset({ widthMm: 97, heightMm: 33 }), null);
});

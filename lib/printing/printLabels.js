// Impresión de etiquetas por el navegador (driver de Windows), funciona con cualquier impresora térmica.
// DEPENDENCIA: `jsbarcode` (npm i jsbarcode) — la agrega el lead en package.json.
//
// printLabels(labels, size?, opts?) → Promise<{ printed: number, skipped: number }>
//   labels: [{ codigo, nombre, lab }]  (los que no tengan codigo se omiten y se cuentan en `skipped`)
//   size:   { widthMm, heightMm }      (por defecto el de la impresora guardada: Vortek DIR-EB58III 100x50 mm)
//   opts.printer: ajustes de impresora (lib/printing/printers.js); por defecto los guardados en este navegador
//   opts:   { border?: boolean }       (border=true para la hoja de calibración)
// NOTA: el navegador NO puede saber si el papel salió; la promesa se resuelve cuando se cierra el
// diálogo de impresión. Quien llama debe pedir confirmación manual antes de marcar como impreso.
import JsBarcode from 'jsbarcode';
import { buildLabelsHtml, sanitizeSize } from './labelLayout.js';
import { loadPrinterSettings, layoutOptions } from './printers.js';

export function renderBarcodeSvg(code) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  // CODE128B fijo → ancho determinista (ver labelLayout.code128bModules). width:1 = 1 unidad por módulo.
  JsBarcode(svg, String(code), { format: 'CODE128B', width: 1, height: 100, displayValue: false, margin: 0 });
  return svg.outerHTML;
}

export function printLabels(labels, size, opts = {}) {
  if (typeof window === 'undefined') return Promise.reject(new Error('printLabels solo funciona en el navegador'));
  // Impresora elegida (por defecto la guardada en este navegador): da el tamaño, la resolución y la zona efectiva de impresión.
  const printer = opts.printer ?? loadPrinterSettings();
  const finalSize = sanitizeSize(size ?? { widthMm: printer.widthMm, heightMm: printer.heightMm });
  const valid = (labels ?? []).filter((l) => l?.codigo);
  const skipped = (labels ?? []).length - valid.length;
  if (valid.length === 0) return Promise.resolve({ printed: 0, skipped });

  const html = buildLabelsHtml(valid, finalSize, { renderBarcode: renderBarcodeSvg, border: !!opts.border, ...layoutOptions(printer) });

  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(iframe);
    const cleanup = () => setTimeout(() => iframe.remove(), 1000);
    try {
      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
      // Pequeña espera para que el layout/SVG estén listos antes de abrir el diálogo.
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print(); // en Chrome bloquea hasta cerrar el diálogo
          cleanup();
          resolve({ printed: valid.length, skipped });
        } catch (e) {
          cleanup();
          reject(e);
        }
      }, 250);
    } catch (e) {
      cleanup();
      reject(e);
    }
  });
}

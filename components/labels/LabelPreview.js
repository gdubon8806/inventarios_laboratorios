// Vista previa en pantalla de UNA etiqueta (a tamaño real en mm). Requiere `jsbarcode`.
// Props: label { codigo, nombre, lab }, size { widthMm, heightMm }, border? boolean
import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { computeLayout, sanitizeSize } from '../../lib/printing/labelLayout';

export default function LabelPreview({ label, size, border = true }) {
  const svgRef = useRef(null);
  const finalSize = sanitizeSize(size);
  const lay = computeLayout(finalSize, label?.codigo ?? '');

  useEffect(() => {
    if (!svgRef.current || !label?.codigo) return;
    const svg = svgRef.current;
    JsBarcode(svg, String(label.codigo), { format: 'CODE128B', width: 1, height: 100, displayValue: false, margin: 0 });
    const w = svg.getAttribute('width');
    const h = svg.getAttribute('height');
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.width = `${lay.barcodeWidthMm}mm`;
    svg.style.height = `${lay.barcodeHeightMm}mm`;
  }, [label?.codigo, lay.barcodeWidthMm, lay.barcodeHeightMm]);

  if (!label?.codigo) return null;
  const line = { width: '100%', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.1 };
  return (
    <div>
      <div
        style={{
          width: `${lay.widthMm}mm`, height: `${lay.heightMm}mm`, padding: `${lay.padVMm}mm ${lay.quietMm}mm`, boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: 'Arial, Helvetica, sans-serif', background: '#fff', color: '#000', overflow: 'hidden',
          border: border ? '1px solid #999' : 'none',
        }}
      >
        <div style={{ ...line, fontSize: `${lay.fonts.labMm}mm`, color: '#222' }}>{label.lab}</div>
        <div style={{ ...line, fontSize: `${lay.fonts.nameMm}mm`, fontWeight: 600 }}>{label.nombre}</div>
        <div style={{ display: 'flex', justifyContent: 'center', flex: '1 1 auto', alignItems: 'center' }}>
          <svg ref={svgRef} style={{ display: 'block' }} />
        </div>
        <div style={{ ...line, fontSize: `${lay.fonts.codeMm}mm`, fontWeight: 700, letterSpacing: '0.15mm' }}>{label.codigo}</div>
      </div>
      {!lay.fits && (
        <p style={{ color: '#b71c1c', fontSize: 12, margin: '4px 0 0' }}>⚠ {lay.problems.join(' ')}</p>
      )}
    </div>
  );
}

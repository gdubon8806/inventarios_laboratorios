// Genera y descarga un PDF con la etiqueta (código de barras Code 128 + número legible).
// Las librerías se cargan solo al pulsar el botón, para no afectar al resto de la app.
export default async function generateLabelPdf({ codigo, titulo }) {
  const code = (codigo || '').trim().toUpperCase();
  if (!code) throw new Error('Código vacío');

  const [{ default: JsBarcode }, { jsPDF }] = await Promise.all([
    import('jsbarcode'),
    import('jspdf'),
  ]);

  const canvas = document.createElement('canvas');
  JsBarcode(canvas, code, {
    format: 'CODE128',
    width: 3,
    height: 90,
    displayValue: true,
    fontSize: 28,
    margin: 10,
  });

  const W = 50;
  const H = 30;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [W, H] });
  if (titulo) {
    pdf.setFontSize(8);
    pdf.text(String(titulo).slice(0, 32), W / 2, 5, { align: 'center' });
  }
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 3, titulo ? 8 : 3, W - 6, titulo ? H - 10 : H - 6);
  pdf.save('etiqueta-' + code + '.pdf');
}

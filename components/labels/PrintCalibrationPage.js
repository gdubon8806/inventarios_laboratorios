// Página de calibración/prueba de etiquetas: borde + código escaneable. Pensada para usarse con la impresora real.
// Dependencia: `jsbarcode`. Quien enrute esta página debe restringirla a admin (aquí no se valida rol).
//
// IMPRESORA PREDETERMINADA: Vortek DIR-EB58III (térmica DIRECTA, rollo de hasta 4" = 110 mm, zona de impresión efectiva
// de 100 mm). Se puede elegir «Otra impresora» y escribir otro tamaño, resolución y límites.
//
// CÓMO CALIBRAR:
//  1. Cargar el rollo de etiquetas adhesivas y mantener FEED hasta que avance y detecte el largo de la etiqueta
//     (calibración de papel). Es térmica directa: no lleva cinta; usar etiquetas para térmica directa.
//  2. En Windows: Propiedades de la impresora → Preferencias → tamaño de papel = ancho x alto reales de la etiqueta
//     (crear una «forma personalizada» si no existe). Dejar densidad y velocidad por defecto al inicio.
//  3. Elegir aquí la impresora y el tamaño de la etiqueta (o medirla con regla y escribirla en «Personalizado»).
//     Con la Vortek, si la etiqueta es más ancha que 100 mm el contenido se centra en la zona efectiva.
//  4. «Imprimir prueba»: en el diálogo de Chrome elegir la impresora, papel = el de la etiqueta, escala 100 %,
//     márgenes «Ninguno» y sin encabezados ni pies.
//  5. Verificar que el borde NO se corta y queda centrado; si se corre, ajustar el papel del driver (no la app).
//  6. Escanear el código con el lector USB: debe leerse a la primera. Si no, subir la densidad (oscuridad) o
//     usar una etiqueta más ancha.
import { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import LabelPreview from './LabelPreview';
import PrinterSettings from './PrinterSettings';
import { printLabels } from '../../lib/printing/printLabels';
import { computeLayout } from '../../lib/printing/labelLayout';
import {
  defaultPrinterSettings, layoutOptions, loadPrinterSettings, sanitizePrinterSettings, savePrinterSettings,
} from '../../lib/printing/printers';

const SAMPLE = { codigo: 'EQU-000001', nombre: 'Etiqueta de prueba', lab: 'Calibración' };

export default function PrintCalibrationPage() {
  const [printer, setPrinter] = useState(defaultPrinterSettings());
  const [msg, setMsg] = useState('');

  useEffect(() => setPrinter(loadPrinterSettings()), []);

  const update = (next) => {
    const clean = sanitizePrinterSettings(next);
    setPrinter(clean);
    savePrinterSettings(clean);
  };

  const size = { widthMm: printer.widthMm, heightMm: printer.heightMm };
  const opts = layoutOptions(printer);
  const lay = computeLayout(size, SAMPLE.codigo, opts);

  const imprimir = async () => {
    setMsg('');
    try {
      await printLabels([SAMPLE], size, { border: true, printer });
      setMsg('Se envió la prueba. Revisa que el borde no se corte y escanea el código.');
    } catch (e) {
      setMsg(`Error: ${e?.message ?? e}`);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: '24px auto', padding: 16 }}>
      <Typography variant="h5" gutterBottom>Prueba y calibración de etiquetas</Typography>
      <Typography variant="body2" gutterBottom>
        Elige la impresora y el tamaño de la etiqueta, imprime una prueba con borde y escanea el código. Los pasos de calibración
        (rollo, papel del driver, márgenes) están al inicio del archivo components/labels/PrintCalibrationPage.js.
      </Typography>
      <PrinterSettings value={printer} onChange={update} />
      <div style={{ margin: '16px 0 4px', overflowX: 'auto' }}>
        <LabelPreview label={SAMPLE} size={size} layoutOpts={opts} />
      </div>
      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
        Módulo: {lay.moduleMm} mm · ancho de barras: {lay.barcodeWidthMm} mm · alto de barras: {lay.barcodeHeightMm} mm · punto: {opts.dotMm} mm
      </Typography>
      <Button variant="contained" sx={{ mt: 2 }} onClick={imprimir} disabled={!lay.fits}>Imprimir prueba</Button>
      {msg && <Alert severity="info" sx={{ mt: 2 }}>{msg}</Alert>}
    </div>
  );
}

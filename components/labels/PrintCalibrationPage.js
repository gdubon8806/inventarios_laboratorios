// Página de calibración/prueba de etiquetas: borde + código escaneable. Pensada para usarse con la impresora real.
// Dependencia: `jsbarcode`. Quien enrute esta página debe restringirla a admin (aquí no se valida rol).
//
// CÓMO CALIBRAR (impresora térmica de 4"):
//  1. Cargar el rollo y mantener FEED 1–4 s hasta que avance y detecte el tamaño (calibración de papel).
//  2. En Windows: Propiedades de la impresora → Preferencias → tamaño de papel = ancho x alto reales de la
//     etiqueta (crear "forma personalizada" si no existe). Densidad/velocidad por defecto al inicio.
//  3. Medir el ancho y alto reales de la etiqueta con regla (mm) y escribirlos abajo (se guardan en este navegador).
//  4. "Imprimir prueba": en el diálogo de Chrome → impresora térmica, papel = el de la etiqueta, escala 100 %,
//     márgenes "Ninguno", desactivar encabezados y pies.
//  5. Verificar que el borde NO se corta y queda centrado; si se corre, ajustar el papel del driver (no la app).
//  6. Escanear el código con el lector USB: debe leerse a la primera. Si no, subir la densidad (oscuridad) o
//     usar una etiqueta más ancha.
import { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import LabelPreview from './LabelPreview';
import { printLabels } from '../../lib/printing/printLabels';
import { loadSize, saveSize, sanitizeSize, computeLayout } from '../../lib/printing/labelLayout';

const SAMPLE = { codigo: 'EQU-000001', nombre: 'Etiqueta de prueba', lab: 'Calibración' };

export default function PrintCalibrationPage() {
  const [size, setSize] = useState({ widthMm: 50, heightMm: 30 });
  const [msg, setMsg] = useState('');

  useEffect(() => setSize(loadSize()), []);

  const update = (field, value) => {
    const next = sanitizeSize({ ...size, [field]: value });
    setSize(next);
    saveSize(next);
  };

  const lay = computeLayout(size, SAMPLE.codigo);

  const imprimir = async () => {
    setMsg('');
    try {
      await printLabels([SAMPLE], size, { border: true });
      setMsg('Se envió la prueba. Revisa que el borde no se corte y escanea el código.');
    } catch (e) {
      setMsg(`Error: ${e?.message ?? e}`);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: '24px auto', padding: 16 }}>
      <Typography variant="h5" gutterBottom>Prueba y calibración de etiquetas</Typography>
      <Typography variant="body2" gutterBottom>
        Mide la etiqueta real (mm), imprime una prueba con borde y escanea el código. Pasos detallados en el comentario de
        components/labels/PrintCalibrationPage.js.
      </Typography>
      <div style={{ margin: '12px 0' }}>
        <TextField size="small" type="number" label="Ancho (mm)" value={size.widthMm} onChange={(e) => update('widthMm', e.target.value)} sx={{ mr: 1, width: 130 }} />
        <TextField size="small" type="number" label="Alto (mm)" value={size.heightMm} onChange={(e) => update('heightMm', e.target.value)} sx={{ width: 130 }} />
      </div>
      <LabelPreview label={SAMPLE} size={size} />
      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
        Módulo: {lay.moduleMm} mm · ancho de barras: {lay.barcodeWidthMm} mm · alto de barras: {lay.barcodeHeightMm} mm
      </Typography>
      <Button variant="contained" sx={{ mt: 2 }} onClick={imprimir} disabled={!lay.fits}>Imprimir prueba</Button>
      {msg && <Alert severity="info" sx={{ mt: 2 }}>{msg}</Alert>}
    </div>
  );
}

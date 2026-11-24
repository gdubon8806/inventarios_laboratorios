// Selector de impresora y tamaño de etiqueta (se usa en el diálogo de impresión y en la página de calibración).
// Deja SIEMPRE la posibilidad de usar otra impresora: «Otra impresora» permite escribir ancho, alto, resolución y los
// límites del rollo. Lo elegido se guarda en este navegador.
//
// Props: { value, onChange(next) }   value = ajustes de lib/printing/printers.js
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  DPI_OPTIONS, PRINTER_PROFILES, SIZE_PRESETS, defaultPrinterSettings, findPreset, getProfile, printerWarnings,
  sanitizePrinterSettings, sizeKey,
} from '../../lib/printing/printers';

const CUSTOM = 'custom';

export default function PrinterSettings({ value, onChange }) {
  const s = sanitizePrinterSettings(value);
  const profile = getProfile(s.printerId);
  const preset = findPreset(s) ? sizeKey(s) : CUSTOM;
  const warnings = printerWarnings(s);
  const otra = profile.id === 'otra';

  const set = (patch) => onChange(sanitizePrinterSettings({ ...s, ...patch }));
  // Al cambiar de impresora se cargan sus valores (tamaño, resolución y límites)
  const changePrinter = (id) => onChange(defaultPrinterSettings(id));
  const changePreset = (key) => {
    if (key === CUSTOM) return;
    const p = SIZE_PRESETS.find((x) => sizeKey(x) === key);
    if (p) set({ widthMm: p.widthMm, heightMm: p.heightMm });
  };

  return (
    <Box sx={{ display: 'grid', gap: 1.5, mt: 1 }}>
      <TextField select size="small" fullWidth label="Impresora" value={profile.id} onChange={(e) => changePrinter(e.target.value)}>
        {Object.values(PRINTER_PROFILES).map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
      </TextField>
      <Typography variant="caption" color="text.secondary" sx={{ mt: -0.5 }}>{profile.detail}</Typography>

      <TextField select size="small" fullWidth label="Tamaño de la etiqueta (ancho × alto, mm)" value={preset} onChange={(e) => changePreset(e.target.value)}>
        {SIZE_PRESETS.map((p) => <MenuItem key={sizeKey(p)} value={sizeKey(p)}>{p.widthMm} × {p.heightMm} mm</MenuItem>)}
        <MenuItem value={CUSTOM}>Personalizado</MenuItem>
      </TextField>

      {preset === CUSTOM && (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField size="small" type="number" label="Ancho (mm)" value={s.widthMm} onChange={(e) => set({ widthMm: e.target.value })} fullWidth />
          <TextField size="small" type="number" label="Alto (mm)" value={s.heightMm} onChange={(e) => set({ heightMm: e.target.value })} fullWidth />
        </Box>
      )}

      <TextField select size="small" fullWidth label="Resolución de la impresora" value={s.dpi} onChange={(e) => set({ dpi: e.target.value })}
        helperText={profile.id === 'vortek' ? '203 dpi es la habitual; confirma el dato en la ficha del equipo' : undefined}>
        {DPI_OPTIONS.map((d) => <MenuItem key={d} value={d}>{d} dpi</MenuItem>)}
      </TextField>

      {otra && (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField size="small" type="number" label="Ancho máx. del rollo (mm)" value={s.maxRollWidthMm ?? ''} onChange={(e) => set({ maxRollWidthMm: e.target.value })} fullWidth helperText="Vacío = sin límite" />
          <TextField size="small" type="number" label="Zona efectiva (mm)" value={s.maxPrintWidthMm ?? ''} onChange={(e) => set({ maxPrintWidthMm: e.target.value })} fullWidth helperText="Vacío = ancho completo" />
        </Box>
      )}

      {warnings.map((w) => <Alert key={w.text} severity={w.severity === 'error' ? 'error' : 'info'}>{w.text}</Alert>)}
    </Box>
  );
}

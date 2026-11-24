// Diálogo de impresión masiva de etiquetas de un laboratorio (se abre desde la tarjeta del lab / /inventory).
// El CALLER valida que el usuario sea admin y marca como impreso; este componente no importa firebase.
//
// Props:
//   open: boolean
//   onClose(): void
//   labName: string
//   labels: [{ id, codigo, nombre, lab, tipo, estadoCodigo }]   (todas las del lab; el diálogo filtra)
//   onConfirmed(ids: string[], info: { part: number, totalParts: number }): void | Promise<void>
//        → se llama SOLO cuando el admin responde "Sí, salieron bien" para una tanda; el caller marca `impreso`.
//   printFn?: (labels, size) => Promise   (inyectable para pruebas; por defecto lib/printing/printLabels)
//   tipos?: string[]  (por defecto Mobiliario, Equipo, Herramienta, Suministro)
//   sample/limits: ninguno
// Dependencia: `jsbarcode` (vía printLabels).
import { useEffect, useMemo, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { printLabels as defaultPrint } from '../../lib/printing/printLabels';
import { filterLabels, chunk, batchLabel, confirmQuestion, summarize, MAX_BATCH } from '../../lib/printing/printBatches';
import { computeLayout } from '../../lib/printing/labelLayout';
import { defaultPrinterSettings, layoutOptions, loadPrinterSettings, sanitizePrinterSettings, savePrinterSettings } from '../../lib/printing/printers';
import PrinterSettings from './PrinterSettings';
import LabelPreview from './LabelPreview';

const DEFAULT_TIPOS = ['Mobiliario', 'Equipo', 'Herramienta', 'Suministro'];

export default function PrintLabelsDialog({ open, onClose, labName, labels, onConfirmed, printFn = defaultPrint, tipos = DEFAULT_TIPOS }) {
  const [onlyPending, setOnlyPending] = useState(true);
  const [tipo, setTipo] = useState('todos');
  const [printer, setPrinter] = useState(defaultPrinterSettings()); // impresora y tamaño de etiqueta (se guardan en este navegador)
  // step: 'confirm' (pregunta) → 'ready' (tanda lista) → 'verify' (¿salieron bien?) → 'done'
  const [step, setStep] = useState('confirm');
  const [partIndex, setPartIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmedCount, setConfirmedCount] = useState(0);

  useEffect(() => {
    if (open) {
      setPrinter(loadPrinterSettings());
      setStep('confirm');
      setPartIndex(0);
      setError('');
      setConfirmedCount(0);
    }
  }, [open]);

  const selected = useMemo(() => filterLabels(labels, { onlyPending, tipo }), [labels, onlyPending, tipo]);
  const batches = useMemo(() => chunk(selected, MAX_BATCH), [selected]);
  const stats = useMemo(() => summarize(labels), [labels]);
  const size = { widthMm: printer.widthMm, heightMm: printer.heightMm };
  const layoutOpts = layoutOptions(printer);
  const layout = computeLayout(size, selected[0]?.codigo ?? 'EQU-000000', layoutOpts);
  const current = batches[partIndex] ?? [];

  const updatePrinter = (next) => {
    const clean = sanitizePrinterSettings(next);
    setPrinter(clean);
    savePrinterSettings(clean);
  };

  const doPrint = async () => {
    setBusy(true);
    setError('');
    try {
      await printFn(current, size, { printer });
      setStep('verify');
    } catch (e) {
      setError(`No se pudo abrir la impresión: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  const answer = async (ok) => {
    if (ok) {
      setBusy(true);
      try {
        await onConfirmed?.(current.map((l) => l.id), { part: partIndex + 1, totalParts: batches.length });
        setConfirmedCount((c) => c + current.length);
        if (partIndex + 1 < batches.length) {
          setPartIndex(partIndex + 1);
          setStep('ready');
        } else {
          setStep('done');
        }
      } catch (e) {
        setError(`No se pudo marcar como impreso: ${e?.message ?? e}`);
      } finally {
        setBusy(false);
      }
    } else {
      setStep('ready'); // nada se marca; puede reintentar la misma parte
    }
  };

  const partText = batchLabel(partIndex, batches.length);

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Imprimir etiquetas — {labName}</DialogTitle>
      <DialogContent dividers>
        {step === 'confirm' && (
          <>
            <Typography variant="h6" gutterBottom>
              {selected.length === 0 ? 'No hay etiquetas para imprimir con este filtro.' : confirmQuestion(selected.length, labName)}
            </Typography>
            <FormControlLabel
              control={<Checkbox checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />}
              label={`Solo pendientes de imprimir (${stats.pending})`}
            />
            <FormControlLabel
              control={<Checkbox checked={!onlyPending} onChange={(e) => setOnlyPending(!e.target.checked)} />}
              label="Todas (reimprimir, incluye las ya impresas)"
            />
            <TextField select size="small" label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} sx={{ mt: 1, minWidth: 200 }}>
              <MenuItem value="todos">Todos los tipos</MenuItem>
              {tipos.map((t) => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </TextField>
            <Typography variant="subtitle2" sx={{ mt: 2 }}>Impresora y etiqueta</Typography>
            <PrinterSettings value={printer} onChange={updatePrinter} />
            {!layout.fits && <Alert severity="warning" sx={{ mt: 1 }}>{layout.problems.join(' ')}</Alert>}
            {selected[0] && (
              <Box sx={{ mt: 1.5, overflowX: 'auto' }}>
                <Typography variant="caption" color="text.secondary">Vista previa a tamaño real ({printer.widthMm} × {printer.heightMm} mm)</Typography>
                <LabelPreview label={selected[0]} size={size} layoutOpts={layoutOpts} />
              </Box>
            )}
            {stats.withoutCode > 0 && (
              <Alert severity="info" sx={{ mt: 1 }}>{stats.withoutCode} registro(s) sin código no se imprimirán (primero genera sus códigos).</Alert>
            )}
            {batches.length > 1 && (
              <Alert severity="info" sx={{ mt: 1 }}>
                Se imprimirán en {batches.length} partes de hasta {MAX_BATCH} etiquetas; tras cada parte se te preguntará si salieron bien.
              </Alert>
            )}
          </>
        )}

        {step === 'ready' && (
          <>
            <Typography variant="h6">{partText}</Typography>
            <Typography>{current.length} etiquetas listas. En el diálogo de impresión elige la impresora ({printer.printerId === 'vortek' ? 'Vortek DIR-EB58III' : 'la que configuraste'}), tamaño de papel = {printer.widthMm} × {printer.heightMm} mm, escala 100 % y sin márgenes ni encabezados.</Typography>
          </>
        )}

        {step === 'verify' && (
          <>
            <Typography variant="h6">{partText}</Typography>
            <Typography>¿Salieron bien las etiquetas de esta parte ({current.length})? Solo si respondes que sí se marcarán como impresas.</Typography>
          </>
        )}

        {step === 'done' && <Alert severity="success">Listo: {confirmedCount} etiquetas marcadas como impresas.</Alert>}
        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      </DialogContent>

      <DialogActions>
        {step === 'confirm' && (
          <>
            <Button onClick={onClose}>Cancelar</Button>
            <Button variant="contained" disabled={selected.length === 0} onClick={() => setStep('ready')}>
              Sí, imprimir
            </Button>
          </>
        )}
        {step === 'ready' && (
          <>
            <Button onClick={onClose} disabled={busy}>{confirmedCount > 0 ? 'Terminar' : 'Cancelar'}</Button>
            <Button variant="contained" onClick={doPrint} disabled={busy}>
              {busy ? 'Abriendo…' : `Imprimir ${batches.length > 1 ? partText.toLowerCase() : ''}`.trim()}
            </Button>
          </>
        )}
        {step === 'verify' && (
          <>
            <Button onClick={() => answer(false)} disabled={busy}>No, reintentar</Button>
            <Button variant="contained" onClick={() => answer(true)} disabled={busy}>Sí, salieron bien</Button>
          </>
        )}
        {step === 'done' && <Button variant="contained" onClick={onClose}>Cerrar</Button>}
      </DialogActions>
    </Dialog>
  );
}

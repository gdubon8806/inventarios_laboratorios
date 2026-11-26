// Cambio de tipo de un registro (§4.3): proceso con vista previa y confirmación escribiendo CAMBIAR.
// Genera códigos nuevos con el prefijo nuevo, deja la tarjeta en rojo (pendiente imprimir) y guarda el código anterior.
//
// Props: { open, onClose, registro, user, onDone }
import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import toast from 'react-hot-toast';
import { previewTypeChange, changeType } from './firebase/change-type';
import { TIPOS, PREFIJO_POR_TIPO } from '../lib/constants/tipos';

const KIND_TEXT = {
  'ins-to-units': 'Pasa de un código por registro a un código por unidad: se crean tantas unidades como la cantidad.',
  'units-to-units': 'Cada unidad recibe un código nuevo con el prefijo nuevo; los códigos viejos quedan como "reemplazados".',
  'units-to-ins': 'DESTRUCTIVO: las unidades pasan a baja y se pierden sus datos por unidad. El registro recibe un único código.',
};

export default function ChangeTypeDialog({ open, onClose, registro, user, onDone }) {
  const [nuevoTipo, setNuevoTipo] = useState('');
  const [preview, setPreview] = useState(null);
  const [texto, setTexto] = useState('');
  const [umbralOk, setUmbralOk] = useState(false);
  const [override, setOverride] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (open) { setNuevoTipo(''); setPreview(null); setTexto(''); setUmbralOk(false); setOverride(false); setProgress(null); }
  }, [open]);

  useEffect(() => {
    if (!open || !nuevoTipo || !registro) { setPreview(null); return; }
    let cancelled = false;
    setPreview(null);
    previewTypeChange(registro.id, nuevoTipo)
      .then((p) => { if (!cancelled) setPreview(p); })
      .catch((e) => { if (!cancelled) setPreview({ ok: false, error: e.message }); });
    return () => { cancelled = true; };
  }, [open, nuevoTipo, registro?.id]);

  const bloqueadoPorDatos = preview && !preview.ok && preview.code === 'bloqueado-datos-por-unidad';
  const listo = preview && (preview.ok || (bloqueadoPorDatos && override))
    && texto.trim().toUpperCase() === 'CAMBIAR'
    && (!preview.requiereConfirmacionUmbral || umbralOk);

  const aplicar = async () => {
    setBusy(true);
    try {
      const r = await changeType(registro.id, nuevoTipo, {
        confirm: true, override, confirmedThreshold: umbralOk, user, onProgress: setProgress,
      });
      if (r.status === 'error') throw new Error(r.error);
      if (r.status === 'needs-confirmation') { setUmbralOk(false); toast.error('Confirma la cantidad alta antes de continuar.'); return; }
      toast('Tipo cambiado. Imprime las etiquetas nuevas: la tarjeta queda en rojo hasta entonces.');
      onDone?.();
      onClose?.();
    } catch (e) {
      toast.error(e.message || 'No se pudo cambiar el tipo.');
    } finally {
      setBusy(false);
    }
  };

  if (!registro) return null;
  return (
    <Dialog open={!!open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Cambiar tipo: {registro.equipo}</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          <strong>Cambiar el tipo cambia el código y la etiqueta.</strong>
          <div>Se generan códigos nuevos con otro prefijo, los códigos anteriores quedan como «reemplazados» y hay que reimprimir todas las etiquetas del registro.</div>
        </Alert>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Tipo actual: <strong>{registro.tipo}</strong> ({PREFIJO_POR_TIPO[registro.tipo] ?? '—'}), cantidad: <strong>{registro.cantidad}</strong>.
        </Typography>
        <TextField select fullWidth size="small" label="Nuevo tipo" value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value)}>
          {TIPOS.filter((t) => t !== registro.tipo).map((t) => <MenuItem key={t} value={t}>{t} ({PREFIJO_POR_TIPO[t]})</MenuItem>)}
        </TextField>

        {nuevoTipo && !preview && <LinearProgress sx={{ mt: 2 }} />}
        {preview && !preview.ok && (
          <Alert severity={bloqueadoPorDatos ? 'warning' : 'error'} sx={{ mt: 2 }}>
            {preview.error}
            {bloqueadoPorDatos && (
              <FormControlLabel sx={{ display: 'block' }} control={<Checkbox size="small" checked={override} onChange={(e) => setOverride(e.target.checked)} />}
                label="Entiendo que se perderán esos datos y ya exporté un respaldo" />
            )}
          </Alert>
        )}
        {preview && preview.ok && (
          <Alert severity={preview.kind === 'units-to-ins' ? 'error' : 'warning'} sx={{ mt: 2 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Detalle del cambio</div>
            <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc' }}>
              <li>{KIND_TEXT[preview.kind]}</li>
              <li>El código cambiará de <strong>{preview.codigoActual ?? PREFIJO_POR_TIPO[registro.tipo]}</strong> a prefijo <strong>{preview.to}</strong>.</li>
              <li>Habrá que reimprimir <strong>{preview.etiquetasAReimprimir}</strong> etiqueta(s); la tarjeta quedará pendiente de imprimir.</li>
              {preview.advertencia && <li><strong>{preview.advertencia}</strong></li>}
            </ul>
          </Alert>
        )}
        {preview?.requiereConfirmacionUmbral && (
          <FormControlLabel sx={{ display: 'block', mt: 1 }} control={<Checkbox size="small" checked={umbralOk} onChange={(e) => setUmbralOk(e.target.checked)} />}
            label={`Confirmo crear ${preview.cantidad} unidades de ${nuevoTipo} (supera ${preview.requiereConfirmacionUmbral.threshold})`} />
        )}
        {progress && <LinearProgress variant="determinate" value={Math.min(100, (progress.done / Math.max(progress.total, 1)) * 100)} sx={{ mt: 2 }} />}

        <TextField fullWidth size="small" label='Escribe CAMBIAR para confirmar' value={texto} onChange={(e) => setTexto(e.target.value)} sx={{ mt: 2 }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button variant="contained" color="error" onClick={aplicar} disabled={busy || !listo}>Cambiar tipo</Button>
      </DialogActions>
    </Dialog>
  );
}

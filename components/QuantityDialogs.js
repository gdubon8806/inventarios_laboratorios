// Diálogos de cantidad.
//  - ThresholdConfirmDialog: validación D11 (HER/EQU > 10, MOB > 20 uno a uno mostrando el nombre; INS > 100 Sí/No).
//  - QuantityDialog: subir/bajar la cantidad de un registro. Bajar en Mobiliario/Equipo/Herramienta exige elegir
//    EXACTAMENTE qué unidades se dan de baja (con motivo); nunca hay baja silenciosa.
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
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import toast from 'react-hot-toast';
import { increaseQuantity, decreaseQuantity, readUnits } from './firebase/manage-units';
import { resolveReportsForUnits } from './firebase/resolve-report';
import { parseCantidad } from '../lib/codes/thresholds';
import { tieneUnidades } from '../lib/constants/tipos';

/** info: { nombre, tipo, cantidad, threshold, action:'validar-uno-a-uno'|'confirmar' } */
export function ThresholdConfirmDialog({ open, info, onConfirm, onCancel, busy = false }) {
  if (!info) return null;
  const uno = info.action === 'validar-uno-a-uno';
  return (
    <Dialog open={!!open} onClose={busy ? undefined : onCancel} fullWidth maxWidth="sm">
      <DialogTitle>{uno ? 'Validar cantidad alta' : 'Confirmar cantidad'}</DialogTitle>
      <DialogContent>
        {uno ? (
          <>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Se crearán <strong>{info.cantidad}</strong> unidades, cada una con su propio código y su etiqueta.
              El máximo sin validar para {info.tipo} es {info.threshold}.
            </Alert>
            <Typography><strong>{info.nombre}</strong> — {info.cantidad} unidades ({info.tipo})</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              ¿Es correcto crear todas esas unidades? Si es un artículo consumible, cancela y cámbialo a Suministro.
            </Typography>
          </>
        ) : (
          <Typography>¿Confirmas una cantidad de <strong>{info.cantidad}</strong> para <strong>{info.nombre}</strong>? (más de {info.threshold})</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={busy}>Cancelar</Button>
        <Button variant="contained" onClick={onConfirm} disabled={busy}>{uno ? 'Sí, crear unidades' : 'Sí, confirmar'}</Button>
      </DialogActions>
    </Dialog>
  );
}

/** Props: { open, onClose, registro, user, onDone } */
export function QuantityDialog({ open, onClose, registro, user, onDone }) {
  const actual = parseCantidad(registro?.cantidad);
  const [nueva, setNueva] = useState('');
  const [motivo, setMotivo] = useState('');
  const [units, setUnits] = useState([]);
  const [selected, setSelected] = useState([]);
  const [confirmInfo, setConfirmInfo] = useState(null);
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);

  const conUnidades = tieneUnidades(registro?.tipo);
  const parsed = parseCantidad(nueva);
  const bajando = actual.ok && parsed.ok && parsed.value < actual.value;
  const subiendo = actual.ok && parsed.ok && parsed.value > actual.value;
  const faltan = bajando ? actual.value - parsed.value : 0;

  useEffect(() => {
    if (!open) return;
    setNueva(actual.ok ? String(actual.value) : '');
    setMotivo(''); setSelected([]); setConfirmInfo(null); setProgress(null);
    if (conUnidades) readUnits(registro.id).then(setUnits).catch((e) => { console.error(e); toast.error('No se pudieron cargar las unidades.'); });
  }, [open, registro?.id]);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const run = async (confirmed = false) => {
    setBusy(true);
    try {
      if (subiendo) {
        const r = await increaseQuantity(registro.id, parsed.value, { confirmed, user, onProgress: setProgress });
        if (r.status === 'needs-confirmation') {
          setConfirmInfo({ nombre: registro.equipo, tipo: registro.tipo, cantidad: r.cantidad, threshold: r.threshold, action: r.action });
          return;
        }
        if (r.status === 'error') throw new Error(r.error);
        toast(conUnidades ? `Se crearon ${r.created} unidades con código (pendientes de imprimir).` : 'Cantidad actualizada.');
      } else if (bajando) {
        const r = await decreaseQuantity(registro.id, parsed.value, conUnidades ? selected : null, { motivo, user });
        if (r.status === 'error') throw new Error(r.error);
        if (conUnidades) await resolveReportsForUnits(registro.id, selected, motivo, user);
        toast(conUnidades ? `${selected.length} unidad(es) dadas de baja.` : 'Cantidad actualizada.');
      }
      setConfirmInfo(null);
      onDone?.();
      onClose?.();
    } catch (e) {
      toast.error(e.message || 'No se pudo cambiar la cantidad.');
    } finally {
      setBusy(false);
    }
  };

  const invalido = !parsed.ok || !actual.ok || parsed.value === actual.value
    || (conUnidades && parsed.ok && parsed.value < 1)
    || (bajando && conUnidades && (selected.length !== faltan || motivo.trim().length < 5));

  if (!registro) return null;
  return (
    <>
      <Dialog open={!!open && !confirmInfo} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
        <DialogTitle>Cambiar cantidad: {registro.equipo}</DialogTitle>
        <DialogContent>
          {!actual.ok && <Alert severity="error" sx={{ mb: 2 }}>La cantidad actual no es válida ({actual.reason}). Corrígela primero en Editar.</Alert>}
          <Typography variant="body2" sx={{ mb: 1 }}>
            Cantidad actual: <strong>{actual.ok ? actual.value : '—'}</strong>
            {conUnidades && ' (= unidades activas; cada una lleva su código)'}
          </Typography>
          <TextField fullWidth size="small" label="Nueva cantidad" value={nueva} onChange={(e) => setNueva(e.target.value)} />
          {subiendo && conUnidades && (
            <Alert severity="info" sx={{ mt: 2 }}>Se crearán {parsed.value - actual.value} unidades nuevas con código y quedarán pendientes de imprimir.</Alert>
          )}
          {bajando && conUnidades && (
            <>
              <Alert severity="warning" sx={{ mt: 2 }}>
                Marca exactamente <strong>{faltan}</strong> unidad(es) para dar de baja ({selected.length} seleccionada{selected.length === 1 ? '' : 's'}). Nunca se dan de baja unidades sin que las elijas.
              </Alert>
              <div style={{ maxHeight: 240, overflowY: 'auto', marginTop: 8 }}>
                {units.map((u) => (
                  <FormControlLabel key={u.id} sx={{ display: 'block' }}
                    control={<Checkbox size="small" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} />}
                    label={`${u.codigo}${u.numeroSerie ? ` · serie ${u.numeroSerie}` : ''}${u.estado && u.estado !== 'bueno' ? ` · ${u.estado}` : ''}`} />
                ))}
              </div>
              <TextField fullWidth size="small" label="Motivo de la baja (obligatorio, mín. 5 caracteres)" value={motivo} onChange={(e) => setMotivo(e.target.value)} sx={{ mt: 2 }} placeholder="Motivo de la baja" />
            </>
          )}
          {bajando && !conUnidades && <Alert severity="info" sx={{ mt: 2 }}>Se reducirá la cantidad del insumo.</Alert>}
          {progress && <LinearProgress variant="determinate" value={Math.min(100, (progress.done / progress.total) * 100)} sx={{ mt: 2 }} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant="contained" onClick={() => run(false)} disabled={busy || invalido}>Aplicar</Button>
        </DialogActions>
      </Dialog>
      <ThresholdConfirmDialog open={!!open && !!confirmInfo} info={confirmInfo} busy={busy} onCancel={() => setConfirmInfo(null)} onConfirm={() => run(true)} />
    </>
  );
}

export default QuantityDialog;

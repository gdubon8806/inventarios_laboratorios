// Modal para reportar un artículo (lo puede usar cualquier usuario con sesión, incluido el invitado).
//
// Props: { open, onClose, registro, unidad|null, idLab, user, onCreated }  (export default)
//  - registro: registro (item) reportado. unidad: unidad concreta (Mobiliario/Equipo/Herramienta) o null.
//  - Si el registro usa unidades y `unidad` es null, el modal lista las unidades (por código) para elegir una.
//  - onCreated(reportId): se llama tras crear el reporte para que quien abrió el modal refresque su lista.
import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import toast from 'react-hot-toast';
import createReport, { MAX_COMENTARIO } from './firebase/create-report';
import { readUnits } from './firebase/manage-units';
import { tieneUnidades } from '../lib/constants/tipos';

export default function ReportModal({ open, onClose, registro, unidad = null, idLab, user, onCreated }) {
  const [comentario, setComentario] = useState('');
  const [unidadId, setUnidadId] = useState('');
  const [units, setUnits] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [busy, setBusy] = useState(false);

  const necesitaElegirUnidad = !!registro && tieneUnidades(registro.tipo) && !unidad;

  useEffect(() => {
    if (!open) return;
    setComentario('');
    setUnidadId('');
    if (!necesitaElegirUnidad) return;
    let cancelled = false;
    setLoadingUnits(true);
    readUnits(registro.id)
      .then((list) => { if (!cancelled) setUnits(list); })
      .catch((e) => { console.error(e); if (!cancelled) toast.error('No se pudieron cargar las unidades.'); })
      .finally(() => { if (!cancelled) setLoadingUnits(false); });
    return () => { cancelled = true; };
  }, [open, registro?.id, necesitaElegirUnidad]);

  const submit = async () => {
    const elegida = unidad ?? units.find((u) => u.id === unidadId) ?? null;
    setBusy(true);
    try {
      const id = await createReport({ registro, unidad: elegida, idLab, comentario, user });
      toast('Reporte enviado. Gracias por avisar.');
      onCreated?.(id);
      onClose?.();
    } catch (error) {
      toast.error(error.message || 'No se pudo enviar el reporte.');
    } finally {
      setBusy(false);
    }
  };

  if (!registro) return null;
  return (
    <Dialog open={!!open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Reportar: {registro.equipo}</DialogTitle>
      <DialogContent>
        {unidad && (
          <Typography variant="body2" sx={{ mb: 2 }}>Unidad: <strong>{unidad.codigo}</strong></Typography>
        )}
        {necesitaElegirUnidad && (
          <TextField
            select fullWidth size="small" label="Unidad reportada" value={unidadId}
            onChange={(e) => setUnidadId(e.target.value)} sx={{ mt: 1, mb: 2 }}
            helperText={loadingUnits ? 'Cargando unidades…' : units.length === 0 ? 'No hay unidades con código todavía.' : 'Elige la unidad por su código.'}
          >
            {units.map((u) => <MenuItem key={u.id} value={u.id}>{u.codigo}{u.numeroSerie ? ` · serie ${u.numeroSerie}` : ''}</MenuItem>)}
          </TextField>
        )}
        <TextField
          fullWidth multiline minRows={3} label="¿Qué problema tiene? (obligatorio)" value={comentario}
          onChange={(e) => setComentario(e.target.value.slice(0, MAX_COMENTARIO))} sx={{ mt: 1 }}
          helperText={`${comentario.length}/${MAX_COMENTARIO}`}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button
          variant="contained" color="error" onClick={submit}
          disabled={busy || comentario.trim().length === 0 || (necesitaElegirUnidad && !unidadId)}
        >
          Enviar reporte
        </Button>
      </DialogActions>
    </Dialog>
  );
}

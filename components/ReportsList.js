// Lista de reportes de un registro. Todos ven los reportes abiertos y sus comentarios;
// SOLO el admin ve la solución, resuelve (eligiendo el nuevo estado) y consulta los ya resueltos.
//
// Props: { registro, reports (abiertos de este registro), isAdmin, user, onChanged, onReport }
//   onChanged(): refrescar lo que dependa de los reportes (lista del lab, registro...)
//   onReport(): abrir el ReportModal (lo controla quien usa este componente)
import { useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import toast from 'react-hot-toast';
import { readReportsByRecord, readSolucion } from './firebase/read-reports';
import { resolveReport } from './firebase/resolve-report';

const ESTADO_LABEL = { bueno: 'Bueno', malo: 'Malo', reparacion: 'En reparación' };

function fmt(ts) {
  const d = ts?.toDate ? ts.toDate() : null;
  return d ? d.toLocaleString('es-HN') : 'Fecha no disponible';
}

export default function ReportsList({ registro, reports = [], isAdmin, user, onChanged, onReport }) {
  const [resolving, setResolving] = useState(null);
  const [solucion, setSolucion] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState('bueno');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(null); // admin: reportes resueltos con su solución

  const abrirResolver = (r) => { setResolving(r); setSolucion(''); setNuevoEstado('bueno'); };

  const confirmarResolver = async () => {
    setBusy(true);
    try {
      await resolveReport(resolving, { solucion, nuevoEstado, user });
      toast('Reporte resuelto.');
      setResolving(null);
      setHistory(null);
      onChanged?.();
    } catch (error) {
      toast.error(error.message || 'No se pudo resolver el reporte.');
    } finally {
      setBusy(false);
    }
  };

  const verResueltos = async () => {
    try {
      const all = await readReportsByRecord(registro.id);
      const resueltos = all.filter((r) => r.estadoReporte === 'resuelto');
      const conSolucion = await Promise.all(resueltos.map(async (r) => ({ ...r, privado: await readSolucion(r.id).catch(() => null) })));
      setHistory(conSolucion);
    } catch (error) {
      console.error(error);
      toast.error('No se pudieron cargar los reportes resueltos.');
    }
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <Typography variant="h6">Reportes {reports.length > 0 && <Chip size="small" color="error" label={`${reports.length} abierto${reports.length === 1 ? '' : 's'}`} />}</Typography>
        <div>
          {isAdmin && <Button size="small" onClick={verResueltos}>Ver resueltos y soluciones</Button>}
          {onReport && <Button size="small" color="error" variant="outlined" onClick={onReport}>Reportar</Button>}
        </div>
      </div>

      {reports.length === 0 && <Typography variant="body2" color="text.secondary">No hay reportes abiertos.</Typography>}
      {reports.map((r) => (
        <Alert key={r.id} severity="warning" sx={{ mt: 1 }}
          action={isAdmin ? <Button color="inherit" size="small" onClick={() => abrirResolver(r)}>Resolver</Button> : null}>
          <strong>{r.codigo ?? registro.equipo}</strong> · {r.reportadoPor?.email ?? 'usuario'} · {fmt(r.fecha)}
          <div>{r.comentario}</div>
        </Alert>
      ))}

      {isAdmin && history && (
        <div style={{ marginTop: '1rem' }}>
          <Typography variant="subtitle1">Reportes resueltos</Typography>
          {history.length === 0 && <Typography variant="body2" color="text.secondary">Todavía no hay reportes resueltos.</Typography>}
          {history.map((r) => (
            <Alert key={r.id} severity="success" sx={{ mt: 1 }}>
              <strong>{r.codigo ?? registro.equipo}</strong> · {r.reportadoPor?.email ?? 'usuario'} · {fmt(r.fecha)}
              <div>Reporte: {r.comentario}</div>
              <div>Solución: {r.privado?.solucion ?? '—'}{r.privado?.nuevoEstado ? ` (quedó ${ESTADO_LABEL[r.privado.nuevoEstado] ?? r.privado.nuevoEstado})` : ''}</div>
            </Alert>
          ))}
        </div>
      )}

      <Dialog open={!!resolving} onClose={busy ? undefined : () => setResolving(null)} fullWidth maxWidth="sm">
        <DialogTitle>Resolver reporte</DialogTitle>
        <DialogContent>
          {resolving && <Typography variant="body2" sx={{ mb: 2 }}>{resolving.comentario}</Typography>}
          <TextField fullWidth multiline minRows={3} label="Solución (obligatoria)" value={solucion} onChange={(e) => setSolucion(e.target.value)} sx={{ mt: 1 }} />
          <TextField select fullWidth size="small" label="Estado en que queda" value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value)} sx={{ mt: 2 }}>
            {Object.entries(ESTADO_LABEL).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolving(null)} disabled={busy}>Cancelar</Button>
          <Button variant="contained" onClick={confirmarResolver} disabled={busy || solucion.trim().length < 3}>Resolver</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

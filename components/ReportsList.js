// Lista de reportes de un registro. Todos ven los reportes (código, fecha, estado y comentario) y pueden crear uno;
// SOLO el admin, y solo cuando entró en modo EDITAR (`canManage`), puede poner un reporte «En revisión», agregar un
// comentario interno y resolverlo (eligiendo el nuevo estado). La solución y el comentario interno los ve solo el admin.
//
// Props: { registro, reports (no resueltos de este registro), isAdmin, canManage, user, onChanged, onReport }
//   onChanged(): refrescar lo que dependa de los reportes (lista del lab, registro...)
//   onReport(): abrir el ReportModal (lo controla quien usa este componente)
import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import toast from 'react-hot-toast';
import { readReportsByRecord, readSolucion, readRevision } from './firebase/read-reports';
import { resolveReport, markInReview } from './firebase/resolve-report';

const ESTADO_LABEL = { bueno: 'Bueno', malo: 'Malo', reparacion: 'En reparación' };
const REPORTE_ESTADO = {
  abierto: { label: 'Abierto', color: 'error' },
  enRevision: { label: 'En revisión', color: 'warning' },
  resuelto: { label: 'Resuelto', color: 'success' },
};

function fmt(ts) {
  const d = ts?.toDate ? ts.toDate() : null;
  return d ? d.toLocaleString('es-HN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Fecha no disponible';
}

function ReportCard({ r, registro, isAdmin, extra, action }) {
  const est = REPORTE_ESTADO[r.estadoReporte] ?? REPORTE_ESTADO.abierto;
  return (
    <Box sx={{ border: '1px solid #e0e0e0', borderLeft: '5px solid', borderLeftColor: `${est.color}.main`, borderRadius: 1.5, p: 1.25, mt: 1, bgcolor: '#fff' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
        <Typography component="span" sx={{ fontWeight: 700, fontSize: '.95rem' }}>{r.codigo ?? registro.equipo}</Typography>
        <Chip size="small" color={est.color} label={est.label} />
        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>{fmt(r.fecha)}</Typography>
      </Box>
      <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-word' }}>{r.comentario}</Typography>
      {r.detalleAdicional ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, wordBreak: 'break-word' }}>Detalle: {r.detalleAdicional}</Typography>
      ) : null}
      {isAdmin && r.reportadoPor?.email ? <Typography variant="caption" color="text.secondary">Reportó: {r.reportadoPor.email}</Typography> : null}
      {extra}
      {action ? <Box sx={{ mt: 0.75 }}>{action}</Box> : null}
    </Box>
  );
}

export default function ReportsList({ registro, reports = [], isAdmin, canManage = false, user, onChanged, onReport }) {
  const [review, setReview] = useState(null); // reporte que se está revisando
  const [nota, setNota] = useState('');
  const [notaPrevia, setNotaPrevia] = useState(null);
  const [resolving, setResolving] = useState(null);
  const [solucion, setSolucion] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState('bueno');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(null); // reportes resueltos (la solución solo la ve el admin)

  const abrirRevision = async (r) => {
    setReview(r); setNota(''); setNotaPrevia(null);
    try { setNotaPrevia(await readRevision(r.id)); } catch { /* sin comentario previo */ }
  };

  const ponerEnRevision = async () => {
    setBusy(true);
    try {
      await markInReview(review, { comentario: nota, user });
      toast('Reporte en revisión.');
      setReview(null);
      onChanged?.();
    } catch (error) {
      toast.error(error.message || 'No se pudo actualizar el reporte.');
    } finally {
      setBusy(false);
    }
  };

  const abrirResolver = () => { setResolving(review); setReview(null); setSolucion(''); setNuevoEstado('bueno'); };

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
      const conSolucion = await Promise.all(resueltos.map(async (r) => ({ ...r, privado: isAdmin ? await readSolucion(r.id).catch(() => null) : null })));
      setHistory(conSolucion);
    } catch (error) {
      console.error(error);
      toast.error('No se pudieron cargar los reportes resueltos.');
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ fontSize: '1.05rem' }}>
          Reportes {reports.length > 0 && <Chip size="small" color="error" label={`${reports.length} abierto${reports.length === 1 ? '' : 's'}`} />}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          <Button size="small" variant="outlined" onClick={history ? () => setHistory(null) : verResueltos}>{history ? 'Ocultar resueltos' : 'Ver resueltos'}</Button>
          {onReport && <Button size="small" color="error" variant="contained" onClick={onReport}>Crear reporte</Button>}
        </Box>
      </Box>

      {reports.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>No hay reportes abiertos.</Typography>}
      {reports.map((r) => (
        <ReportCard
          key={r.id} r={r} registro={registro} isAdmin={isAdmin}
          action={canManage ? <Button size="small" variant="outlined" onClick={() => abrirRevision(r)}>Revisar</Button> : null}
        />
      ))}

      {history && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2">Reportes resueltos</Typography>
          {history.length === 0 && <Typography variant="body2" color="text.secondary">Todavía no hay reportes resueltos.</Typography>}
          {history.map((r) => (
            <ReportCard
              key={r.id} r={r} registro={registro} isAdmin={isAdmin}
              extra={isAdmin ? (
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  <strong>Solución:</strong> {r.privado?.solucion ?? '—'}{r.privado?.nuevoEstado ? ` (quedó ${ESTADO_LABEL[r.privado.nuevoEstado] ?? r.privado.nuevoEstado})` : ''}
                </Typography>
              ) : null}
            />
          ))}
        </Box>
      )}

      {/* Revisar (solo admin en modo editar): comentario interno, «En revisión» o resolver */}
      <Dialog open={!!review} onClose={busy ? undefined : () => setReview(null)} fullWidth maxWidth="sm">
        <DialogTitle>Revisar reporte {review?.codigo ?? ''}</DialogTitle>
        <DialogContent>
          {review && <Typography variant="body2" sx={{ mb: 1, wordBreak: 'break-word' }}>{review.comentario}</Typography>}
          {review?.detalleAdicional ? <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Detalle: {review.detalleAdicional}</Typography> : null}
          {notaPrevia?.comentario ? (
            <Typography variant="body2" sx={{ mb: 1, p: 1, bgcolor: '#fff8e1', borderRadius: 1 }}>
              <strong>Comentario anterior:</strong> {notaPrevia.comentario}
            </Typography>
          ) : null}
          <TextField fullWidth multiline minRows={2} label="Agregar comentario interno (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} sx={{ mt: 1 }} helperText="Solo lo ve el administrador." />
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 0.5 }}>
          <Button onClick={() => setReview(null)} disabled={busy}>Cancelar</Button>
          <Button variant="outlined" color="warning" onClick={ponerEnRevision} disabled={busy}>
            {review?.estadoReporte === 'enRevision' ? 'Guardar comentario' : 'Poner en revisión'}
          </Button>
          <Button variant="contained" onClick={abrirResolver} disabled={busy}>Resolver…</Button>
        </DialogActions>
      </Dialog>

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
    </Box>
  );
}

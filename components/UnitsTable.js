// Tabla de unidades de un registro (Mobiliario / Equipo / Herramienta): una fila por unidad física con su código.
// Solo la usa el admin (edición fila por fila, imprimir etiqueta, reportar, baja con motivo, reactivar).
//
// Props: { registro, idLab, labName, user, reports (abiertos del registro), onChanged, highlightUnitId }
//   onChanged(): el registro o sus unidades cambiaron (el padre refresca la lista / el cuadro del lab)
import { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import toast from 'react-hot-toast';
import { readUnits, updateUnit, deactivateUnits, reactivateUnit, markPrinted } from './firebase/manage-units';
import { resolveReportsForUnits } from './firebase/resolve-report';
import ReportModal from './ReportModal';
import PrintLabelsDialog from './labels/PrintLabelsDialog';
import { ESTADOS } from '../lib/codes/prefixes';

const ESTADO_LABEL = { bueno: 'Bueno', malo: 'Malo', reparacion: 'En reparación' };
const CODE_CHIP = {
  sinCodigo: { label: 'Sin código', color: 'warning' },
  pendienteImprimir: { label: 'Pendiente imprimir', color: 'error' },
  impreso: { label: 'Impreso', color: 'success' },
};
const cell = { padding: '4px 6px', verticalAlign: 'middle', borderBottom: '1px solid #ddd' };
const inputStyle = { width: '100%', minWidth: 90, padding: '2px 4px', borderRadius: 6, border: '1px solid #bbb' };

export default function UnitsTable({ registro, idLab, labName, user, reports = [], onChanged, highlightUnitId = null }) {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBajas, setShowBajas] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [baja, setBaja] = useState(null); // unidad que se va a dar de baja
  const [motivo, setMotivo] = useState('');
  const [reportUnit, setReportUnit] = useState(null);
  const [printLabels, setPrintLabels] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUnits(await readUnits(registro.id, { includeInactive: showBajas }));
    } catch (e) {
      console.error(e);
      toast.error('No se pudieron cargar las unidades.');
    } finally {
      setLoading(false);
    }
  }, [registro.id, showBajas]);

  useEffect(() => { load(); }, [load]);

  const reportedIds = useMemo(() => new Set(reports.filter((r) => r.unidadId).map((r) => r.unidadId)), [reports]);
  const activas = units.filter((u) => u.activo !== false);

  const setDraft = (id, field, value) => setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? {}), [field]: value } }));
  const valueOf = (u, field) => drafts[u.id]?.[field] ?? u[field] ?? '';

  const guardar = async (u) => {
    const d = drafts[u.id];
    if (!d) return;
    setSavingId(u.id);
    const r = await updateUnit(registro.id, u.id, d, { user });
    setSavingId(null);
    if (r.status === 'error') { toast.error(r.error); return; }
    toast('Unidad actualizada.');
    setDrafts((all) => { const n = { ...all }; delete n[u.id]; return n; });
    await load();
    onChanged?.();
  };

  const confirmarBaja = async () => {
    if (motivo.trim().length < 5) { toast.error('Indica el motivo de la baja (mínimo 5 caracteres).'); return; }
    const r = await deactivateUnits(registro.id, [baja.id], { motivo, user });
    if (r.status === 'error') { toast.error(r.error); return; }
    try { await resolveReportsForUnits(registro.id, [baja.id], motivo, user); } catch (e) { console.error(e); }
    toast(`Unidad ${baja.codigo} dada de baja.`);
    setBaja(null); setMotivo('');
    await load();
    onChanged?.();
  };

  const reactivar = async (u) => {
    const r = await reactivateUnit(registro.id, u.id, { user });
    if (r.status === 'error') { toast.error(r.error); return; }
    toast(`Unidad ${u.codigo} reactivada.`);
    await load();
    onChanged?.();
  };

  const abrirImpresion = (list) => {
    const labels = list.filter((u) => u.codigo).map((u) => ({
      id: `${registro.id}/${u.id}`, codigo: u.codigo, nombre: registro.equipo, lab: labName ?? '',
      tipo: registro.tipo, estadoCodigo: u.estadoCodigo ?? 'sinCodigo',
    }));
    if (labels.length === 0) { toast.error('Estas unidades todavía no tienen código.'); return; }
    setPrintLabels(labels);
  };

  const onPrinted = async (ids) => {
    const targets = ids.map((id) => ({ recordId: registro.id, unidadId: id.split('/')[1] }));
    const r = await markPrinted(targets);
    if (r.status === 'error') toast.error(r.error);
    else { await load(); onChanged?.(); }
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Typography variant="h6">Unidades ({activas.length})</Typography>
        <div>
          <FormControlLabel control={<Switch size="small" checked={showBajas} onChange={(e) => setShowBajas(e.target.checked)} />} label="Ver bajas" />
          <Button size="small" variant="outlined" onClick={() => abrirImpresion(activas)}>Imprimir etiquetas</Button>
        </div>
      </div>

      {loading && <Typography variant="body2">Cargando unidades…</Typography>}
      {!loading && units.length === 0 && (
        <Alert severity="info" sx={{ mt: 1 }}>
          Este registro todavía no tiene unidades con código. Usa «Generar códigos de barra» en la tarjeta del laboratorio.
        </Alert>
      )}

      {units.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', background: '#eee' }}>
                {['Código', 'Serie', 'Cód. Fundaempresa', 'Estado', 'Observaciones', '', 'Acciones'].map((h) => <th key={h} style={cell}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {units.map((u) => {
                const inactiva = u.activo === false;
                const dirty = !!drafts[u.id];
                const chip = CODE_CHIP[u.estadoCodigo ?? 'sinCodigo'];
                return (
                  <tr key={u.id} style={{
                    background: highlightUnitId === u.id ? '#fff9c4' : inactiva ? '#f5f5f5' : undefined,
                    opacity: inactiva ? 0.7 : 1,
                  }}>
                    <td style={cell}><strong>{u.codigo ?? '—'}</strong> <Chip size="small" {...chip} variant="outlined" /></td>
                    <td style={cell}><input style={inputStyle} disabled={inactiva} value={valueOf(u, 'numeroSerie')} onChange={(e) => setDraft(u.id, 'numeroSerie', e.target.value)} /></td>
                    <td style={cell}><input style={inputStyle} disabled={inactiva} value={valueOf(u, 'codigoFundaempresa')} onChange={(e) => setDraft(u.id, 'codigoFundaempresa', e.target.value)} /></td>
                    <td style={cell}>
                      <select style={inputStyle} disabled={inactiva} value={drafts[u.id]?.estado ?? u.estado ?? 'bueno'} onChange={(e) => setDraft(u.id, 'estado', e.target.value)}>
                        {ESTADOS.map((s) => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
                      </select>
                    </td>
                    <td style={cell}><input style={inputStyle} disabled={inactiva} value={valueOf(u, 'observaciones')} onChange={(e) => setDraft(u.id, 'observaciones', e.target.value)} /></td>
                    <td style={cell}>{reportedIds.has(u.id) && <Chip size="small" color="error" label="Reportada" />}{inactiva && <Chip size="small" label={`Baja: ${u.motivoBaja ?? ''}`} />}</td>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                      {inactiva ? (
                        <Button size="small" onClick={() => reactivar(u)}>Reactivar</Button>
                      ) : (
                        <>
                          {dirty && <Button size="small" variant="contained" disabled={savingId === u.id} onClick={() => guardar(u)}>Guardar</Button>}
                          <Button size="small" onClick={() => abrirImpresion([u])}>Etiqueta</Button>
                          <Button size="small" color="error" onClick={() => setReportUnit(u)}>Reportar</Button>
                          <Button size="small" color="error" onClick={() => { setBaja(u); setMotivo(''); }}>Baja</Button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!baja} onClose={() => setBaja(null)} fullWidth maxWidth="xs">
        <DialogTitle>Dar de baja {baja?.codigo}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>La cantidad del registro bajará en 1. La unidad queda en la papelera y su código nunca se reutiliza.</Typography>
          <TextField fullWidth size="small" label="Motivo (obligatorio, mín. 5 caracteres)" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: dañada, perdida, traslado, obsoleta" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBaja(null)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={confirmarBaja} disabled={motivo.trim().length < 5}>Dar de baja</Button>
        </DialogActions>
      </Dialog>

      <ReportModal open={!!reportUnit} onClose={() => setReportUnit(null)} registro={registro} unidad={reportUnit} idLab={idLab} user={user} onCreated={() => onChanged?.()} />

      <PrintLabelsDialog
        open={!!printLabels} onClose={() => setPrintLabels(null)} labName={`${labName ?? ''} — ${registro.equipo}`}
        labels={printLabels ?? []} onConfirmed={onPrinted}
      />
    </div>
  );
}

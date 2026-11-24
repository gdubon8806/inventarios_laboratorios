// Unidades de un registro (Mobiliario / Equipo / Herramienta): una por unidad física con su código, marca, modelo,
// serie, Fundaempresa, estado y observaciones.
//   - Modo VER (todos los usuarios): solo lectura + botón «Reportar» por unidad.
//   - Modo EDITAR (`editable`, solo admin): edición por unidad (incluida marca y modelo), etiqueta, baja y reactivar.
//   - En pantallas angostas NO se muestra la tabla: un botón «Revisar registros» abre la lista de códigos y, al elegir uno,
//     su ficha en vertical (estado y toda su información) con su botón de reportar.
//
// Props: { registro, idLab, labName, user, reports (abiertos del registro), editable, onChanged, highlightUnitId }
//   onChanged(): el registro o sus unidades cambiaron (el padre refresca la lista / el cuadro del lab)
import { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
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
import useMediaQuery from '@mui/material/useMediaQuery';
import toast from 'react-hot-toast';
import { readUnits, updateUnit, deactivateUnits, reactivateUnit, markPrinted } from './firebase/manage-units';
import { resolveReportsForUnits } from './firebase/resolve-report';
import ReportModal from './ReportModal';
import PrintLabelsDialog from './labels/PrintLabelsDialog';
import { ESTADOS } from '../lib/codes/prefixes';

const ESTADO_LABEL = { bueno: 'Bueno', malo: 'Malo', reparacion: 'En reparación' };
const ESTADO_COLOR = { bueno: 'success', malo: 'error', reparacion: 'warning' };
const CODE_CHIP = {
  sinCodigo: { label: 'Sin código', color: 'warning' },
  pendienteImprimir: { label: 'Pendiente imprimir', color: 'error' },
  impreso: { label: 'Impreso', color: 'success' },
};
const cell = { padding: '4px 6px', verticalAlign: 'middle', borderBottom: '1px solid #ddd' };
const inputStyle = { width: '100%', minWidth: 80, padding: '3px 5px', borderRadius: 6, border: '1px solid #bbb', font: 'inherit' };

export default function UnitsTable({ registro, idLab, labName, user, reports = [], editable = false, refreshKey = 0, onChanged, highlightUnitId = null }) {
  const compact = useMediaQuery('(max-width:899px)');
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBajas, setShowBajas] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [baja, setBaja] = useState(null); // unidad que se va a dar de baja
  const [motivo, setMotivo] = useState('');
  const [reportUnit, setReportUnit] = useState(null);
  const [printLabels, setPrintLabels] = useState(null);
  const [browsing, setBrowsing] = useState(false); // móvil: lista de códigos abierta
  const [pickedId, setPickedId] = useState(highlightUnitId); // móvil: unidad elegida

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUnits(await readUnits(registro.id, { includeInactive: editable && showBajas }));
    } catch (e) {
      console.error(e);
      toast.error('No se pudieron cargar las unidades.');
    } finally {
      setLoading(false);
    }
  }, [registro.id, showBajas, editable, refreshKey]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (highlightUnitId) { setPickedId(highlightUnitId); setBrowsing(true); } }, [highlightUnitId]);

  const reportedIds = useMemo(() => new Set(reports.filter((r) => r.unidadId).map((r) => r.unidadId)), [reports]);
  const activas = units.filter((u) => u.activo !== false);

  const setDraft = (id, field, value) => setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? {}), [field]: value } }));
  // marca y modelo: si la unidad no tiene valor propio se muestra el del registro
  const valueOf = (u, field) => drafts[u.id]?.[field] ?? u[field] ?? ((field === 'marca' || field === 'modelo') ? registro[field] : '') ?? '';

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
    setBaja(null); setMotivo(''); setPickedId(null);
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

  const picked = units.find((u) => u.id === pickedId) ?? null;

  // ---- Campos de una unidad (ficha vertical en móvil) ----
  const FIELDS = [
    ['marca', 'Marca'], ['modelo', 'Modelo'], ['numeroSerie', 'Número de serie'], ['codigoFundaempresa', 'Cód. Fundaempresa'], ['observaciones', 'Observaciones'],
  ];

  const unitCard = (u) => {
    const inactiva = u.activo === false;
    const dirty = !!drafts[u.id];
    const est = drafts[u.id]?.estado ?? u.estado ?? 'bueno';
    return (
      <Box sx={{ border: '1px solid #cfd8dc', borderRadius: 2, p: 1.5, mt: 1, bgcolor: '#fff', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontWeight: 700 }}>{u.codigo ?? '—'}</Typography>
          <Chip size="small" color={ESTADO_COLOR[est] ?? 'default'} label={ESTADO_LABEL[est] ?? est} />
          {reportedIds.has(u.id) && <Chip size="small" color="error" label="Reportada" />}
          {inactiva && <Chip size="small" label={`Baja: ${u.motivoBaja ?? ''}`} />}
        </Box>
        {editable && !inactiva && (
          <TextField select SelectProps={{ native: true }} size="small" label="Estado" value={est} onChange={(e) => setDraft(u.id, 'estado', e.target.value)}>
            {ESTADOS.map((s) => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
          </TextField>
        )}
        {FIELDS.map(([k, label]) => (editable && !inactiva ? (
          <TextField key={k} size="small" label={label} value={valueOf(u, k)} onChange={(e) => setDraft(u.id, k, e.target.value)} />
        ) : (
          <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, fontSize: '.9rem', borderBottom: '1px dashed #e0e0e0', pb: 0.4 }}>
            <span style={{ color: '#666' }}>{label}</span>
            <span style={{ textAlign: 'right', wordBreak: 'break-word' }}>{valueOf(u, k) || '—'}</span>
          </Box>
        )))}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
          {!inactiva && <Button size="small" variant="outlined" color="error" onClick={() => setReportUnit(u)}>Reportar esta unidad</Button>}
          {editable && !inactiva && dirty && <Button size="small" variant="contained" disabled={savingId === u.id} onClick={() => guardar(u)}>Guardar</Button>}
          {editable && !inactiva && <Button size="small" variant="outlined" onClick={() => abrirImpresion([u])}>Etiqueta</Button>}
          {editable && !inactiva && <Button size="small" variant="outlined" color="error" onClick={() => { setBaja(u); setMotivo(''); }}>Baja</Button>}
          {editable && inactiva && <Button size="small" variant="outlined" onClick={() => reactivar(u)}>Reactivar</Button>}
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6" sx={{ fontSize: '1.05rem' }}>Unidades ({activas.length})</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {editable && <FormControlLabel sx={{ m: 0 }} control={<Switch size="small" checked={showBajas} onChange={(e) => setShowBajas(e.target.checked)} />} label="Ver bajas" />}
          {editable && <Button size="small" variant="outlined" onClick={() => abrirImpresion(activas)}>Imprimir etiquetas</Button>}
        </Box>
      </Box>

      {loading && <Typography variant="body2" sx={{ mt: 1 }}>Cargando unidades…</Typography>}
      {!loading && units.length === 0 && (
        <Alert severity="info" sx={{ mt: 1 }}>
          Este registro todavía no tiene unidades con código.{editable ? ' Usa «Generar códigos de barra» en la tarjeta del laboratorio.' : ''}
        </Alert>
      )}

      {units.length > 0 && compact && (
        <Box sx={{ mt: 1 }}>
          <Button
            fullWidth variant="outlined" onClick={() => setBrowsing((b) => !b)}
            sx={browsing ? { bgcolor: '#D3E3FD', borderColor: '#D3E3FD', color: '#041E49', '&:hover': { bgcolor: '#C2D7FB' } } : { '&:hover': { bgcolor: '#EAF1FD' } }}
          >
            {browsing ? 'Ocultar registros' : `Revisar registros (${activas.length})`}
          </Button>
          {browsing && (
            <>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 0.75, mt: 1.25 }}>
                {units.map((u) => {
                  const elegido = pickedId === u.id;
                  const reportado = reportedIds.has(u.id);
                  return (
                    <Chip
                      key={u.id} label={u.codigo ?? u.id} clickable onClick={() => setPickedId(u.id)} variant="outlined"
                      sx={{
                        opacity: u.activo === false ? 0.6 : 1, bgcolor: '#fff', color: reportado ? '#8C1D18' : '#1F1F1F',
                        borderColor: reportado ? '#E8A39E' : '#C4C7C5',
                        // Seleccionado y hover en tonos claros (nada oscuro)
                        '&:hover': { bgcolor: '#EAF1FD' },
                        ...(elegido ? { bgcolor: '#D3E3FD', color: '#041E49', borderColor: '#0B57D0', borderWidth: 2, fontWeight: 700, '&:hover': { bgcolor: '#C2D7FB' } } : {}),
                      }}
                    />
                  );
                })}
              </Box>
              {picked ? unitCard(picked) : <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Elige un código para ver su información.</Typography>}
            </>
          )}
        </Box>
      )}

      {units.length > 0 && !compact && (
        <Box sx={{ overflowX: 'auto', mt: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', background: '#eceff1' }}>
                {['Código', 'Marca', 'Modelo', 'Serie', 'Cód. Fundaempresa', 'Estado', 'Observaciones', '', 'Acciones'].map((h) => <th key={h} style={cell}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {units.map((u) => {
                const inactiva = u.activo === false;
                const dirty = !!drafts[u.id];
                const chip = CODE_CHIP[u.estadoCodigo ?? 'sinCodigo'];
                const est = drafts[u.id]?.estado ?? u.estado ?? 'bueno';
                const edit = editable && !inactiva;
                const txt = (k) => (edit
                  ? <input style={inputStyle} value={valueOf(u, k)} onChange={(e) => setDraft(u.id, k, e.target.value)} />
                  : (valueOf(u, k) || '—'));
                return (
                  <tr key={u.id} style={{ background: highlightUnitId === u.id ? '#fff9c4' : inactiva ? '#f5f5f5' : undefined, opacity: inactiva ? 0.7 : 1 }}>
                    <td style={cell}><strong>{u.codigo ?? '—'}</strong>{editable && <> <Chip size="small" {...chip} variant="outlined" /></>}</td>
                    <td style={cell}>{txt('marca')}</td>
                    <td style={cell}>{txt('modelo')}</td>
                    <td style={cell}>{txt('numeroSerie')}</td>
                    <td style={cell}>{txt('codigoFundaempresa')}</td>
                    <td style={cell}>
                      {edit ? (
                        <select style={inputStyle} value={est} onChange={(e) => setDraft(u.id, 'estado', e.target.value)}>
                          {ESTADOS.map((s) => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
                        </select>
                      ) : <Chip size="small" color={ESTADO_COLOR[est] ?? 'default'} label={ESTADO_LABEL[est] ?? est} />}
                    </td>
                    <td style={cell}>{txt('observaciones')}</td>
                    <td style={cell}>{reportedIds.has(u.id) && <Chip size="small" color="error" label="Reportada" />}{inactiva && <Chip size="small" label={`Baja: ${u.motivoBaja ?? ''}`} />}</td>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                      {inactiva ? (
                        editable ? <Button size="small" onClick={() => reactivar(u)}>Reactivar</Button> : null
                      ) : (
                        <>
                          {edit && dirty && <Button size="small" variant="contained" disabled={savingId === u.id} onClick={() => guardar(u)}>Guardar</Button>}
                          {edit && <Button size="small" onClick={() => abrirImpresion([u])}>Etiqueta</Button>}
                          <Button size="small" color="error" onClick={() => setReportUnit(u)}>Reportar</Button>
                          {edit && <Button size="small" color="error" onClick={() => { setBaja(u); setMotivo(''); }}>Baja</Button>}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Box>
      )}

      <Dialog open={!!baja} onClose={() => setBaja(null)} fullWidth maxWidth="xs">
        <DialogTitle>Dar de baja {baja?.codigo}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>La cantidad del registro bajará en 1. La unidad queda en la papelera y su código nunca se reutiliza.</Typography>
          <TextField fullWidth size="small" label="Motivo (obligatorio, mín. 5 caracteres)" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo de la baja" />
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
    </Box>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import useMediaQuery from '@mui/material/useMediaQuery';
import CloseIcon from '@mui/icons-material/Close';
import ReportIcon from '@mui/icons-material/ReportProblem';
import PrintIcon from '@mui/icons-material/Print';
import EditIcon from '@mui/icons-material/Edit';
import toast from 'react-hot-toast';

import ZoomableImage from './ZoomableImage';
import CodeSearch from './CodeSearch';
import ReportModal from './ReportModal';
import PrintLabelsDialog from './labels/PrintLabelsDialog';
import { findByCode } from './firebase/find-by-code';
import readLabLabels, { labelIdToTarget } from './firebase/read-lab-labels';
import { markPrinted } from './firebase/manage-units';

import HomeStyles from '../styles/Home.module.css';

// Panel lateral de la pantalla principal (Fase 4). Se muestra junto a la lista de laboratorios una vez
// cargados los datos; en pantallas angostas es un cajón (drawer) que se abre con un botón flotante.
//
// Props:
//   isAdmin: boolean            user: usuario de Firebase (para reportes)
//   labs: laboratorios cargados        selectedLab: laboratorio seleccionado (o null)
//   statuses: { [idLab]: status }      conteos por lab (ver read-lab-statuses.js)
//   externalQuery?: { value, nonce }   búsqueda disparada desde el buscador de laboratorios
//   onSelectLab(labId): se llama cuando una búsqueda encuentra un artículo (para mostrar su laboratorio)
//   onStatusChanged(labId): recargar el estado de un lab (tras imprimir etiquetas)

const ESTADO_COLOR = { bueno: 'success', malo: 'error', reparacion: 'warning' };
const ESTADO_TEXTO = { bueno: 'Bueno', malo: 'Malo', reparacion: 'En reparación' };

function fmtDate(value) {
  if (!value) return null;
  try {
    const d = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('es-HN');
  } catch {
    return null;
  }
}

function Row({ label, value }) {
  const empty = value === undefined || value === null || value === '';
  return (
    <Box sx={{ display: 'flex', gap: 1, py: 0.25, fontSize: '.875rem' }}>
      <Box sx={{ minWidth: 130, color: 'text.secondary' }}>{label}</Box>
      <Box sx={{ color: empty ? 'text.disabled' : 'inherit', wordBreak: 'break-word' }}>{empty ? '—' : String(value)}</Box>
    </Box>
  );
}

function ResultCard({ result, isAdmin, labs, onReport, onPrint, onEdit }) {
  const { registro, unidad } = result;
  const lab = labs.find((l) => l.id === registro.idLab);
  const codigo = unidad?.codigo || registro.codigo || result.code;
  const estado = unidad?.estado || registro.estado || 'bueno';
  const venc = isAdmin && registro.tieneVencimiento ? fmtDate(registro.fechaVencimiento) : null;
  const dadoDeBaja = result.status === 'baja';

  return (
    <Box sx={{ borderRadius: 1, boxShadow: 1, overflow: 'hidden', bgcolor: 'background.paper' }}>
      {registro.imgurl ? (
        <Box sx={{ height: 192 }}><ZoomableImage src={registro.imgurl} alt={registro.equipo || 'Equipo'} enfoque={registro.imgEnfoque} /></Box>
      ) : null}
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ lineHeight: 1.2 }}>{registro.equipo || '(sin nombre)'}</Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', my: 1 }}>
          <Chip size="small" label={codigo} color="primary" />
          {registro.tipo && <Chip size="small" label={registro.tipo} variant="outlined" />}
          <Chip size="small" label={ESTADO_TEXTO[estado] || estado} color={ESTADO_COLOR[estado] || 'default'} />
          {dadoDeBaja && <Chip size="small" label="DADO DE BAJA" color="error" />}
        </Box>
        {result.notice && (
          <Alert severity={dadoDeBaja ? 'warning' : 'info'} sx={{ mb: 1 }}>{result.notice}</Alert>
        )}
        <Row label="Laboratorio" value={lab?.name} />
        <Row label="Marca" value={registro.marca} />
        <Row label="Modelo" value={registro.modelo} />
        <Row label="Cantidad" value={registro.cantidad} />
        <Row label="Ubicación" value={registro.ubicacion} />
        <Row label="Col. localización" value={registro.columnadelocalizacion} />
        <Row label="Número de serie" value={unidad ? unidad.numeroSerie : registro.numeroSerie} />
        <Row label="Cód. Fundaempresa" value={unidad ? unidad.codigoFundaempresa : registro.codigoFundaempresa} />
        {unidad?.observaciones ? <Row label="Obs. de la unidad" value={unidad.observaciones} /> : null}
        <Row label="Observaciones" value={registro.observaciones} />
        {isAdmin && registro.tieneVencimiento && <Row label="Vencimiento" value={venc} />}

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
          <Button size="small" variant="outlined" color="warning" startIcon={<ReportIcon />} onClick={onReport} disabled={dadoDeBaja}>
            Reportar
          </Button>
          {isAdmin && (
            <>
              <Button size="small" variant="outlined" startIcon={<PrintIcon />} onClick={onPrint} disabled={dadoDeBaja || !codigo}>
                Imprimir etiqueta
              </Button>
              <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={onEdit}>
                Editar
              </Button>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function PanelBody({
  isAdmin, user, labs, selectedLab, statuses, externalQuery, onSelectLab, onStatusChanged, onClose,
}) {
  const router = useRouter();
  const movilPanel = useMediaQuery('(max-width:899px)');
  const [result, setResult] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [printOne, setPrintOne] = useState(null); // etiqueta individual
  const [pending, setPending] = useState(null); // { labId, labels } pendientes de imprimir del lab
  const [pendingBusy, setPendingBusy] = useState(false);
  const [printPendingOpen, setPrintPendingOpen] = useState(false);

  const status = selectedLab ? statuses?.[selectedLab.id] : null;

  const handleResult = useCallback((r) => {
    setResult(r);
    if ((r.status === 'found' || r.status === 'replaced' || r.status === 'baja') && r.registro?.idLab) {
      onSelectLab?.(r.registro.idLab);
    }
  }, [onSelectLab]);

  // Cambia de lab → los pendientes cargados ya no corresponden.
  useEffect(() => {
    setPending((p) => (p && selectedLab && p.labId === selectedLab.id ? p : null));
  }, [selectedLab]);

  const pickMatch = async (match) => {
    try {
      const r = await findByCode(match.code, { isAdmin });
      handleResult({ ...r, query: match.code });
    } catch (e) {
      toast.error('No se pudo abrir ese código.');
    }
  };

  const loadPending = async () => {
    if (!selectedLab) return;
    setPendingBusy(true);
    try {
      const labels = await readLabLabels(selectedLab);
      setPending({ labId: selectedLab.id, labels });
    } catch (e) {
      console.error(e);
      toast.error('No se pudieron leer las etiquetas pendientes.');
    } finally {
      setPendingBusy(false);
    }
  };

  const pendingList = useMemo(
    () => (pending ? pending.labels.filter((l) => l.estadoCodigo === 'pendienteImprimir') : []),
    [pending],
  );

  const confirmPrinted = async (ids) => {
    const r = await markPrinted(ids.map(labelIdToTarget));
    if (r.status !== 'ok') throw new Error(r.error || 'No se pudo marcar como impresas');
    toast(`${ids.length} etiqueta(s) marcadas como impresas.`);
    const labId = result?.registro?.idLab || selectedLab?.id;
    if (labId) await onStatusChanged?.(labId);
    if (pending) {
      setPending({
        ...pending,
        labels: pending.labels.map((l) => (ids.includes(l.id) ? { ...l, estadoCodigo: 'impreso' } : l)),
      });
    }
  };

  const oneLabel = result?.registro
    ? {
        id: result.unidad ? `${result.registro.id}/${result.unidad.id}` : result.registro.id,
        codigo: result.unidad?.codigo || result.registro.codigo || result.code,
        nombre: result.registro.equipo || '',
        lab: labs.find((l) => l.id === result.registro.idLab)?.name || '',
        tipo: result.registro.tipo,
        // Se fuerza "pendiente" para que el diálogo la ofrezca aunque ya estuviera impresa (reimpresión puntual).
        estadoCodigo: 'pendienteImprimir',
      }
    : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">Búsqueda por código</Typography>
        {onClose && (
          <IconButton aria-label="cerrar panel" onClick={onClose}><CloseIcon /></IconButton>
        )}
      </Box>

      {/* Pasos (recuadro azul redondeado) */}
      <Box sx={{ borderRadius: '16px', bgcolor: '#D3E3FD', p: 2 }}>
        <Typography variant="subtitle2" sx={{ color: '#1565c0', mb: 0.5 }}>Búsqueda global por código</Typography>
        <Typography variant="body2" sx={{ color: '#27445f' }}>
          {movilPanel
            ? 'Encuentra un artículo con el código de su etiqueta: elige el tipo, escribe los números y busca.'
            : 'Encuentra un artículo con el código de su etiqueta: escanéalo con el lector o escríbelo y pulsa Enter.'}
        </Typography>
      </Box>

      {/* Buscador por código */}
      <CodeSearch isAdmin={isAdmin} onResult={handleResult} externalQuery={externalQuery} />

      {/* Lab actual */}
      <Box sx={{ borderRadius: 2, bgcolor: '#F8F8F8', p: 1.5 }}>
        <Typography variant="caption" color="text.secondary">Laboratorio actual</Typography>
        {selectedLab ? (
          <>
            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>{selectedLab.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              Ubicación: {selectedLab.ubicacion ? selectedLab.ubicacion : 'sin ubicación registrada'}
            </Typography>
            {status && <Typography variant="body2" color="text.secondary">{status.total} registros</Typography>}
            <Button component={Link} href={`/inventory?id=${selectedLab.id}`} size="small" sx={{ mt: 0.5, px: 0 }}>
              Abrir laboratorio
            </Button>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Selecciona un laboratorio (clic en su tarjeta) o busca un código.
          </Typography>
        )}
      </Box>

      {/* Resultado */}
      {result?.status === 'not-found' && <Alert severity="error">Código no encontrado: {result.query}</Alert>}
      {result?.status === 'eliminado' && <Alert severity="warning">{result.notice}</Alert>}
      {result?.status === 'not-code' && (
        <Alert severity="info">«{result.query}» no parece un código. Para buscar por nombre usa el buscador de laboratorios.</Alert>
      )}
      {result?.status === 'error' && <Alert severity="error">Error al buscar: {result.error}</Alert>}
      {result?.status === 'list' && (
        <Box>
          {result.exactCandidate && (
            <ResultCard
              result={result.exactCandidate}
              isAdmin={isAdmin}
              labs={labs}
              onReport={() => { setResult(result.exactCandidate); setReportOpen(true); }}
              onPrint={() => { setResult(result.exactCandidate); setPrintOne(true); }}
              onEdit={() => router.push({ pathname: '/inventory', query: { id: result.exactCandidate.registro.idLab, item: result.exactCandidate.registro.id } })}
            />
          )}
          {result.matches.length === 0 && !result.exactCandidate ? (
            <Alert severity="error">Sin coincidencias para «{result.query}».</Alert>
          ) : (
            <>
              <Typography variant="subtitle2" sx={{ mt: 1 }}>Coincidencias ({result.matches.length})</Typography>
              <List dense sx={{ maxHeight: 200, overflowY: 'auto' }}>
                {result.matches.map((m) => (
                  <ListItemButton key={m.code} onClick={() => pickMatch(m)}>
                    <ListItemText primary={m.code} secondary={m.tipo || ''} />
                  </ListItemButton>
                ))}
              </List>
            </>
          )}
        </Box>
      )}
      {result?.registro && result.status !== 'list' && (
        <ResultCard
          result={result}
          isAdmin={isAdmin}
          labs={labs}
          onReport={() => setReportOpen(true)}
          onPrint={() => setPrintOne(true)}
          onEdit={() => router.push({ pathname: '/inventory', query: { id: result.registro.idLab, item: result.registro.id } })}
        />
      )}

      {/* Pendientes de impresión (admin) */}
      {isAdmin && selectedLab && (
        <>
          <Divider />
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Pendientes de impresión — {selectedLab.name}
            </Typography>
            {status && (
              <Typography variant="body2" color={status.pendienteImprimir > 0 ? 'error' : 'text.secondary'}>
                {status.pendienteImprimir > 0
                  ? `${status.pendienteImprimir} registro(s) con etiquetas por imprimir`
                  : 'Sin etiquetas pendientes'}
                {status.sinCodigo > 0 && ` · ${status.sinCodigo} sin código`}
              </Typography>
            )}
            {!pending ? (
              <Button size="small" sx={{ mt: 1 }} onClick={loadPending} disabled={pendingBusy}>
                {pendingBusy ? 'Cargando…' : 'Ver pendientes'}
              </Button>
            ) : (
              <>
                {pendingList.length === 0 ? (
                  <Alert severity="success" sx={{ mt: 1 }}>No hay etiquetas pendientes en este laboratorio.</Alert>
                ) : (
                  <>
                    <List dense sx={{ maxHeight: 180, overflowY: 'auto' }}>
                      {pendingList.map((l) => (
                        <ListItemText key={l.id} primary={`${l.codigo} · ${l.nombre}`} sx={{ px: 1 }} />
                      ))}
                    </List>
                    <Button size="small" variant="contained" color="error" startIcon={<PrintIcon />} onClick={() => setPrintPendingOpen(true)}>
                      Imprimir pendientes ({pendingList.length})
                    </Button>
                  </>
                )}
              </>
            )}
          </Box>
        </>
      )}

      {/* Modales */}
      {reportOpen && result?.registro && (
        <ReportModal
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          registro={result.registro}
          unidad={result.unidad || null}
          idLab={result.registro.idLab}
          user={user}
          onCreated={() => { setReportOpen(false); toast('Reporte enviado.'); }}
        />
      )}
      {isAdmin && printOne && oneLabel && (
        <PrintLabelsDialog
          open
          onClose={() => setPrintOne(null)}
          labName={oneLabel.lab || 'laboratorio'}
          labels={[oneLabel]}
          onConfirmed={confirmPrinted}
        />
      )}
      {isAdmin && printPendingOpen && pending && (
        <PrintLabelsDialog
          open
          onClose={() => setPrintPendingOpen(false)}
          labName={selectedLab?.name || ''}
          labels={pending.labels}
          onConfirmed={confirmPrinted}
        />
      )}
    </Box>
  );
}

// Cajón desplegable (no fijo): ocupa el 100% del alto y, en pantallas grandes, un ancho amplio.
// Se abre con el botón «Buscar por código» del encabezado (`open` / `onOpenChange` los controla la pantalla principal),
// con el botón flotante en móvil o cuando el buscador de laboratorios recibe un texto que parece un código.
export default function SidePanel({ open, onOpenChange, ...props }) {
  const isMobile = useMediaQuery('(max-width:900px)');
  const [internal, setInternal] = useState(false);
  const isOpen = open ?? internal;
  const setOpen = onOpenChange ?? setInternal;

  useEffect(() => {
    if (props.externalQuery?.nonce) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.externalQuery?.nonce]);

  return (
    <>
      {/* El botón «Buscar por código» vive ahora en el encabezado (PC y celular); ya no hay botón flotante. */}
      <Drawer
        anchor="right"
        open={isOpen}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { width: isMobile ? '100vw' : 'min(620px, 92vw)', height: '100%', bgcolor: '#F8FAFD', borderRadius: isMobile ? 0 : '20px 0 0 20px' } }}
      >
        <PanelBody {...props} onClose={() => setOpen(false)} />
      </Drawer>
    </>
  );
}

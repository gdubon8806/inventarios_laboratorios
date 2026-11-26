// Detalle de un registro. Se abre en dos modos:
//   - 'ver'    (al tocar la tarjeta; cualquier usuario): solo lectura + reportar.
//   - 'editar' (desde «Opciones», solo admin): además permite editar las unidades, imprimir etiquetas, dar de baja
//              y gestionar (revisar / resolver) los reportes.
// PC: rectángulo horizontal con la imagen a un lado y los datos generales al otro; debajo, las unidades y los reportes.
// Celular: imagen arriba y datos generales debajo; las unidades se revisan con el botón «Revisar registros».
import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CommentIcon from '@mui/icons-material/Comment';

import ZoomableImage from './ZoomableImage';
import UnitsTable from './UnitsTable';
import RecordEditForm from './RecordEditForm';
import AddUnitsPanel from './AddUnitsPanel';
import ReportsList from './ReportsList';
import ReportModal from './ReportModal';
import PrintLabelsDialog from './labels/PrintLabelsDialog';
import AddItemCommentCard, { EditItemCommentCard, DeleteItemCommentCard } from './ItemComment';
import readItemCommentsById from './firebase/readItemComments-with-id';
import { markPrinted } from './firebase/manage-units';
import { tieneUnidades } from '../lib/constants/tipos';
import { diasParaVencer, valorAFechaInput } from '../lib/validation/vencimiento';

const ESTADO_LABEL = { bueno: 'Bueno', malo: 'Malo', reparacion: 'En reparación' };

function Dato({ label, value, full = false }) {
  const vacio = value === undefined || value === null || value === '';
  return (
    <Box sx={{ gridColumn: full ? '1 / -1' : undefined, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 500, color: vacio ? 'text.disabled' : 'text.primary', wordBreak: 'break-word' }}>{vacio ? '—' : String(value)}</Typography>
    </Box>
  );
}

function Comentarios({ open, onClose, idItem, isAdmin }) {
  const [list, setList] = useState(null);
  const load = async () => { try { setList(await readItemCommentsById(idItem)); } catch (e) { console.error(e); setList([]); } };
  useEffect(() => { if (open) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, idItem]);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, borderBottom: '1px solid #e0e0e0' }}>
        <IconButton onClick={onClose} aria-label="atrás"><ArrowBackIcon /></IconButton>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>Comentarios</Typography>
        {isAdmin && <AddItemCommentCard idItem={idItem} handleRefresh={load} />}
      </Box>
      <DialogContent>
        {list === null && <Typography variant="body2">Cargando comentarios…</Typography>}
        {list && list.length === 0 && <Typography variant="body2" color="text.secondary">No hay comentarios.</Typography>}
        {list && list.map((c) => {
          const date = c.time?.toDate ? c.time.toDate() : null;
          return (
            <Box key={c.id} sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', borderBottom: '1px solid #eee', py: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>{c.title}</Typography>
                <Typography variant="caption" color="text.secondary">{date ? date.toLocaleString('es-HN') : 'Fecha no disponible'}</Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{c.description}</Typography>
              </Box>
              {isAdmin && <Box sx={{ display: 'flex', flexShrink: 0 }}><EditItemCommentCard itemComment={c} handleRefresh={load} /><DeleteItemCommentCard itemComment={c} handleRefresh={load} /></Box>}
            </Box>
          );
        })}
      </DialogContent>
    </Dialog>
  );
}

export default function ItemDetail({
  open, onClose, mode = 'ver', data, role, user, idLab, labName, reports = [], onChanged, onReportsChanged, highlightUnitId,
}) {
  const wide = useMediaQuery('(min-width:900px)');
  const isAdmin = role === 'admin';
  const editable = isAdmin && mode === 'editar';
  const conUnidades = tieneUnidades(data.tipo);
  const [reportOpen, setReportOpen] = useState(false);
  const [printLabels, setPrintLabels] = useState(null);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0); // fuerza a recargar la tabla de unidades tras agregar/editar
  const refrescar = () => { setRefreshKey((k) => k + 1); onChanged?.(); };

  const dias = diasParaVencer(data.fechaVencimiento);
  const observaciones = Array.isArray(data.observaciones) ? data.observaciones.join('\n') : (data.observaciones ?? '');
  const marca = data.marcaMixta ? 'Varía por unidad' : data.marca;
  const modelo = data.modeloMixto ? 'Varía por unidad' : data.modelo;

  const imprimirInsumo = () => {
    if (!data.codigo) return;
    setPrintLabels([{ id: data.id, codigo: data.codigo, nombre: data.equipo, lab: labName ?? '', tipo: data.tipo, estadoCodigo: data.estadoCodigo ?? 'sinCodigo' }]);
  };
  const onPrinted = async () => {
    const r = await markPrinted([{ recordId: data.id }]);
    if (r.status !== 'error') onChanged?.();
  };

  return (
    <Dialog open={open} onClose={onClose} fullScreen={!wide} fullWidth maxWidth="lg" scroll="paper">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1.25, position: 'sticky', top: 0, bgcolor: '#EEF3FB', zIndex: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onClose} size="small" variant="outlined">Atrás</Button>
        <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.2rem' }, flexGrow: 1, minWidth: 0, lineHeight: 1.2, wordBreak: 'break-word' }}>{data.equipo}</Typography>
        <Chip size="small" color={editable ? 'warning' : 'default'} label={editable ? 'Modo editar' : 'Solo ver'} />
        {isAdmin && (
          <IconButton aria-label="comentarios" onClick={() => setCommentsOpen(true)} size="small"><CommentIcon /></IconButton>
        )}
      </Box>

      <DialogContent sx={{ px: { xs: 1.5, sm: 3 }, py: 2 }}>
        {isAdmin && data.requiereValidacion && (
          <Alert severity="warning" sx={{ mb: 2 }}>Datos incongruentes: {data.motivoValidacion ?? 'revisar tipo y cantidad'}. Corrígelos en el modo editar.</Alert>
        )}

        {/* Imagen + datos generales: en modo editar son campos para modificar; en modo ver, solo lectura */}
        {editable ? (
          <RecordEditForm key={data.id} data={data} onSaved={refrescar} />
        ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'minmax(260px, 380px) 1fr' }, alignItems: 'start' }}>
          <Box sx={{ borderRadius: '16px', overflow: 'hidden', bgcolor: '#EEF3FB', aspectRatio: { xs: '4 / 3', md: '4 / 3' }, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ZoomableImage src={data.imgurl} alt={data.equipo} fallback={<Typography variant="body2" color="text.secondary">Sin imagen</Typography>} />
          </Box>
          <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', bgcolor: '#F1F5FC', borderRadius: '16px', p: 2.25 }}>
            {data.codigo && <Dato label="Código" value={data.codigo} />}
            <Dato label="Tipo" value={data.tipo} />
            <Dato label="Cantidad" value={data.cantidad} />
            <Dato label="Marca" value={marca} />
            <Dato label="Modelo" value={modelo} />
            <Dato label="Ubicación" value={data.ubicacion} />
            <Dato label="Columna de localización" value={data.columnadelocalizacion} />
            {!conUnidades && data.tipo === 'Suministro' && (
              <>
                <Dato label="Número de serie" value={data.numeroSerie} />
                <Dato label="Cód. Fundaempresa" value={data.codigoFundaempresa} />
                <Dato label="Estado" value={ESTADO_LABEL[data.estado ?? 'bueno'] ?? data.estado} />
              </>
            )}
            {isAdmin && data.tieneVencimiento && (
              <Dato label="Fecha de vencimiento" value={`${valorAFechaInput(data.fechaVencimiento) || 'Sin fecha'}${dias !== null ? (dias < 0 ? ' (vencido)' : dias <= 30 ? ` (vence en ${dias} días)` : '') : ''}`} />
            )}
            {isAdmin && data.ultimaModificacion?.toDate && (
              <Dato label="Última modificación" value={`${data.ultimaModificacion.toDate().toLocaleString('es-HN')}${data.ultimaModificacionPor?.email ? ` · ${data.ultimaModificacionPor.email}` : ''}`} />
            )}
            <Dato full label={`Observaciones${conUnidades ? ' generales' : ''}`} value={observaciones} />
          </Box>
        </Box>
        )}

        {/* Modo editar: cantidad con contador (agregar unidades con sus datos o sumar/restar en insumos) */}
        {editable && <AddUnitsPanel registro={data} user={user} onChanged={refrescar} />}

        {/* Insumo: etiqueta (los insumos no tienen tabla de unidades) */}
        {!conUnidades && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
            {editable && data.codigo && <Button variant="outlined" onClick={imprimirInsumo}>Imprimir etiqueta ({data.codigo})</Button>}
          </Box>
        )}

        {/* Datos de cada unidad, una por una (en modo editar se pueden modificar) */}
        {conUnidades && (
          <UnitsTable
            registro={data} idLab={idLab} labName={labName} user={user} reports={reports} editable={editable}
            refreshKey={refreshKey} onChanged={refrescar} highlightUnitId={highlightUnitId}
          />
        )}

        <ReportsList
          registro={data} reports={reports} isAdmin={isAdmin} canManage={editable} user={user}
          onChanged={() => { onReportsChanged?.(); onChanged?.(); }} onReport={() => setReportOpen(true)}
        />
        <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} registro={data} unidad={null} idLab={idLab} user={user} onCreated={onReportsChanged} />
        <PrintLabelsDialog open={!!printLabels} onClose={() => setPrintLabels(null)} labName={labName} labels={printLabels ?? []} onConfirmed={onPrinted} />
        <Comentarios open={commentsOpen} onClose={() => setCommentsOpen(false)} idItem={data.id} isAdmin={isAdmin} />
      </DialogContent>
    </Dialog>
  );
}

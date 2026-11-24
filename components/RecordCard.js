// Tarjeta de un registro dentro del laboratorio. Compacta y sin desbordes (PC y celular):
// imagen pequeña, nombre, ubicación, columna de localización, tipo, observaciones, cantidad y reportadas.
// La marca solo aparece si es la misma en todas las unidades. Abajo, dos botones iguales: «Opciones» (solo admin) y «Reportes».
// Tocar la tarjeta abre el detalle en modo SOLO VER (ver y reportar); editar solo se hace desde «Opciones».
import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardActions from '@mui/material/CardActions';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import ItemDetail from './ItemDetail';
import ReportsList from './ReportsList';
import ReportModal from './ReportModal';
import OptionsItemCard from './optionsItemCard';
import { codeStripeColor } from '../lib/inventory/stats';

const clamp = (n) => ({ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: n, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' });

function Linea({ label, value }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <Typography variant="caption" component="div" sx={{ lineHeight: 1.3, color: 'text.secondary', ...clamp(1) }}>
      <strong style={{ color: '#455a64' }}>{label}:</strong> {value}
    </Typography>
  );
}

export default function RecordCard({
  data, items, setItems, handleRefresh, role, user, idLab, labName, reports = [], onReportsChanged, autoOpen, highlightUnitId,
}) {
  const isAdmin = role === 'admin';
  const [detalle, setDetalle] = useState(autoOpen ? 'ver' : null); // null | 'ver' | 'editar'
  const [reportesOpen, setReportesOpen] = useState(false);
  const [crearReporte, setCrearReporte] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    if (autoOpen) { setDetalle('ver'); cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }, [autoOpen]);

  const stripe = isAdmin ? codeStripeColor(data.estadoCodigo) : null;
  const reportCount = new Set(reports.filter((r) => r.unidadId).map((r) => r.unidadId)).size + (reports.some((r) => !r.unidadId) ? 1 : 0);
  const observaciones = Array.isArray(data.observaciones) ? data.observaciones.join(' · ') : data.observaciones;
  const cantidad = data.cantidad === '' || data.cantidad === undefined || data.cantidad === null ? 0 : data.cantidad;
  const marca = !data.marcaMixta && data.marca ? data.marca : null; // solo si es la misma en todas las unidades

  return (
    <Card
      ref={cardRef}
      sx={{
        display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0, height: '100%', overflow: 'hidden',
        bgcolor: '#fff', transition: 'box-shadow .2s, transform .2s',
        // El color del estado del código se indica con un borde de color suave, sin franja gruesa
        borderColor: stripe ? `${stripe}99` : '#E1E3E1', borderWidth: stripe ? 2 : 1,
        outline: autoOpen ? '3px solid #0B57D0' : undefined,
        '&:hover': { boxShadow: '0 6px 20px rgba(11,87,208,.14)', transform: 'translateY(-2px)' },
      }}
    >
      <CardActionArea onClick={() => setDetalle('ver')} sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start' }}>
        <Box sx={{ m: 1, mb: 0, height: { xs: 160, sm: 180 }, borderRadius: '12px', overflow: 'hidden', bgcolor: '#EEF3FB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {data.imgurl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.imgurl} alt={`Imagen de ${data.equipo}`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : <Typography variant="caption" color="text.secondary">Sin imagen</Typography>}
        </Box>
        <Box sx={{ p: 1.25, display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '.98rem', lineHeight: 1.2, ...clamp(2) }}>{data.equipo}</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            <Chip size="small" color="primary" label={data.tipo || 'Sin tipo'} />
            <Chip size="small" sx={{ bgcolor: '#EEF3FB', color: '#041E49' }} label={`Cant. ${cantidad}`} />
            {reportCount > 0 && <Chip size="small" color="error" label={`${reportCount} reportada${reportCount === 1 ? '' : 's'}`} />}
            {isAdmin && data.estadoCodigo === 'pendienteImprimir' && <Chip size="small" color="error" variant="outlined" label="Pendiente imprimir" />}
            {isAdmin && (!data.estadoCodigo || data.estadoCodigo === 'sinCodigo') && !data.requiereValidacion && <Chip size="small" color="warning" label="Sin código" />}
            {isAdmin && data.requiereValidacion && <Chip size="small" color="warning" label="⚠ Validar" />}
            {data.estado === 'malo' && <Chip size="small" color="error" variant="outlined" label="Malo" />}
            {data.estado === 'reparacion' && <Chip size="small" color="warning" variant="outlined" label="En reparación" />}
          </Box>
          <Linea label="Ubicación" value={data.ubicacion} />
          <Linea label="Columna" value={data.columnadelocalizacion} />
          <Linea label="Marca" value={marca} />
          <Linea label="Obs." value={observaciones} />
        </Box>
      </CardActionArea>

      <CardActions sx={{ p: 1, pt: 0.5, gap: 1, '& > :not(style) ~ :not(style)': { ml: 0 } }}>
        {isAdmin && (
          <OptionsItemCard
            item={data} items={items} setItems={setItems} handleRefresh={handleRefresh} user={user}
            onOpenDetail={() => setDetalle('editar')}
          />
        )}
        <Button
          fullWidth size="small" variant="outlined" color={reportCount > 0 ? 'error' : 'primary'}
          startIcon={<ReportProblemIcon fontSize="small" />} onClick={() => setReportesOpen(true)}
          sx={{ whiteSpace: 'nowrap', fontSize: '.75rem', px: 0.75, minWidth: 0 }}
        >
          Reportes{reportCount > 0 ? ` (${reportCount})` : ''}
        </Button>
      </CardActions>

      {/* Reportes del registro: ver si hubo (código, fecha, estado) y crear uno */}
      <Dialog open={reportesOpen} onClose={() => setReportesOpen(false)} fullWidth maxWidth="sm">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderBottom: '1px solid #e0e0e0' }}>
          <Button startIcon={<ArrowBackIcon />} size="small" variant="outlined" onClick={() => setReportesOpen(false)}>Atrás</Button>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2, minWidth: 0, ...clamp(2) }}>Reportes · {data.equipo}</Typography>
        </Box>
        <DialogContent sx={{ pt: 0 }}>
          <ReportsList
            registro={data} reports={reports} isAdmin={isAdmin} canManage={false} user={user}
            onChanged={() => { onReportsChanged?.(); handleRefresh?.(); }} onReport={() => setCrearReporte(true)}
          />
          {isAdmin && reports.length > 0 && (
            <Button size="small" sx={{ mt: 1 }} onClick={() => { setReportesOpen(false); setDetalle('editar'); }}>Revisar y resolver (modo editar)</Button>
          )}
        </DialogContent>
      </Dialog>
      <ReportModal open={crearReporte} onClose={() => setCrearReporte(false)} registro={data} unidad={null} idLab={idLab} user={user} onCreated={onReportsChanged} />

      {detalle && (
        <ItemDetail
          open mode={detalle} onClose={() => setDetalle(null)} data={data} role={role} user={user} idLab={idLab} labName={labName}
          reports={reports} onChanged={handleRefresh} onReportsChanged={onReportsChanged} highlightUnitId={highlightUnitId}
        />
      )}
    </Card>
  );
}

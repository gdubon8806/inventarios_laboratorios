import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardActions from '@mui/material/CardActions';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';

import Link from 'next/link';

import ZoomableImage from './ZoomableImage';

import OptionsLabCard from './optionsLabCard';
import GenerateCodesButton from './GenerateCodesButton';
import LabPrintButton from './LabPrintButton';
import { M3 } from '../styles/theme';

const clamp = (n) => ({ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: n, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' });

// Tarjeta compacta de laboratorio (home). Toda la tarjeta abre el laboratorio (no hay botón «Abrir»).
// Props:
//   lab, role, setLaboratories (como antes)
//   status: conteos del lab { total, sinCodigo, pendienteImprimir, ... } (undefined mientras carga)
//   incongruentes: registros con datos incongruentes del lab (solo se muestra a admin)
//   selected: boolean — es el laboratorio activo del panel de consulta
//   onSelect(lab): se llama al tocar la tarjeta (además de abrirla)
//   onStatusChanged(labId): recargar conteos del lab (tras generar códigos o imprimir)
// Debajo (solo admin) «Opciones», «Generar códigos» e «Imprimir etiquetas», con el mismo diseño y ancho completo.
export default function LaboratoryCard({
  lab, setLaboratories, role, status, incongruentes = 0, selected = false, onSelect, onStatusChanged,
}) {
  const isAdmin = role === 'admin';
  const sinCodigo = status?.sinCodigo ?? 0;
  const pendiente = status?.pendienteImprimir ?? 0;
  const reload = () => onStatusChanged?.(lab.id);
  const href = `/inventory?id=${lab.id}`;

  return (
    <Card
      sx={{
        display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0, height: '100%', overflow: 'hidden',
        bgcolor: '#fff', borderColor: selected ? M3.primary : '#E1E3E1', borderWidth: selected ? 2 : 1,
        transition: 'box-shadow .2s, transform .2s',
        '&:hover': { boxShadow: '0 6px 20px rgba(11,87,208,.14)', transform: 'translateY(-2px)' },
      }}
    >
      <CardActionArea
        component={Link} href={href} onClick={() => onSelect?.(lab)} aria-label={`Abrir ${lab.name}`}
        sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start' }}
      >
        <Box sx={{ m: 1, mb: 0, height: { xs: 168, sm: 180 }, borderRadius: '12px', overflow: 'hidden', bgcolor: M3.surfaceContainer, flexShrink: 0 }}>
          {/* Tocar la imagen abre el laboratorio; solo el botón de la esquina la muestra completa */}
          <ZoomableImage src={lab.imgurl} alt="Imagen de laboratorio" />
        </Box>
        <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
          <Typography component="h3" sx={{ fontWeight: 600, fontSize: '1.02rem', lineHeight: 1.2, ...clamp(2) }} title={lab.name}>{lab.name}</Typography>
          {lab.description ? <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3, ...clamp(2) }}>{lab.description}</Typography> : null}
          {lab.ubicacion ? <Typography variant="caption" color="text.secondary" sx={{ ...clamp(1) }}>📍 {lab.ubicacion}</Typography> : null}
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
            {status && (
              <Chip size="small" sx={{ bgcolor: M3.surfaceContainer, color: M3.onPrimaryContainer }} label={`${status.total} ${status.total === 1 ? 'registro' : 'registros'}`} />
            )}
            {isAdmin && incongruentes > 0 && <Chip size="small" color="warning" label={`⚠ Validar (${incongruentes})`} />}
            {isAdmin && sinCodigo > 0 && <Chip size="small" color="warning" label="Código sin generar" />}
            {isAdmin && sinCodigo === 0 && pendiente > 0 && <Chip size="small" color="error" label="Pendiente imprimir" />}
          </Box>
        </Box>
      </CardActionArea>
      {isAdmin && (
        <CardActions sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 0.75, p: 1.25, pt: 0, '& > :not(style) ~ :not(style)': { ml: 0 } }}>
          <OptionsLabCard lab={lab} setLaboratories={setLaboratories} role={role} />
          <GenerateCodesButton lab={lab} status={status} onDone={reload} />
          <LabPrintButton lab={lab} status={status} onDone={reload} />
        </CardActions>
      )}
    </Card>
  );
}

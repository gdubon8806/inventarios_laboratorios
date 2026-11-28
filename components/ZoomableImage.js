// Imagen con botón «Ver completa» en la esquina (PC y celular). Solo el botón abre el visor de pantalla completa:
// tocar la imagen en sí no hace nada especial, así que dentro de una tarjeta clicable sigue abriendo la tarjeta.
import { useState } from 'react';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import { estiloEnfoque } from '../lib/imagen/enfoque';

export function ImageViewer({ open, src, alt, onClose }) {
  return (
    <Dialog
      open={open} onClose={onClose} fullScreen
      // Los eventos de un portal suben por el árbol de React: se cortan aquí para no activar la tarjeta que contiene la imagen.
      onClick={(e) => e.stopPropagation()}
      PaperProps={{ sx: { bgcolor: 'rgba(0,0,0,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' } }}
    >
      <IconButton aria-label="Cerrar imagen" onClick={onClose} sx={{ position: 'absolute', top: 8, right: 8, color: '#fff', bgcolor: 'rgba(255,255,255,.15)', '&:hover': { bgcolor: 'rgba(255,255,255,.3)' } }}>
        <CloseIcon />
      </IconButton>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onClick={onClose} />
    </Dialog>
  );
}

// `enfoque` (opcional): zona de la foto que se ve aquí; el visor «Ver completa» siempre muestra la foto entera.
export default function ZoomableImage({ src, alt = '', sx, imgStyle, fallback = null, enfoque = null }) {
  const [open, setOpen] = useState(false);
  if (!src) return fallback;

  // Dentro de CardActionArea / enlace: se evita que el clic del botón active la tarjeta.
  const openViewer = (e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); };

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...sx }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...estiloEnfoque(enfoque), ...imgStyle }} />
      <IconButton
        component="span" role="button" aria-label="Ver imagen completa" title="Ver completa" size="small" onClick={openViewer}
        sx={{ position: 'absolute', right: 6, bottom: 6, color: '#fff', bgcolor: 'rgba(0,0,0,.5)', '&:hover': { bgcolor: 'rgba(0,0,0,.7)' } }}
      >
        <ZoomOutMapIcon fontSize="small" />
      </IconButton>
      <ImageViewer open={open} src={src} alt={alt} onClose={() => setOpen(false)} />
    </Box>
  );
}

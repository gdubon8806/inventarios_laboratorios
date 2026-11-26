// Enfoque de imagen (no recorta): se mueve y se acerca la foto dentro de un marco con la proporción de las tarjetas.
// La foto se sube COMPLETA; solo se guarda qué zona se ve en tarjetas y detalle. «Ver completa» muestra la foto entera.
import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import { enfoqueDesdeArea, normalizarEnfoque } from '../../lib/imagen/enfoque';

export const ASPECTO = 4 / 3; // proporción del marco (se ve bien en tarjetas, detalle y buscador)
const MIN_ANCHO_RECOMENDADO = 800;

// Props: src (data URL o URL de la foto), enfoque inicial (opcional), onCancel(), onConfirm(enfoque)
export default function ImageCropDialog({ open, src, enfoque, onCancel, onConfirm }) {
  const inicial = normalizarEnfoque(enfoque);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(inicial?.zoom ?? 1);
  const [area, setArea] = useState(null);
  const [baja, setBaja] = useState(false); // la foto original es pequeña

  const onComplete = useCallback((porcentajes) => setArea(porcentajes), []);

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm" onClick={(e) => e.stopPropagation()}>
      <DialogTitle sx={{ pb: 1 }}>Ajusta el enfoque</DialogTitle>
      <DialogContent sx={{ pb: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Arrastra la foto y usa el zoom para elegir qué parte se ve en las tarjetas. La foto no se recorta:
          con «Ver completa» se sigue viendo entera.
        </Typography>
        <Box sx={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', bgcolor: '#111', borderRadius: '12px', overflow: 'hidden' }}>
          <Cropper
            image={src} crop={crop} zoom={zoom} aspect={ASPECTO} minZoom={1} maxZoom={4}
            initialCroppedAreaPercentages={inicial?.area ?? undefined}
            onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onComplete}
            onMediaLoaded={(m) => setBaja(m.naturalWidth < MIN_ANCHO_RECOMENDADO)}
            showGrid
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.5, px: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Zoom</Typography>
          <Slider value={zoom} min={1} max={4} step={0.05} onChange={(_, v) => setZoom(v)} aria-label="Zoom de la imagen" />
        </Box>
        {baja && (
          <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
            La foto es pequeña (menos de {MIN_ANCHO_RECOMENDADO} px de ancho) y puede verse borrosa. Se recomienda una foto horizontal de al menos {MIN_ANCHO_RECOMENDADO}×600.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel}>Cancelar</Button>
        <Button variant="contained" onClick={() => onConfirm(enfoqueDesdeArea(area, zoom))} disabled={!area}>Usar este enfoque</Button>
      </DialogActions>
    </Dialog>
  );
}

// Botón «Ajustar enfoque» para las imágenes que YA están subidas: abre el enfoque sobre la foto actual (sin descargarla
// ni volver a subirla) y devuelve el nuevo enfoque. No guarda nada por sí solo: el formulario lo guarda al pulsar «Guardar».
// Props: src (URL de la imagen actual), enfoque (actual, opcional), onAdjusted(enfoque)
import { useState } from 'react';
import Button from '@mui/material/Button';
import toast from 'react-hot-toast';
import ImageCropDialog from './ImageCropDialog';

export default function AdjustImageButton({ src, enfoque, onAdjusted, sx }) {
  const [abierto, setAbierto] = useState(false);

  const confirmar = (nuevo) => {
    onAdjusted?.(nuevo);
    setAbierto(false);
    toast('Enfoque ajustado. Pulsa «Guardar» para aplicarlo.');
  };

  return (
    <>
      <Button size="small" onClick={() => setAbierto(true)} disabled={!src} sx={sx}>Ajustar enfoque</Button>
      {abierto && <ImageCropDialog open src={src} enfoque={enfoque} onCancel={() => setAbierto(false)} onConfirm={confirmar} />}
    </>
  );
}

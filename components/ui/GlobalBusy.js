// Indicador de carga global: una capa centrada con rueda y mensaje, para procesos largos
// (por ejemplo exportar a Excel). Se usa desde cualquier archivo, sin pasar props:
//   import { busy } from './ui/GlobalBusy';
//   busy.show('Preparando el Excel…');  try { ... } finally { busy.hide(); }
// <GlobalBusy /> se monta una sola vez en pages/_app.js.
import { useEffect, useState } from 'react';
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

let message = null;
let depth = 0; // permite anidar procesos: la capa se cierra cuando termina el último
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(message));

export const busy = {
  show(text = 'Cargando…') { depth += 1; message = text; emit(); },
  hide() { depth = Math.max(0, depth - 1); if (depth === 0) message = null; emit(); },
};

export default function GlobalBusy() {
  const [text, setText] = useState(message);
  useEffect(() => {
    listeners.add(setText);
    return () => listeners.delete(setText);
  }, []);
  return (
    <Backdrop open={!!text} sx={{ zIndex: (t) => t.zIndex.modal + 10, color: '#fff', flexDirection: 'column', gap: 2, backdropFilter: 'blur(2px)' }}>
      <CircularProgress color="inherit" size={56} />
      <Typography variant="body1" sx={{ px: 2, textAlign: 'center' }}>{text}</Typography>
    </Backdrop>
  );
}

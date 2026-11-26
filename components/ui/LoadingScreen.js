// Pantalla / bloque de carga CENTRADO (horizontal y verticalmente).
//   <LoadingScreen />                      -> ocupa toda la ventana (carga inicial de la sesión)
//   <LoadingScreen inline text="..." />    -> centrado dentro de su contenedor (listas que cargan)
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

export default function LoadingScreen({ text = 'Cargando…', inline = false }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
        width: '100%', minHeight: inline ? 220 : '100vh', gridColumn: '1 / -1',
      }}
    >
      <CircularProgress size={inline ? 40 : 52} />
      <Typography variant="body2" color="text.secondary">{text}</Typography>
    </div>
  );
}

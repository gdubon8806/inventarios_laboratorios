// Encabezado fijo (siempre a la vista) en tres filas, estilo barra superior de Material 3:
//   1) «Inventario de laboratorios» a lo largo   2) nombre del laboratorio (píldora tonal, opcional)   3) botones de acción.
// Los botones de la fila 3 se pasan como `children` (Exportar, Agregar, etc.); «Atrás» y «Cerrar sesión» los pone
// el propio encabezado. En el celular los botones pasan a otra línea si no caben; en PC quedan en un panel
// superior ordenado, con «Cerrar sesión» a la derecha. Los botones secundarios son tonales (relleno suave, sin borde).
import Link from 'next/link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LogoutIcon from '@mui/icons-material/Logout';
import { M3 } from '../../styles/theme';

// `showLabels`: en celular también se muestra el texto de los botones (para el invitado, que tiene pocos botones).
export default function AppHeader({ title = 'Inventario de laboratorios', subtitle, backHref, onLogout, showLabels = false, children }) {
  return (
    <Box
      component="header"
      sx={{
        position: 'sticky', top: 0, zIndex: 1100, bgcolor: 'rgba(238,243,251,.92)', backdropFilter: 'blur(14px)',
        borderRadius: { xs: '0 0 16px 16px', sm: '0 0 18px 18px' }, boxShadow: '0 2px 12px rgba(11,87,208,.10)',
        px: { xs: 1.5, sm: 3 }, pt: { xs: 1, sm: 1.5 }, pb: { xs: 1.25, sm: 1.5 },
      }}
    >
      <Typography component="h1" sx={{ fontSize: { xs: '1.1rem', sm: '1.45rem' }, fontWeight: 600, lineHeight: 1.2, textAlign: 'center', color: M3.onSurface, letterSpacing: '-0.2px' }}>
        {title}
      </Typography>
      {subtitle ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 0.5 }}>
          <Typography
            component="div"
            title={typeof subtitle === 'string' ? subtitle : undefined}
            sx={{
              px: 1.5, py: 0.4, borderRadius: '10px', bgcolor: M3.primaryContainer, color: M3.onPrimaryContainer,
              fontSize: { xs: '.85rem', sm: '.95rem' }, fontWeight: 600, lineHeight: 1.25, textAlign: 'center', maxWidth: '100%',
              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}
          >
            {subtitle}
          </Typography>
        </Box>
      ) : null}
      <Box
        sx={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mt: { xs: 1, sm: 1.25 },
          justifyContent: { xs: 'space-between', sm: 'flex-start' },
          // En celular solo se ven los íconos (el texto se oculta con tamaño 0) para que quede completo en una sola fila
          '& .MuiButton-root': { fontSize: { xs: showLabels ? '.78rem' : 0, sm: '.78rem' }, lineHeight: 1.2, py: 0.6, px: { xs: showLabels ? 1.5 : 1, sm: 1.75 }, minHeight: { xs: 40, sm: 34 }, minWidth: { xs: showLabels ? 0 : 40, sm: 0 }, whiteSpace: 'nowrap' },
          '& .MuiButton-startIcon': { mr: { xs: showLabels ? 0.5 : 0, sm: 0.5 }, ml: { xs: showLabels ? -0.5 : 0, sm: -0.5 }, '& svg': { fontSize: { xs: showLabels ? '1.15rem' : '1.4rem', sm: '1.15rem' } } },
          // Botones secundarios tonales: relleno suave sin borde
          '& .MuiButton-outlined': { border: 'none', bgcolor: '#fff', color: M3.primary, boxShadow: '0 1px 2px rgba(0,0,0,.08)', '&:hover': { bgcolor: M3.primaryContainer } },
        }}
      >
        {backHref ? (
          <Button component={Link} href={backHref} size="small" variant="outlined" startIcon={<ArrowBackIcon />}>Atrás</Button>
        ) : null}
        {children}
        {onLogout ? (
          <Button
            size="small" variant="outlined" startIcon={<LogoutIcon />} onClick={onLogout}
            aria-label="Cerrar sesión"
            // Rojo suave (tonal), no fuerte
            sx={{ ml: 'auto', bgcolor: `${M3.errorContainer} !important`, color: '#8C1D18 !important', '&:hover': { bgcolor: '#F4C7C3 !important' } }}
          >
            Cerrar sesión
          </Button>
        ) : null}
      </Box>
    </Box>
  );
}

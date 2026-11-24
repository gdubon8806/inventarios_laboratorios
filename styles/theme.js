// Tema visual (estilo Material 3 expresivo de Google): colores tonales, formas muy redondeadas, botones tipo píldora,
// superficies suaves y sin sombras duras. Se aplica con <ThemeProvider> en pages/_app.js.
// Los "contenedores" (container) son los tonos suaves de cada color que se usan de fondo para chips, avisos y recuadros.
import { createTheme } from '@mui/material/styles';

export const M3 = {
  primary: '#0B57D0',
  onPrimary: '#FFFFFF',
  primaryContainer: '#D3E3FD',
  onPrimaryContainer: '#041E49',
  secondaryContainer: '#C2E7FF',
  tertiaryContainer: '#E6DEFF',
  error: '#B3261E',
  errorContainer: '#F9DEDC',
  onErrorContainer: '#410E0B',
  warning: '#8C4A00',
  warningContainer: '#FFDDB3',
  onWarningContainer: '#4A2800',
  success: '#146C2E',
  successContainer: '#C4EED0',
  onSuccessContainer: '#072711',
  background: '#F8FAFD',
  surface: '#FFFFFF',
  surfaceContainer: '#EEF3FB', // recuadros tonales
  surfaceContainerHigh: '#E3EAF6',
  outline: '#C4C7C5',
  onSurface: '#1F1F1F',
  onSurfaceVariant: '#444746',
};

const FONT = '"Google Sans Flex", "Google Sans", "Roboto Flex", "Roboto", "Helvetica", "Arial", sans-serif';

const theme = createTheme({
  palette: {
    primary: { main: M3.primary, light: M3.primaryContainer, dark: '#0842A0', contrastText: M3.onPrimary },
    secondary: { main: '#00639B', light: M3.secondaryContainer, contrastText: '#FFFFFF' },
    error: { main: M3.error, light: M3.errorContainer, dark: '#8C1D18' },
    warning: { main: '#B3560A', light: M3.warningContainer, dark: M3.warning },
    success: { main: M3.success, light: M3.successContainer, dark: '#0D5124' },
    background: { default: M3.background, paper: M3.surface },
    text: { primary: M3.onSurface, secondary: M3.onSurfaceVariant },
    divider: '#E1E3E1',
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: FONT,
    h5: { fontWeight: 500, letterSpacing: '-0.2px' },
    h6: { fontWeight: 500, letterSpacing: '-0.1px' },
    subtitle1: { fontWeight: 500 },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.1px' },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 12, textTransform: 'none', fontWeight: 600, transition: 'background-color .2s, box-shadow .2s, transform .1s', '&:active': { transform: 'scale(.98)' } },
        outlined: { borderColor: '#B9C2D0' },
        // Hover y selección en tonos CLAROS (nada oscuro al pasar el mouse)
        containedPrimary: { '&:hover': { backgroundColor: '#2A6FDB' } },
        containedError: { '&:hover': { backgroundColor: '#CC4A41' } },
        containedWarning: { '&:hover': { backgroundColor: '#CC7226' } },
        outlinedPrimary: { '&:hover': { backgroundColor: '#EAF1FD', borderColor: '#9DB9EA' } },
        outlinedError: { '&:hover': { backgroundColor: '#FDECEA' } },
        outlinedWarning: { '&:hover': { backgroundColor: '#FFF1DD' } },
        sizeSmall: { padding: '5px 16px' },
      },
    },
    MuiFab: { styleOverrides: { root: { boxShadow: '0 4px 14px rgba(11,87,208,.28)', textTransform: 'none', fontWeight: 600 } } },
    MuiCard: { styleOverrides: { root: { borderRadius: 16, boxShadow: 'none', border: '1px solid #E1E3E1', backgroundImage: 'none' } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 20, backgroundImage: 'none' }, paperFullScreen: { borderRadius: 0 } } },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 600, fontSize: '.72rem' },
        outlined: { borderColor: '#C4C7C5' },
        filledError: { backgroundColor: M3.errorContainer, color: M3.onErrorContainer },
        filledWarning: { backgroundColor: M3.warningContainer, color: M3.onWarningContainer },
        filledSuccess: { backgroundColor: M3.successContainer, color: M3.onSuccessContainer },
        filledPrimary: { backgroundColor: M3.primaryContainer, color: M3.onPrimaryContainer },
      },
    },
    MuiAlert: { styleOverrides: { root: { borderRadius: 12 } } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 12, backgroundColor: '#fff' } } },
    MuiMenu: { styleOverrides: { paper: { borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.14)' } } },
    MuiDrawer: { styleOverrides: { paper: { backgroundImage: 'none' } } },
    MuiTooltip: { styleOverrides: { tooltip: { borderRadius: 8 } } },
  },
});

export default theme;

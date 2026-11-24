import '../styles/global.css';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../styles/theme';
import GlobalBusy from '../components/ui/GlobalBusy';

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider theme={theme}>
      <Component {...pageProps} />
      <GlobalBusy />
    </ThemeProvider>
  )
}

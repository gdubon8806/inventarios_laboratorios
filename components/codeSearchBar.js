import { useState } from 'react';
import { useRouter } from 'next/router';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputBase from '@mui/material/InputBase';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import toast from 'react-hot-toast';

import findByCode from './firebase/find-by-code';
import generateLabelPdf from './labels/labelPdf';
import HomeStyles from '../styles/Home.module.css';
import InventoryStyles from '../styles/Inventory.module.css';

// Fila de búsqueda por código. Todos los usuarios pueden buscar;
// solo el administrador ve el botón que genera el PDF de la etiqueta.
export default function CodeSearchBar({ role }) {
  const router = useRouter();
  const [codigo, setCodigo] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSearch = async () => {
    const code = codigo.trim().toUpperCase();
    if (!code) {
      toast.error('Escribe o escanea un código');
      return;
    }
    setBusy(true);
    const item = await findByCode(code);
    setBusy(false);
    if (!item) {
      toast.error('Código no encontrado: ' + code);
      return;
    }
    router.push({ pathname: '/inventory', query: { id: item.idLab, item: item.id } });
  };

  const handlePdf = async () => {
    const code = codigo.trim().toUpperCase();
    if (!code) {
      toast.error('Escribe un código para generar el PDF');
      return;
    }
    setBusy(true);
    try {
      const item = await findByCode(code);
      await generateLabelPdf({ codigo: code, titulo: item ? item.equipo : '' });
      toast.success('PDF generado: etiqueta-' + code + '.pdf');
    } catch (error) {
      console.error('Error al generar el PDF: ', error);
      toast.error('No se pudo generar el PDF');
    }
    setBusy(false);
  };

  return (
    <div className={HomeStyles.controls} style={{ paddingTop: 0 }}>
      <Box sx={{ flexGrow: 1 }}>
        <Search>
          <SearchIconWrapper>
            <QrCodeScannerIcon />
          </SearchIconWrapper>
          <StyledInputBase
            value={codigo}
            onChange={(event) => setCodigo(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSearch();
            }}
            placeholder="Código del equipo (escribe o escanea)"
            inputProps={{ 'aria-label': 'codigo', autoComplete: 'off' }}
          />
        </Search>
      </Box>
      <div className={InventoryStyles.flex}>
        <Button variant="contained" disabled={busy} onClick={handleSearch}>
          Buscar código
        </Button>
        {role === 'admin' && (
          <Button variant="contained" disabled={busy} onClick={handlePdf}>
            Generar código (PDF)
          </Button>
        )}
      </div>
    </div>
  );
}

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: '#F8F8F8',
  marginLeft: 0,
  width: '100%',
  [theme.breakpoints.up('sm')]: {
    marginLeft: theme.spacing(1),
  },
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  width: '100%',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    textTransform: 'uppercase',
    '&::placeholder': { textTransform: 'none' },
  },
}));

import { useState } from 'react';
import { useRouter } from 'next/router';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import Card from '@mui/material/Card';
import CardMedia from '@mui/material/CardMedia';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import toast from 'react-hot-toast';

import findByCode from './firebase/find-by-code';
import readLabById from './firebase/read-lab-with-id';
import generateLabelPdf from './labels/labelPdf';
import HomeStyles from '../styles/Home.module.css';
import InventoryStyles from '../styles/Inventory.module.css';

// Campos del equipo que se muestran en el panel (mismos que el detalle del inventario)
const FIELDS = [
  ['marca', 'Marca'],
  ['modelo', 'Modelo'],
  ['tipo', 'Tipo'],
  ['cantidad', 'Cantidad'],
  ['ubicacion', 'Ubicación'],
  ['columnadelocalizacion', 'Columna de localización'],
  ['observaciones', 'Observaciones'],
];

function textOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = Array.isArray(value) ? value.join(', ') : String(value).trim();
  return text === '' ? null : text;
}

// Botón que abre un panel lateral derecho para buscar un equipo por su código.
// Todos los usuarios pueden buscar; solo el administrador ve el botón del PDF.
export default function CodeSearchBar({ role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { item, labName }
  const [notFound, setNotFound] = useState(false);

  const handleSearch = async () => {
    const code = codigo.trim().toUpperCase();
    if (!code) {
      toast.error('Escribe o escanea un código');
      return;
    }
    setBusy(true);
    setNotFound(false);
    setResult(null);
    const item = await findByCode(code);
    if (!item) {
      setNotFound(true);
      setBusy(false);
      return;
    }
    let labName = null;
    try {
      const lab = item.idLab ? await readLabById(item.idLab) : null;
      labName = lab ? textOrNull(lab.name) : null;
    } catch (error) {
      console.error('No se pudo leer el laboratorio: ', error);
    }
    setResult({ item, labName });
    setBusy(false);
  };

  const handlePdf = async () => {
    const code = codigo.trim().toUpperCase();
    if (!code) {
      toast.error('Escribe un código para generar el PDF');
      return;
    }
    setBusy(true);
    try {
      const titulo = result && result.item.codigo === code ? result.item.equipo : '';
      await generateLabelPdf({ codigo: code, titulo });
      toast.success('PDF generado: etiqueta-' + code + '.pdf');
    } catch (error) {
      console.error('Error al generar el PDF: ', error);
      toast.error('No se pudo generar el PDF');
    }
    setBusy(false);
  };

  const goToLab = () => {
    router.push({ pathname: '/inventory', query: { id: result.item.idLab, item: result.item.id } });
  };

  return (
    <>
      <div className={HomeStyles.controls} style={{ paddingTop: 0, gridTemplateColumns: '1fr' }}>
        <div className={InventoryStyles.flex}>
          <Button variant="contained" startIcon={<QrCodeScannerIcon />} onClick={() => setOpen(true)}>
            Buscar código
          </Button>
        </div>
      </div>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        ModalProps={{ BackdropProps: { invisible: true } }}
        PaperProps={{
          sx: {
            width: { xs: '100vw', sm: 420 },
            top: '4.5rem',
            height: 'calc(100% - 4.5rem)',
            borderTopLeftRadius: 8,
            padding: 2,
            gap: 2,
          },
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Buscar por código</Typography>
          <IconButton aria-label="cerrar" onClick={() => setOpen(false)}>
            <CloseIcon />
          </IconButton>
        </div>

        <div style={{ background: '#F8F8F8', borderRadius: 4, padding: '4px 12px' }}>
          <InputBase
            autoFocus
            fullWidth
            value={codigo}
            onChange={(event) => setCodigo(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSearch();
            }}
            placeholder="Código del equipo (escribe o escanea)"
            inputProps={{ 'aria-label': 'codigo', autoComplete: 'off', style: { textTransform: 'uppercase' } }}
          />
        </div>

        <div className={InventoryStyles.flex} style={{ justifyContent: 'flex-start' }}>
          <Button variant="contained" disabled={busy} onClick={handleSearch}>
            Buscar
          </Button>
          {role === 'admin' && (
            <Button variant="outlined" disabled={busy} onClick={handlePdf}>
              Generar código (PDF)
            </Button>
          )}
        </div>

        {notFound && (
          <Typography color="error">Código no encontrado: {codigo.trim().toUpperCase()}</Typography>
        )}

        {result && <ItemCard result={result} onOpenLab={goToLab} />}
      </Drawer>
    </>
  );
}

function ItemCard({ result, onOpenLab }) {
  const { item, labName } = result;
  const image = textOrNull(item.imgurl);
  return (
    <Card sx={{ overflowY: 'auto', flexShrink: 0 }}>
      {image ? (
        <CardMedia component="img" height="200" image={image} alt={item.equipo || 'Equipo'} />
      ) : (
        <div style={{ height: 120, display: 'grid', placeItems: 'center', background: '#eceff1', color: '#78909c' }}>
          Sin imagen
        </div>
      )}
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {textOrNull(item.equipo) || 'Sin nombre'}
        </Typography>
        <Row label="Código" value={textOrNull(item.codigo)} />
        <Row label="Laboratorio" value={labName} />
        {FIELDS.map(([key, label]) => (
          <Row key={key} label={label} value={textOrNull(item[key])} />
        ))}
        <Button sx={{ mt: 1 }} onClick={onOpenLab}>
          Ir al laboratorio
        </Button>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '3px 0' }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 150 }}>
        {label}:
      </Typography>
      <Typography variant="body2" color={value ? 'text.primary' : 'text.disabled'}>
        {value || 'Sin datos'}
      </Typography>
    </div>
  );
}

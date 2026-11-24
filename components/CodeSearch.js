import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputBase from '@mui/material/InputBase';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import { findByCode } from './firebase/find-by-code';

// Buscador por código (escrito o escaneado). El escáner USB "teclea" el código y envía Enter.
//
// Props:
//   isAdmin: boolean            (los admin también ven códigos dados de baja)
//   onResult(result): void      resultado de findByCode + { query } →
//        status: 'found' | 'replaced' | 'baja' | 'eliminado' | 'not-found' | 'list' | 'not-code' | 'error'
//   externalQuery?: { value: string, nonce: number }   dispara una búsqueda desde fuera
//        (p. ej. el buscador de laboratorios cuando el texto parece un código). Cambia `nonce` para repetir.
//   autoFocus?: boolean (por defecto true)
// Tras cada búsqueda recupera el foco y selecciona el texto, así el siguiente escaneo reemplaza al anterior.
export default function CodeSearch({ isAdmin, onResult, externalQuery, autoFocus = true }) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const runningRef = useRef(false);

  const search = useCallback(async (raw) => {
    const query = String(raw ?? '').trim();
    if (!query || runningRef.current) return;
    runningRef.current = true;
    setLoading(true);
    try {
      const result = await findByCode(query, { isAdmin });
      onResult?.({ ...result, query });
    } catch (error) {
      console.error('Error al buscar por código:', error);
      onResult?.({ status: 'error', query, error: error?.message ?? String(error) });
    } finally {
      runningRef.current = false;
      setLoading(false);
      // Devolver el foco al input (y seleccionar) para el siguiente escaneo.
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [isAdmin, onResult]);

  useEffect(() => {
    if (externalQuery && externalQuery.value) {
      setValue(externalQuery.value);
      search(externalQuery.value);
    }
    // Solo cuando cambia el nonce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalQuery?.nonce]);

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <Box sx={{ position: 'relative', flexGrow: 1, borderRadius: 1, backgroundColor: '#F8F8F8' }}>
        <QrCodeScannerIcon sx={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(0,0,0,.54)', pointerEvents: 'none' }} />
        <InputBase
          fullWidth
          autoFocus={autoFocus}
          inputRef={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              search(value);
            }
          }}
          placeholder="Código (escribe o escanea)"
          inputProps={{ 'aria-label': 'buscar por código', autoComplete: 'off', style: { textTransform: 'uppercase', padding: '8px 8px 8px 44px' } }}
        />
      </Box>
      <Button variant="contained" onClick={() => search(value)} disabled={loading || !value.trim()}>
        {loading ? '…' : 'Buscar'}
      </Button>
    </Box>
  );
}

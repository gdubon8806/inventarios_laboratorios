import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputBase from '@mui/material/InputBase';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import useMediaQuery from '@mui/material/useMediaQuery';
import SearchIcon from '@mui/icons-material/Search';
import { findByCode } from './firebase/find-by-code';

// Iniciales de las etiquetas: se elige en el desplegable y el guion se coloca solo, así que basta con escribir los números.
const PREFIJOS = [
  { value: 'EQU', label: 'EQU', ayuda: 'Equipo' },
  { value: 'MOB', label: 'MOB', ayuda: 'Mobiliario' },
  { value: 'HER', label: 'HER', ayuda: 'Herramienta' },
  { value: 'INS', label: 'INS', ayuda: 'Insumo' },
];
const CODIGO_COMPLETO = /^\s*(MOB|HER|INS|EQU)\s*-?\s*(\d*)\s*$/i;

// Buscador por código (elegido en pantalla o escaneado). El escáner USB "teclea" el código completo y envía Enter:
// si el texto trae letras se interpreta como código completo y se acomoda solo en el desplegable y los números.
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
  const [prefijo, setPrefijo] = useState('EQU');
  const [texto, setTexto] = useState(''); // números (o, transitoriamente, un código completo que escribe el escáner)
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const runningRef = useRef(false);

  const movil = useMediaQuery('(max-width:899px)'); // el desplegable de iniciales solo se usa en celular
  const consulta = (p, t) => (!movil || /[A-Za-z]/.test(t) ? t.trim() : `${p}-${t.trim()}`);

  const search = useCallback(async (query) => {
    const q = String(query ?? '').trim();
    if (!q || runningRef.current) return;
    runningRef.current = true;
    setLoading(true);
    try {
      const result = await findByCode(q, { isAdmin });
      onResult?.({ ...result, query: q });
    } catch (error) {
      console.error('Error al buscar por código:', error);
      onResult?.({ status: 'error', query: q, error: error?.message ?? String(error) });
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

  const aplicarTexto = (raw) => {
    if (!movil) { setTexto(raw); return; } // PC: texto libre (el lector escribe el código completo)
    if (/[A-Za-z]/.test(raw)) {
      // Código completo (escáner, pegado o teclado): se reparte en inicial + números cuando ya está completo.
      const m = CODIGO_COMPLETO.exec(raw);
      if (m) { setPrefijo(m[1].toUpperCase()); setTexto(m[2]); return; }
      setTexto(raw); // escribiendo todavía (por ejemplo "EQ"): se deja tal cual
      return;
    }
    setTexto(raw.replace(/\D/g, '')); // solo números
  };

  useEffect(() => {
    if (externalQuery && externalQuery.value) {
      const m = CODIGO_COMPLETO.exec(externalQuery.value);
      if (m) { setPrefijo(m[1].toUpperCase()); setTexto(m[2]); } else setTexto(externalQuery.value);
      search(externalQuery.value);
    }
    // Solo cuando cambia el nonce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalQuery?.nonce]);

  const hayLetras = /[A-Za-z]/.test(texto);
  const vista = consulta(prefijo, texto);

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'stretch' }}>
        <Box
          sx={{
            display: 'flex', alignItems: 'center', flexGrow: 1, minWidth: 0, borderRadius: '12px', bgcolor: '#fff',
            border: '2px solid #0B57D0', overflow: 'hidden',
          }}
        >
          {/* Solo en celular: el código se escribe a mano, así que se elige la inicial y el guion se pone solo.
              En PC el lector escanea el código completo (ej. EQU-000123) y basta un único campo. */}
          {movil && (
            <>
              <Select
                value={prefijo}
                onChange={(e) => setPrefijo(e.target.value)}
                variant="standard"
                disableUnderline
                disabled={hayLetras}
                renderValue={(v) => v}
                inputProps={{ 'aria-label': 'inicial del código' }}
                sx={{ pl: 1.5, pr: 0.5, fontWeight: 700, color: '#0B57D0', bgcolor: '#D3E3FD', alignSelf: 'stretch', '& .MuiSelect-select': { py: 1.25, display: 'flex', alignItems: 'center' } }}
              >
                {PREFIJOS.map((p) => (
                  <MenuItem key={p.value} value={p.value}>
                    <strong>{p.label}</strong>&nbsp;<span style={{ color: '#666', fontSize: '.85em' }}>{p.ayuda}</span>
                  </MenuItem>
                ))}
              </Select>
              <Box component="span" sx={{ px: 0.5, fontWeight: 700, color: '#0B57D0', userSelect: 'none' }}>-</Box>
            </>
          )}
          <InputBase
            fullWidth
            autoFocus={autoFocus}
            inputRef={inputRef}
            value={texto}
            onChange={(e) => aplicarTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); search(vista); }
            }}
            placeholder={movil ? 'Solo los números' : 'Escanea la etiqueta o escribe el código'}
            inputProps={{
              'aria-label': movil ? 'números del código' : 'código de la etiqueta',
              inputMode: movil && !hayLetras ? 'numeric' : 'text', autoComplete: 'off',
              style: { textTransform: 'uppercase', padding: movil ? '10px 8px' : '10px 16px', fontSize: '1.05rem', letterSpacing: '1px' },
            }}
          />
        </Box>
        <Button variant="contained" onClick={() => search(vista)} disabled={loading || !texto.trim()} startIcon={<SearchIcon />} sx={{ borderRadius: '12px', px: 2, flexShrink: 0 }}>
          {loading ? '…' : 'Buscar'}
        </Button>
      </Box>
      {movil && texto.trim() && (
        <Box sx={{ mt: 0.75, fontSize: '.78rem', color: 'text.secondary' }}>
          Se buscará: <strong>{vista.toUpperCase()}</strong>
        </Box>
      )}
    </Box>
  );
}

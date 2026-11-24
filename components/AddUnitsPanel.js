// Agregar o quitar cantidad desde el modo editar. NO se escribe la cantidad a mano: se usa un contador.
//   - Mobiliario / Equipo / Herramienta: se elige cuántas unidades nuevas (de una en una o varias) y aparece un formulario
//     por cada una para sus datos (marca, modelo, serie, Fundaempresa, estado, observaciones). Solo se crean si se
//     confirma; cada una recibe su código y queda pendiente de imprimir. Para QUITAR unidades se da de baja cada una
//     en la tabla de unidades (con motivo).
//   - Insumos (sin unidades): el contador suma o resta cantidad.
// Props: { registro, user, onChanged }
import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import toast from 'react-hot-toast';

import { ThresholdConfirmDialog } from './QuantityDialogs';
import { increaseQuantity, decreaseQuantity, readUnits, updateUnit } from './firebase/manage-units';
import { parseCantidad } from '../lib/codes/thresholds';
import { tieneUnidades } from '../lib/constants/tipos';
import { ESTADOS } from '../lib/codes/prefixes';

const ESTADO_LABEL = { bueno: 'Bueno', malo: 'Malo', reparacion: 'En reparación' };
const MAX_A_LA_VEZ = 50;

function borrador(registro) {
  return {
    marca: registro.marcaMixta ? '' : (registro.marca ?? ''), modelo: registro.modeloMixto ? '' : (registro.modelo ?? ''),
    numeroSerie: '', codigoFundaempresa: '', estado: 'bueno', observaciones: '',
  };
}

export default function AddUnitsPanel({ registro, user, onChanged }) {
  const conUnidades = tieneUnidades(registro.tipo);
  const actual = parseCantidad(registro.cantidad);
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState('agregar'); // solo insumos: 'agregar' | 'quitar'
  const [n, setN] = useState(1);
  const [drafts, setDrafts] = useState([]);
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [confirmInfo, setConfirmInfo] = useState(null);

  const total = useMemo(() => (actual.ok ? actual.value : 0), [actual.ok, actual.value]);
  const quitando = !conUnidades && modo === 'quitar';
  const nuevoTotal = quitando ? total - n : total + n;

  const abrir = () => { setAbierto(true); setN(1); setDrafts([borrador(registro)]); setMotivo(''); setModo('agregar'); };
  const cancelar = () => { setAbierto(false); setDrafts([]); setConfirmInfo(null); setProgress(null); };

  const cambiarN = (valor) => {
    const v = Math.max(1, Math.min(MAX_A_LA_VEZ, valor));
    setN(v);
    setDrafts((prev) => Array.from({ length: v }, (_, i) => prev[i] ?? borrador(registro)));
  };
  const setCampo = (i, k, v) => setDrafts((prev) => prev.map((d, j) => (j === i ? { ...d, [k]: v } : d)));
  const copiarPrimera = () => setDrafts((prev) => prev.map(() => ({ ...prev[0] })));

  const aplicar = async (confirmed = false) => {
    setBusy(true);
    try {
      if (quitando) {
        if (nuevoTotal < 0) throw new Error('No se puede quedar con cantidad negativa.');
        const r = await decreaseQuantity(registro.id, nuevoTotal, null, { motivo, user });
        if (r.status === 'error') throw new Error(r.error);
        toast('Cantidad actualizada.');
      } else {
        const antes = await (conUnidades ? readUnits(registro.id, { includeInactive: true }) : Promise.resolve([]));
        const idsAntes = new Set(antes.map((u) => u.id));
        const r = await increaseQuantity(registro.id, nuevoTotal, { confirmed, user, onProgress: setProgress });
        if (r.status === 'needs-confirmation') {
          setConfirmInfo({ nombre: registro.equipo, tipo: registro.tipo, cantidad: r.cantidad, threshold: r.threshold, action: r.action });
          return;
        }
        if (r.status === 'error') throw new Error(r.error);
        if (conUnidades) {
          // Las unidades recién creadas reciben los datos escritos en cada formulario (en orden).
          const despues = await readUnits(registro.id, { includeInactive: true });
          const nuevas = despues.filter((u) => !idsAntes.has(u.id));
          for (let i = 0; i < nuevas.length; i++) {
            const d = drafts[i];
            if (!d) continue;
            const campos = Object.fromEntries(Object.entries(d).filter(([k, v]) => v !== '' && !(k === 'estado' && v === 'bueno')));
            if (Object.keys(campos).length > 0) {
              const u = await updateUnit(registro.id, nuevas[i].id, campos, { user });
              if (u.status === 'error') toast.error(`Unidad ${nuevas[i].codigo}: ${u.error}`);
            }
          }
          toast(`Se agregaron ${r.created} unidad(es) con código. Quedan pendientes de imprimir.`);
        } else {
          toast('Cantidad actualizada.');
        }
      }
      setConfirmInfo(null);
      cancelar();
      onChanged?.();
    } catch (e) {
      toast.error(e.message || 'No se pudo cambiar la cantidad.');
    } finally {
      setBusy(false);
    }
  };

  if (!actual.ok) {
    return <Alert severity="warning" sx={{ mt: 2 }}>La cantidad actual no es válida: corrígela arriba antes de agregar o quitar.</Alert>;
  }

  return (
    <Box sx={{ mt: 2, border: '1px solid #D3E3FD', borderRadius: '16px', p: 2, bgcolor: '#fff' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ fontSize: '1.05rem' }}>Cantidad: {total}</Typography>
        {!abierto && <Button variant="contained" startIcon={<AddIcon />} onClick={abrir}>{conUnidades ? 'Agregar unidades' : 'Cambiar cantidad'}</Button>}
      </Box>

      {abierto && (
        <Box sx={{ mt: 1.5, display: 'grid', gap: 1.5 }}>
          {!conUnidades && (
            <ToggleButtonGroup exclusive size="small" value={modo} onChange={(_, v) => v && setModo(v)}>
              <ToggleButton value="agregar">Agregar</ToggleButton>
              <ToggleButton value="quitar">Quitar</ToggleButton>
            </ToggleButtonGroup>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="body2">{quitando ? 'Cuántos quitar' : 'Cuántos agregar'}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#EEF3FB', borderRadius: '12px' }}>
              <IconButton aria-label="uno menos" onClick={() => cambiarN(n - 1)} disabled={n <= 1 || busy}><RemoveIcon /></IconButton>
              <Typography sx={{ minWidth: 36, textAlign: 'center', fontWeight: 600 }}>{n}</Typography>
              <IconButton aria-label="uno más" onClick={() => cambiarN(n + 1)} disabled={n >= MAX_A_LA_VEZ || busy}><AddIcon /></IconButton>
            </Box>
            <Typography variant="body2" color="text.secondary">Total resultante: <strong>{nuevoTotal}</strong></Typography>
          </Box>

          {conUnidades && (
            <>
              <Alert severity="info">
                Cada unidad nueva recibe su código y queda pendiente de imprimir. Para quitar unidades, dalas de baja una por una en la lista de abajo.
              </Alert>
              {n > 1 && <Box><Button size="small" onClick={copiarPrimera}>Copiar los datos de la primera a todas</Button></Box>}
              {drafts.map((d, i) => (
                <Box key={i} sx={{ bgcolor: '#F1F5FC', borderRadius: '16px', p: 1.75 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Unidad nueva {i + 1} de {n}</Typography>
                  <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
                    <TextField size="small" label="Marca" value={d.marca} onChange={(e) => setCampo(i, 'marca', e.target.value)} />
                    <TextField size="small" label="Modelo" value={d.modelo} onChange={(e) => setCampo(i, 'modelo', e.target.value)} />
                    <TextField size="small" select label="Estado" value={d.estado} onChange={(e) => setCampo(i, 'estado', e.target.value)}>
                      {ESTADOS.map((s) => <MenuItem key={s} value={s}>{ESTADO_LABEL[s]}</MenuItem>)}
                    </TextField>
                    <TextField size="small" label="Número de serie" value={d.numeroSerie} onChange={(e) => setCampo(i, 'numeroSerie', e.target.value)} />
                    <TextField size="small" label="Código Fundaempresa" value={d.codigoFundaempresa} onChange={(e) => setCampo(i, 'codigoFundaempresa', e.target.value)} />
                    <TextField size="small" label="Observaciones" value={d.observaciones} onChange={(e) => setCampo(i, 'observaciones', e.target.value)} />
                  </Box>
                </Box>
              ))}
            </>
          )}

          {quitando && (
            <TextField size="small" label="Motivo (obligatorio, mínimo 5 caracteres)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          )}
          {progress && <LinearProgress variant="determinate" value={Math.min(100, (progress.done / Math.max(progress.total, 1)) * 100)} />}

          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button onClick={cancelar} disabled={busy}>Cancelar</Button>
            <Button
              variant="contained" onClick={() => aplicar(false)}
              disabled={busy || (quitando && (motivo.trim().length < 5 || nuevoTotal < 0))}
            >
              {quitando ? `Quitar ${n}` : conUnidades ? `Agregar ${n} unidad${n === 1 ? '' : 'es'}` : `Agregar ${n}`}
            </Button>
          </Box>
        </Box>
      )}

      <ThresholdConfirmDialog open={!!confirmInfo} info={confirmInfo} busy={busy} onCancel={() => setConfirmInfo(null)} onConfirm={() => aplicar(true)} />
    </Box>
  );
}

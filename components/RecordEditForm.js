// Edición de los DATOS GENERALES de un registro (modo editar del detalle). Imagen a un lado y los datos al otro.
//   - Se editan: nombre, ubicación, columna de localización, observaciones, vencimiento e imagen.
//   - Tipo, marca y modelo YA NO se editan aquí: el tipo se cambia en Opciones → Cambiar tipo (cambia las etiquetas),
//     y la marca y el modelo se registran por unidad. Excepción: los insumos (no tienen unidades) sí editan marca y
//     modelo aquí, junto con serie, código Fundaempresa y estado.
//   - La cantidad no se escribe a mano: se agrega o quita con el contador de más abajo.
//   - Si el registro tiene datos incongruentes (sin tipo o cantidad inválida) se permite corregir tipo y cantidad.
// Props: { data, onSaved }   onSaved(): refrescar el registro tras guardar
import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ZoomableImage from './ZoomableImage';
import { Timestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

import Uploader from './uploader/uploader';
import updateItem from './firebase/update-item';
import { uploadImage } from './firebase/uploadImages';
import deleteImage from './firebase/delete-blob';
import { necesitaCorreccion } from './optionsItemCard';
import { TIPOS, tieneUnidades } from '../lib/constants/tipos';
import { ESTADOS } from '../lib/codes/prefixes';
import { parseCantidad } from '../lib/codes/thresholds';
import { validarVencimiento, valorAFechaInput } from '../lib/validation/vencimiento';

const ESTADO_LABEL = { bueno: 'Bueno', malo: 'Malo', reparacion: 'En reparación' };

export default function RecordEditForm({ data, onSaved }) {
  const corregir = necesitaCorreccion(data);
  const esInsumo = data.tipo === 'Suministro';
  const conUnidades = tieneUnidades(data.tipo);

  const [equipo, setEquipo] = useState(data.equipo ?? '');
  const [ubicacion, setUbicacion] = useState(data.ubicacion ?? '');
  const [columna, setColumna] = useState(data.columnadelocalizacion ?? '');
  const [observaciones, setObservaciones] = useState(Array.isArray(data.observaciones) ? data.observaciones.join('\n') : (data.observaciones ?? ''));
  const [marca, setMarca] = useState(data.marca ?? '');
  const [modelo, setModelo] = useState(data.modelo ?? '');
  const [serie, setSerie] = useState(data.numeroSerie ?? '');
  const [fundaempresa, setFundaempresa] = useState(data.codigoFundaempresa ?? '');
  const [estado, setEstado] = useState(data.estado ?? 'bueno');
  const [tipo, setTipo] = useState(data.tipo ?? '');
  const [cantidad, setCantidad] = useState(data.cantidad ?? '');
  const [tieneVenc, setTieneVenc] = useState(!!data.tieneVencimiento);
  const [fechaVenc, setFechaVenc] = useState(valorAFechaInput(data.fechaVencimiento));
  const [imgURL, setImgURL] = useState(data.imgurl ?? '');
  const [imgName, setImgName] = useState(data.imgname ?? '');
  const [imgFile, setImgFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const quitarImagen = async () => {
    if (!imgName) { setImgURL(''); return; }
    const ok = await deleteImage(`images/${imgName}`);
    if (!ok) { toast.error('No se pudo eliminar la imagen.'); return; }
    try {
      await updateItem(data.id, { imgurl: '', imgname: '' });
      setImgURL(''); setImgName(''); setImgFile(null);
      toast('Imagen eliminada.');
      onSaved?.();
    } catch (error) {
      toast.error(`No se pudo actualizar el registro. ${error.message || ''}`);
    }
  };

  const guardar = async () => {
    if (equipo.trim().length < 1) { toast.error('El nombre no puede quedar vacío.'); return; }
    const venc = validarVencimiento({ tieneVencimiento: tieneVenc, fecha: fechaVenc });
    if (!venc.ok) { toast.error(venc.error); return; }
    if (corregir) {
      if (!tipo) { toast.error('Selecciona el tipo del registro.'); return; }
      const c = parseCantidad(cantidad);
      if (!c.ok) { toast.error(`Cantidad inválida: ${c.reason}.`); return; }
    }
    setBusy(true);
    try {
      let imgurl = imgURL;
      let imgname = imgName;
      if (imgFile != null) {
        if (imgName) {
          const ok = await deleteImage(`images/${imgName}`);
          if (!ok) { toast.error('No se pudo eliminar la imagen anterior.'); return; }
        }
        const res = await uploadImage(imgFile);
        if (res[0] !== 1) { toast.error('No se pudo subir la imagen nueva.'); return; }
        imgurl = res[1]; imgname = res[2];
        setImgURL(imgurl); setImgName(imgname); setImgFile(null);
      }
      const nuevo = {
        equipo: equipo.trim(), ubicacion, columnadelocalizacion: columna, observaciones, imgurl, imgname,
        tieneVencimiento: tieneVenc, fechaVencimiento: venc.fecha ? Timestamp.fromDate(venc.fecha) : null,
      };
      if (corregir) { nuevo.tipo = tipo; nuevo.cantidad = cantidad; }
      if (esInsumo) { Object.assign(nuevo, { marca, modelo, numeroSerie: serie, codigoFundaempresa: fundaempresa, estado }); }
      await updateItem(data.id, nuevo);
      toast('Cambios guardados.');
      onSaved?.();
    } catch (error) {
      console.error(error);
      toast.error(`No se pudo guardar. ${error.message || ''}`);
    } finally {
      setBusy(false);
    }
  };

  const campo = { size: 'small', fullWidth: true };

  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'minmax(260px, 380px) 1fr' }, alignItems: 'start' }}>
      {/* Imagen */}
      <Box>
        <Box sx={{ borderRadius: '16px', overflow: 'hidden', bgcolor: '#EEF3FB', aspectRatio: { xs: '4 / 3', md: '4 / 3' }, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ZoomableImage src={imgURL} alt={data.equipo} fallback={<Typography variant="body2" color="text.secondary">Sin imagen</Typography>} />
        </Box>
        {imgURL && <Button size="small" color="error" onClick={quitarImagen} sx={{ mt: 1 }}>Quitar imagen</Button>}
        <Box sx={{ mt: 1 }}>
          <Uploader setImgFile={setImgFile} setImgURL={setImgURL} setImgName={setImgName} />
        </Box>
      </Box>

      {/* Datos */}
      <Box sx={{ bgcolor: '#F1F5FC', borderRadius: '16px', p: 2.25, display: 'grid', gap: 1.75 }}>
        {corregir && (
          <Alert severity="warning">
            Datos incongruentes{data.motivoValidacion ? `: ${data.motivoValidacion}` : ''}. Corrige el tipo y la cantidad para que el registro pueda recibir código.
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
          {data.codigo && <Chip color="primary" label={data.codigo} />}
          {!corregir && <Chip variant="outlined" label={`Tipo: ${data.tipo}`} />}
          {!corregir && <Chip variant="outlined" label={`Cantidad: ${data.cantidad}`} />}
        </Box>

        <TextField {...campo} label="Nombre" value={equipo} onChange={(e) => setEquipo(e.target.value)} />
        <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <TextField {...campo} label="Ubicación" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} />
          <TextField {...campo} label="Columna de localización" value={columna} onChange={(e) => setColumna(e.target.value)} />
        </Box>

        {corregir && (
          <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField {...campo} select label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
            <TextField {...campo} label="Cantidad" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </Box>
        )}

        {esInsumo && (
          <>
            <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField {...campo} label="Marca" value={marca} onChange={(e) => setMarca(e.target.value)} />
              <TextField {...campo} label="Modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} />
              <TextField {...campo} label="Número de serie" value={serie} onChange={(e) => setSerie(e.target.value)} />
              <TextField {...campo} label="Código Fundaempresa" value={fundaempresa} onChange={(e) => setFundaempresa(e.target.value)} />
            </Box>
            <TextField {...campo} select label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
              {ESTADOS.map((s) => <MenuItem key={s} value={s}>{ESTADO_LABEL[s]}</MenuItem>)}
            </TextField>
          </>
        )}

        <TextField {...campo} multiline minRows={2} label={`Observaciones${conUnidades ? ' generales' : ''}`} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <FormControlLabel control={<Switch checked={tieneVenc} onChange={(e) => { setTieneVenc(e.target.checked); if (!e.target.checked) setFechaVenc(''); }} />} label="Tiene fecha de vencimiento" />
          {tieneVenc && <TextField size="small" type="date" label="Fecha de vencimiento" InputLabelProps={{ shrink: true }} value={fechaVenc} onChange={(e) => setFechaVenc(e.target.value)} />}
        </Box>

        {!esInsumo && (
          <Typography variant="caption" color="text.secondary">
            La marca y el modelo se registran en cada unidad. El tipo se cambia en Opciones → Cambiar tipo.
          </Typography>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" onClick={guardar} disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</Button>
        </Box>
      </Box>
    </Box>
  );
}

import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';

import Link from 'next/link';
// import getImageUrl from './firebase/read-blob';


import HomeStyles from '../styles/Home.module.css';
import OptionsLabCard from './optionsLabCard';
import GenerateCodesButton from './GenerateCodesButton';
import LabPrintButton from './LabPrintButton';

const COLOR_SIN_CODIGO = '#ed6c02'; // ámbar: hay registros sin código
const COLOR_PENDIENTE = '#d32f2f'; // rojo: hay códigos generados que aún no se imprimen

// Props:
//   lab, role, setLaboratories (como antes)
//   status: conteos del lab { total, sinCodigo, pendienteImprimir, ... } (undefined mientras carga)
//   incongruentes: registros con datos incongruentes del lab (solo se muestra a admin)
//   selected: boolean — es el laboratorio activo del panel lateral
//   onSelect(lab): se llama al hacer clic en la tarjeta
//   onStatusChanged(labId): recargar conteos del lab (tras generar códigos o imprimir)
export default function LaboratoryCard({
  lab, setLaboratories, role, status, incongruentes = 0, selected = false, onSelect, onStatusChanged,
}) {
  const isAdmin = role === 'admin';
  const sinCodigo = status?.sinCodigo ?? 0;
  const pendiente = status?.pendienteImprimir ?? 0;

  // Franja izquierda: ámbar si falta generar códigos, roja si ya están generados pero sin imprimir.
  let borderLeft = '6px solid transparent';
  if (isAdmin && sinCodigo > 0) borderLeft = `6px solid ${COLOR_SIN_CODIGO}`;
  else if (isAdmin && pendiente > 0) borderLeft = `6px solid ${COLOR_PENDIENTE}`;

  const reload = () => onStatusChanged?.(lab.id);

  return (
    <Card
      sx={{ width: 345, borderLeft, cursor: onSelect ? 'pointer' : 'default' }}
      className={selected ? HomeStyles.labSelected : undefined}
      onClick={() => onSelect?.(lab)}
    >
      <CardMedia
        component="img"
        alt="Imagen de laboratorio"
        height="140"
        image={lab.imgurl}
        className={HomeStyles.cardmediaOverride}
      />
      <CardContent>
        <Typography gutterBottom variant="h5" component="div">
          <Link className={HomeStyles.labLink} href={"inventory?id=" + lab.id}>
            {lab.name}
          </Link>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {lab.description}
        </Typography>
        {lab.ubicacion ? (
          <Typography variant="body2" color="text.secondary">
            Ubicación: {lab.ubicacion}
          </Typography>
        ) : null}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {status && (
            <Chip size="small" variant="outlined" label={`${status.total} ${status.total === 1 ? 'registro' : 'registros'}`} />
          )}
          {isAdmin && incongruentes > 0 && (
            <Chip size="small" color="warning" label={`⚠ datos incongruentes — validar (${incongruentes})`} />
          )}
          {isAdmin && sinCodigo > 0 && (
            <Chip size="small" sx={{ bgcolor: COLOR_SIN_CODIGO, color: '#fff' }} label="Código sin generar" />
          )}
          {isAdmin && sinCodigo === 0 && pendiente > 0 && (
            <Chip size="small" color="error" label="Pendiente imprimir" />
          )}
        </div>
      </CardContent>
      <CardActions sx={{ flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
        <OptionsLabCard lab={lab} setLaboratories={setLaboratories} role={role} />
        {isAdmin && <GenerateCodesButton lab={lab} status={status} onDone={reload} />}
        {isAdmin && <LabPrintButton lab={lab} status={status} onDone={reload} />}
      </CardActions>
    </Card>
  );
}

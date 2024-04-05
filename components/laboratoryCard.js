import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import Link from 'next/link';
import getImageUrl from '../components/firebaseStuff/mostrar-imgs';


import HomeStyles from '../styles/Home.module.css';
import OptionsLabCard from './optionsLabCard';
import { useEffect, useState } from 'react';

export default function LaboratoryCard({ lab, handleRefresh }) {
  // const [imageUrl, setImageUrl] = useState(''); // Estado local para almacenar la URL de la imagen
  // const [loading, setLoading] = useState(true); // Estado local para rastrear si se está cargando la imagen

  // useEffect(() => {
  //   // Función asincrónica para cargar la URL de la imagen
  //   const loadImageUrl = async () => {
  //     try {
  //       const url = await getImageUrl(lab.imgurl); // Obtener la URL de la imagen
  //       setImageUrl(url); // Establecer la URL de la imagen en el estado
  //       setLoading(false); // Marcar que la carga ha finalizado
  //     } catch (error) {
  //       console.error('Error al cargar la imagen:', error);
  //     }
  //   };
  //   // Llamar a la función para cargar la URL de la imagen cuando el componente se monte
  //   loadImageUrl();
  // }, [lab.imgurl]); // Dependencia para volver a cargar la URL de la imagen si cambia lab.imgurl
  
  return (
    <Card sx={{ maxWidth: 345 }}>
      <CardMedia
        component="img"
        alt=""
        height="140"
        image={lab.imgurl}
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
      </CardContent>
      <CardActions>
        <OptionsLabCard lab={lab} handleRefresh = {handleRefresh} />
      </CardActions>
    </Card>
  );
}
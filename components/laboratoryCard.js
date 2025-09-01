import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';

import CommentIcon from '@mui/icons-material/Comment';


import Link from 'next/link';
// import getImageUrl from './firebase/read-blob';


import HomeStyles from '../styles/Home.module.css';
import OptionsLabCard from './optionsLabCard';

export default function LaboratoryCard({ lab, setLaboratories, role }) {
  return (
    <Card sx={{ width: 345 }}>
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
      </CardContent>
      <CardActions>
        <OptionsLabCard lab={lab} setLaboratories={setLaboratories} role={role} />
      </CardActions>
    </Card>
  );
}
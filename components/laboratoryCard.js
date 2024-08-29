import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';

import CommentIcon from '@mui/icons-material/Comment';


import Link from 'next/link';
// import getImageUrl from './firebaseStuff/read-blob';


import HomeStyles from '../styles/Home.module.css';
import OptionsLabCard from './optionsLabCard';

export default function LaboratoryCard({ lab, handleRefresh }) {
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
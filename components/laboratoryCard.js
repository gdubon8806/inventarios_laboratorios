import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import Link from 'next/Link';

import HomeStyles from '../styles/Home.module.css';

export default function LaboratoryCard({ lab }) {
    return (
      <Card sx={{ maxWidth: 345 }}>
        <CardMedia
          component="img"
          alt=""
          height="140"
          image={lab.img}
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
          <Button size="small">Opciones
            {/* <span className='icon-dot-3'></span> */}
          </Button>
  
        </CardActions>
      </Card>
    );
  }
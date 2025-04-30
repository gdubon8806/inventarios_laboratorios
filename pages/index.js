import Head from 'next/head';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';

//UI components
import SearchAppBar from '../components/searchBar';
import LaboratoryCard from '../components/laboratoryCard';
import AddLabCard from '../components/addLabCard';
import Button from '@mui/material/Button'
import { Toaster } from 'react-hot-toast';
import NavBar from '../components/profileStuff/NavBar';

//Request data components
import readLab from '../components/firebaseStuff/read-lab';

//export data
// import xlsx from '../vendor/xlsx';

//Styles
import HomeStyles from '../styles/Home.module.css';
import FormStyles from '../styles/Form.module.css';


export default function Index() {
  const { user, error, isLoading } = useUser();

  if (isLoading) return <div>Cargando...</div>;
  if (error) return <div>{error.message}</div>;

  if (user) {
    return (
      <div>
        <HomePage></HomePage>
      </div>
    );
  }

  return (
    <div className={FormStyles.loginContainerWrapper}>
      <div className={FormStyles.loginContainer}>
        <Image
          src='/img/ceutec_logo.png'
          width={180}
          height={180}
          alt='Logo de CEUTEC'></Image>
        <h1>
          Bienvenido a inventario de laboratorios
        </h1>
        <Button variant="contained" href='/api/auth/login'>Iniciar Sesión</Button>
      </div>
    </div>
  )
}


export function HomePage() {
  const [laboratories, setLaboratories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  let laboratoryCards;

  const fetchLabs = async () => {
    try {
      await readLab().then((res) => {
        // console.log('Se extrayeron de la db los labs exitosamente.')
        setLaboratories(res);
        setLoading(false);
      })
    } catch (error) {
      console.error('Error al extraer los laboratorios de la db.')
    }
  };


  useEffect(() => {
    fetchLabs();

  }, []);

  const handleRefresh = () => {
    fetchLabs();
  };

  if (loading) {
    laboratoryCards = 'Cargando laboratorios...';
  } else {
    if (laboratories.length == 0) {
      laboratoryCards = 'No hay registros de laboratorios.';
    } else {
      let filteredLaboratories = laboratories.filter((lab) => {
        //check en el apartado de buscador desde este lado
        const vowels = {
          "á": "a",
          "é": "e",
          "í": "i",
          "ó": "o",
          "ú": "u",
          "ü": "u",
          "ñ": "n"
        }
        //transforma el nombre del lab tambien de la db sin caracteres especiales
        let newNombreLab = "";
        let currentNombreLab = lab.name;
        currentNombreLab = currentNombreLab.toLowerCase();
        for (const letter of currentNombreLab) { //termómetro
          if (letter == "á" ||
            letter == "é" ||
            letter == "í" ||
            letter == "ó" ||
            letter == "ú" ||
            letter == "ü" ||
            letter == "ñ") {
            newNombreLab += vowels[letter];
          } else {
            newNombreLab += letter;
          }
        }
        let newFilter = "";
        let currentFilter = filter.toLowerCase().trim();
        for (const letter of currentFilter) { //termómetro
          if (letter == "á" ||
            letter == "é" ||
            letter == "í" ||
            letter == "ó" ||
            letter == "ú" ||
            letter == "ü" ||
            letter == "ñ") {
            newFilter += vowels[letter];
          } else {
            newFilter += letter;
          }
        }

        if ((newNombreLab.toUpperCase()).includes(newFilter.toUpperCase())) {
          return lab;
        }
      })
      laboratoryCards = filteredLaboratories.map(laboratory => <LaboratoryCard key={laboratory.id} lab={laboratory} handleRefresh={handleRefresh}> </LaboratoryCard>)
    }
  }

  return (
    <>
      <Head>
        <title>Inventarios</title>
        <link
          rel="stylesheet"
          href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css"
          integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T"
          crossOrigin="anonymous"
        />
        {/* <link rel="stylesheet" href="https://cdn.auth0.com/js/auth0-samples-theme/1.0/css/auth0-theme.min.css" /> */}
      </Head>
      <div className={HomeStyles.fixedContainer}>
        <HeaderBar />
        <LabsContainerControls setFilter={setFilter} handleRefresh={handleRefresh} />
      </div>
      <LabsContainer labs={laboratoryCards} />
      <Toaster />
    </>
  );
}

export function HeaderBar() {
  return (
    <header>
      <div className={HomeStyles.headerBar}>
        {/* <Image src='/img/ceutec_logo.png' width='150' height='80' alt='Logo de CEUTEC'></Image> */}
        <div className={HomeStyles.gridInsideHeaderBar}>
          <h1>Inventario de laboratorios</h1>
        </div>
        <NavBar />
      </div>
    </header>
  )
}

function LabsContainerControls({ setFilter, handleRefresh }) {
  return (
    <div className={HomeStyles.labsControls}>
      <div className={HomeStyles.controls}>
        <SearchAppBar setFilter={setFilter} />
        <AddLabCard handleRefresh={handleRefresh} />
      </div>
    </div>
  )
}

function LabsContainer({ labs }) {
  return (
    <div className={HomeStyles.labsContainer}>
      {labs}
    </div>
  )
}




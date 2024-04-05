import Head from 'next/head';
import Image from 'next/image';
import { useEffect, useState } from 'react';

//UI components
import SearchAppBar from '../components/searchBar';
import LaboratoryCard from '../components/laboratoryCard';
import AddLabCard from '../components/addLabCard';

import toast, { Toaster } from 'react-hot-toast';


//Styles
import HomeStyles from '../styles/Home.module.css';
import readLab from '../components/firebaseStuff/read-lab';

export default
  function HomePage() {
  const [laboratories, setLaboratories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  let laboratoryCards;

  const fetchLabs = async () => {
    try {
      await readLab().then((res) => {
        console.log('Se extrayeron de la db los labs exitosamente.')
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

  //primero cargan los labs
  //por cada caracter en el input se usa una funcion para iterar sobre los labs
  // y determinar si contiene ese caracter, para usar toggleClassList



  if (loading) {
    laboratoryCards = 'Cargando laboratorios...';
  } else {
    if (laboratories.length == 0) {
      laboratoryCards = 'No hay registros de laboratorios.';
    } else {
      laboratoryCards = laboratories.map(laboratory => <LaboratoryCard key={laboratory.id} lab={laboratory} handleRefresh={handleRefresh}> </LaboratoryCard>)
    }
  }

  return (
    <>
      <Head>
        <title>Inventarios</title>
      </Head>
      <div className={HomeStyles.fixedContainer}>
        {/* <Inventarios /> */}
        <HeaderBar />
        <LabsContainerControls handleRefresh={handleRefresh} />
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
        <h1>Inventario de laboratorios</h1>
      </div>
    </header>
  )
}

function LabsContainerControls({ handleRefresh }) {
  return (
    <div className={HomeStyles.labsControls}>
      <div className={HomeStyles.controls}>
        <SearchAppBar />
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




import Head from 'next/head';
import Image from 'next/image';
import { useEffect, useState } from 'react';

//UI components
import SearchAppBar from '../components/searchBar';
import LaboratoryCard from '../components/laboratoryCard';
import AddLabCard from '../components/addLabCard';

//Styles
import HomeStyles from '../styles/Home.module.css';

export default
  function HomePage() {
  const [laboratories, setLaboratories] = useState([]);
  const [loading, setLoading] = useState(true);
  let laboratoryCards;

  const fetchLabs = async () => {
    try {
      const response = await fetch('/api/read_lab'); // Aquí debes poner la ruta correcta a tu API
      if (!response.ok) {
        throw new Error('Error al obtener datos: ' + response.statusText);
      }
      const data = await response.json();

      const fetchedLabs = data.result.rows;
      setLaboratories(fetchedLabs)
      setLoading(false);
    } catch (error) {
      console.error(error.message);
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




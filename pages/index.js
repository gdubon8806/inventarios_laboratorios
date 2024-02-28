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
  let laboratoryCards;

  useEffect(() => {
    const fetchLabs = async () => {
      try {
        const response = await fetch('/api/read_lab'); // Aquí debes poner la ruta correcta a tu API
        if (!response.ok) {
          throw new Error('Error al obtener datos: ' + response.statusText);
        }
        const data = await response.json();
        const fetchedLabs = data.result.rows;
        setLaboratories([...laboratories, ...fetchedLabs])
      } catch (error) {
        console.error(error.message);
      }
    };

    fetchLabs();
  }, []);
  
  if (laboratories.length == 0) {
    laboratoryCards = 'Cargando laboratorios...';
  } else {
    laboratoryCards = laboratories.map(laboratory => <LaboratoryCard key={laboratory.id} lab={laboratory} labs={laboratories} setLabs={setLaboratories}></LaboratoryCard>)
  }

  return (
    <>
      <Head>
        <title>Inventarios</title>
      </Head>
      <div className={HomeStyles.fixedContainer}>
        {/* <Inventarios /> */}
        <HeaderBar />
        <LabsContainerControls/>
      </div>
      <LabsContainer labs={laboratoryCards} />
    </>
  );
}

export function HeaderBar() {
  return (
    <header>
      <div className={HomeStyles.headerBar}>
        <Image src='/img/ceutec_logo.png' width='100' height='30' alt='Logo de CEUTEC'></Image>
        <h1>Inventario de laboratorios</h1>
      </div>
    </header>
  )
}

function LabsContainerControls() {
  return (
    <div className={HomeStyles.labsControls}>
      <div className={HomeStyles.controls}>
        <SearchAppBar />
        <AddLabCard/>
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




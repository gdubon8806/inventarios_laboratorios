import Head from 'next/head';
import { useEffect, useState } from 'react';

//UI components
import SearchAppBar from '../components/searchBar';
import LaboratoryCard from '../components/laboratoryCard';
import AddLabCard from '../components/addLabCard';
import { Toaster } from 'react-hot-toast';

//Request data components
import readLab from '../components/firebaseStuff/read-lab';

//Styles
import HomeStyles from '../styles/Home.module.css';

export default
  function HomePage() {
  const [laboratories, setLaboratories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

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

  if (loading) {
    laboratoryCards = 'Cargando laboratorios...';
  } else {
    if (laboratories.length == 0) {
      laboratoryCards = 'No hay registros de laboratorios.';
    } else {
      let filteredLaboratories = laboratories.filter((lab) => {
        if((lab.name.toUpperCase()).includes(filter.toUpperCase())) {
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
      </Head>
      <div className={HomeStyles.fixedContainer}>
        {/* <Inventarios /> */}
        <HeaderBar />
        <LabsContainerControls setFilter = {setFilter} handleRefresh={handleRefresh} />
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

function LabsContainerControls({setFilter, handleRefresh }) {
  return (
    <div className={HomeStyles.labsControls}>
      <div className={HomeStyles.controls}>
        <SearchAppBar setFilter = {setFilter} />
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




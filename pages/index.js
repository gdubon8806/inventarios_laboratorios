import Head from 'next/head';

//UI components
import SearchAppBar from '../components/searchBar';
import LaboratoryCard from '../components/laboratoryCard';
import AddLabCard from '../components/addLabCard';


//Styles
import HomeStyles from '../styles/Home.module.css';


export default function HomePage() {
  let laboratories = [
    { id: 1, name: "Laboratorio de Electrónica", description: "lorem ipsum", img: "/img/labs/electronica.jpg" },
    { id: 2, name: "Laboratorio de Química", description: "Es otro rollo x2.", img: "/img/labs/quimica.jpg" },
    { id: 3, name: "Laboratorio Gesell", description: "Es otro rollo x3.", img: "/img/labs/camaraGesell.jpg" },
    { id: 4, name: "Laboratorio de MAC", description: "Es otro rollo x4.", img: "/img/labs/mac.jpg" },
  ]

  let laboratoryCards = laboratories.map(laboratory => <LaboratoryCard lab={laboratory}></LaboratoryCard>)

  return (
    <>
      <Head>
        <title>Inventarios</title>
      </Head>
      <HeaderBar />
      <main>
        <LabsContainerControls />
        <LabsContainer labs={laboratoryCards} />

      </main>
    </>
  );
}

export function HeaderBar() {
  return (
    <header>
      <div className={HomeStyles.headerBar}>
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
          <AddLabCard />
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




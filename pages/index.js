import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/Link';

//home - pagina inventarios
//pagina de inventario
//pagina para un item de inventario


import HomeStyles from '../styles/Home.module.css';
export default function HomePage() {
  let laboratories = [
    { id: 1, name: "Laboratorio de electronica", description: "Es otro rollo.", img: "/img/labs/electronica.jpg" },
    { id: 2, name: "Laboratorio de quimica", description: "Es otro rollo x2.", img: "/img/labs/quimica.jpg" },
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
      <div>
        <h2>Laboratorios</h2>
      </div>
      <div className='addLabContainer'>
        <span className='icon-plus-circled'></span>
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

function LaboratoryCard({ lab }) {

  return (
    <div className={HomeStyles.laboratoryCard}>
      <div className={HomeStyles.imgLabContainer}>
        <Image src = {lab.img} width={350} height={200}></Image>
      </div>
      <div>
        <div className={HomeStyles.nameLaboratoryCardContainer}>
          <Link className={HomeStyles.labLink} href={"inventory?id=" + lab.id}>
            <h3>{lab.name}</h3>
          </Link>
        </div>
        <div className='optionsLaboratoryCard'>
          <span className='icon-dot-3'></span>
        </div>
      </div>
    </div>
  )
}

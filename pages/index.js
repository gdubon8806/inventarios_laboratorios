import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/Link';

import HomeStyles from '../styles/Home.module.css';
export default function HomePage() {
  return (
    <>
      <Head>
        <title>Inventarios</title>
      </Head>

      <HeaderBar />
      <main>
        <LabsContainerControls />
        <LabsContainer />
        <Link href="/inventory">Hola</Link>
      </main>
    </>
  );
}

function HeaderBar() {
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

function LabsContainer() {
  return (
    <div className={HomeStyles.labsContainer}>
      <LaboratoryCard />
      <LaboratoryCard />
      
    </div>
  )
}

function LaboratoryCard() {
  return (
    <div className={HomeStyles.laboratoryCard}>
      <Image src='/img/electronica.jpg' width={333} height={139}></Image>
      <div>
        <div className={HomeStyles.nameLaboratoryCardContainer}>
          <h3>Laboratorio de Electrónica</h3>
        </div>
        <div className='optionsLaboratoryCard'>
          <span className='icon-dot-3'></span>
        </div>
      </div>

    </div>
  )
}

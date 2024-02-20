import Head from 'next/head';
import Image from 'next/image';
import { useState } from 'react';

//UI components
import SearchAppBar from '../components/searchBar';
import LaboratoryCard from '../components/laboratoryCard';
import AddLabCard from '../components/addLabCard';

import labs from './db';
//Styles
import HomeStyles from '../styles/Home.module.css';


export default function HomePage() {
  const [laboratories, setLaboratories] = useState(Array.from(labs.values()));

  function addLaboratory({ name, description, img }) {
    const id = laboratories.length + 1;
    const newLaboratory = { id, name, description, img }
    setLaboratories([...laboratories, newLaboratory]);
  }
  console.log(laboratories)

  let laboratoryCards = laboratories.map(laboratory => <LaboratoryCard key={laboratory.id} lab={laboratory} labs={laboratories} setLabs={setLaboratories}></LaboratoryCard>)

  return (
    <>
      <Head>
        <title>Inventarios</title>
      </Head>
      <div className={HomeStyles.fixedContainer}>
        <HeaderBar />
        <LabsContainerControls handleAdd={addLaboratory} />
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

function LabsContainerControls({ handleAdd }) {
  return (
    <div className={HomeStyles.labsControls}>
      <div className={HomeStyles.controls}>
        <SearchAppBar />
        <AddLabCard handleAdd={handleAdd} />
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




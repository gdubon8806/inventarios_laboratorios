import Head from 'next/head';
import Image from 'next/image';
import { useState } from 'react';

//UI components
import SearchAppBar from '../components/searchBar';
import LaboratoryCard from '../components/laboratoryCard';
import AddLabCard from '../components/addLabCard';

//Styles
import HomeStyles from '../styles/Home.module.css';

const labs = new Map();

labs.set(1, {
    id: 1,
    name: "Laboratorio de electrónica",
    description: "Laboratorio para ingenieria electronica",
    items: [
        {
            id: '1',
            equipo: "Programmable DC POWER Supply",
            marca: "EXTECH-Instruments",
            modelo: "382280",
            ubicacion: "Mesa de trabajo",
            columnaDeLocalizacion: "3/F2-1/E2-3/D2",
            tipo: "Equipo",
            cantidad: "7",
            img: "/img/items/item1.jpg",
            observaciones: []
        },
        {
            id: '2',
            equipo: "Puntas de prueba de osiloscopio",
            marca: "NATIONAL-Instruments",
            modelo: "780594-01",
            ubicacion: "Armario 1",
            columnaDeLocalizacion: "Nivel 3",
            tipo: "Suministro",
            cantidad: "7",
            img: "/img/items/item6.jpg",
            observaciones: []
        },{
            id: '3',
            equipo: "Juego de desarmadores de precision",
            marca: "NT",
            modelo: "NT",
            ubicacion: "Armario 1",
            columnaDeLocalizacion: "Nivel 4",
            tipo: "Herramienta",
            cantidad: "2",
            img: "/img/items/item5.jpg",
            observaciones: []
        }
    ],
    img: '/img/labs/electronica.jpg'
})

labs.set(2, {
    id: 2,
    name: "Laboratorio de quimica",
    description: "Laboratorio para ciencias de la salud",
    items: [
        {
            id: '1',
            equipo: 'Microscopio',
            marca: 'OPTIKA',
            modelo: 'B-150',
            ubicacion: 'Repisa',
            columnaDeLocalizacion: 'C1',
            tipo: 'Equipo',
            cantidad: '4',
            img: '/img/items/item2.jpg',
            observaciones: []
        },
    ],
    img: '/img/labs/quimica.jpg'
});

labs.set(3, {
    id: 3,
    name: "Laboratorio de Gesell",
    description: "Laboratorio para psicologia",
    items: [
        {
            id: '1',
            equipo: 'Network video Recorder',
            marca: 'HIKVISION',
            modelo: 'DS-7104NI-E1',
            ubicacion: 'Mesa',
            columnaDeLocalizacion: '',
            tipo: 'Equipo',
            cantidad: '1',
            img: '/img/items/item3.jpg',
            observaciones: []
        },
    ],
    img: '/img/labs/camaraGesell.jpg'
})

labs.set(4, {
    id: 4,
    name: "Taller de Redes",
    description: "Laboratorio para instalacion de redes",
    items: [
        {
            id: '1',
            equipo: 'Router',
            marca: 'MikroTik',
            modelo: 'hEX lite',
            ubicacion: 'Armario 3',
            columnaDeLocalizacion: 'Nivel 4',
            tipo: 'Equipo',
            cantidad: '5',
            img: '/img/items/item4.jpg',
            observaciones: []
        },
    ],
    img: '/img/labs/tallerRedes.jpg'
})

export default  
function HomePage() {
  const [laboratories, setLaboratories] = useState(Array.from(labs.values()));
  let laboratoryCards;
  function addLaboratory({ name, description, img }) {
    const id = laboratories.length + 1;
    const newLaboratory = { id, name, description, img }
    setLaboratories([...laboratories, newLaboratory]);
  }
  if (laboratories.length == 0) {
    laboratoryCards = 'No hay laboratorios registrados';
  } else {
    laboratoryCards = laboratories.map(laboratory => <LaboratoryCard key={laboratory.id} lab={laboratory} labs={laboratories} setLabs={setLaboratories}></LaboratoryCard>)
  }

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




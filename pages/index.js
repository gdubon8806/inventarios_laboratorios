'use client'
//Next and React
import Head from 'next/head';
import { useEffect, useState } from 'react';

//UI components
import SearchAppBar from '../components/searchBar';
import CodeSearchBar from '../components/codeSearchBar';
import LaboratoryCard from '../components/laboratoryCard';
import AddLabCard from '../components/addLabCard';
import Button from '@mui/material/Button'
import { Toaster } from 'react-hot-toast';
import DownloadIcon from '@mui/icons-material/Download';

//Firebase Auth
import { auth } from '../firebaseConfig';
import LoginForm from '../loginForm';
import { signOutSession } from '../authService';

//Request data components
import readLab from '../components/firebase/read-lab';

//Styles
import HomeStyles from '../styles/Home.module.css';
import InventoryStyles from '../styles/Inventory.module.css';

//
import { exportAllToXLSX } from '../components/exportData/export';

export default function Index() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser) {
        const tokenResult = await firebaseUser.getIdTokenResult(true);
        setRole(tokenResult.claims.role || null); // Guarda el rol
      } else {
        setRole(null);
      }
    });

    return () => unsubscribe();
  }, []);


  if (loading) return <div>Cargando...</div>;

  if (user) {
    return (
      <div>
        <HomePage user={user} role={role} />
      </div>
    );
  }

  return (
    <LoginForm></LoginForm>
  )
}


export function HomePage({ user, role }) {
  const [laboratories, setLaboratories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  let laboratoryCards;

  const fetchLabs = async () => {
    try {
      await readLab().then((res) => {
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
      laboratoryCards = filteredLaboratories.map(laboratory => <LaboratoryCard role={role} key={laboratory.id} lab={laboratory} setLaboratories={setLaboratories}> </LaboratoryCard>)
    }
  }

  return (
    <>
      <Head>
        <title>Inventarios</title>
      </Head>
      <div className={HomeStyles.fixedContainer}>
        <HeaderBar />
        <LabsContainerControls user={user} role={role} setFilter={setFilter} setLaboratories={setLaboratories} />
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
        {/* <NavBar /> */}
        <div>
          <Button style={{ paddingRight: "1rem" }} onClick={signOutSession}>Cerrar Sesión</Button>
        </div>
      </div>
    </header>
  )
}

function LabsContainerControls({ role, setFilter, setLaboratories }) {
  return (
    <div className={HomeStyles.labsControls}>
      <div className={HomeStyles.controls}>
        <SearchAppBar setFilter={setFilter} />
        <div className={InventoryStyles.flex}>
          {role === 'admin' && (
            <>
              <div>
                <AddLabCard setLaboratories={setLaboratories} />
              </div>
              <div>
                <Button startIcon={<DownloadIcon />}
                  className={InventoryStyles.downloadBTN} variant="contained" onClick={() => exportAllToXLSX()}>
                  Exportar todo
                </Button>
              </div>

            </>

          )}
        </div>
      </div>
      <CodeSearchBar role={role} />
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




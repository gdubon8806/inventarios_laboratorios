'use client'
//Next and React
import Head from 'next/head';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

//UI components
import SearchAppBar from '../components/searchBar';
import LaboratoryCard from '../components/laboratoryCard';
import AddLabCard from '../components/addLabCard';
import SidePanel from '../components/SidePanel';
import Button from '@mui/material/Button'
import { Toaster } from 'react-hot-toast';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import UploadFileIcon from '@mui/icons-material/UploadFile';

//Firebase Auth
import useRole from '../hooks/useRole';
import LoginForm from '../loginForm';
import { signOutSession } from '../authService';

//Request data components
import readLab from '../components/firebase/read-lab';
import readAllLabStatuses from '../components/firebase/read-lab-statuses';
import readIncongruentesPorLab from '../components/firebase/read-incongruentes';
import { getLabCodeStatus } from '../components/firebase/generate-missing-codes';
import { isCodeLike } from '../lib/codes/normalize';

//Styles
import HomeStyles from '../styles/Home.module.css';
import InventoryStyles from '../styles/Inventory.module.css';

//
import { exportAllToXLSX } from '../components/exportData/export';

export default function Index() {
  const { user, role, loading } = useRole();

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
  const isAdmin = role === 'admin';
  const [laboratories, setLaboratories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  // Panel lateral: laboratorio activo, conteos de códigos por lab y búsqueda disparada desde el buscador de labs.
  const [selectedLabId, setSelectedLabId] = useState(null);
  const [statuses, setStatuses] = useState({});
  const [incongruentes, setIncongruentes] = useState({});
  const [externalQuery, setExternalQuery] = useState(null);

  let laboratoryCards;

  const fetchLabs = async () => {
    try {
      // Una sola consulta trae los conteos de todos los labs (no se relee en cada render ni por tarjeta).
      const [labs, labStatuses, labIncongruentes] = await Promise.all([
        readLab(),
        readAllLabStatuses(),
        isAdmin ? readIncongruentesPorLab() : Promise.resolve({}),
      ]);
      setLaboratories(labs);
      setStatuses(labStatuses);
      setIncongruentes(labIncongruentes);
    } catch (error) {
      console.error('Error al extraer los laboratorios de la db.')
    } finally {
      setLoading(false);
    }
  };

  // Recarga el estado de UN laboratorio (tras generar códigos o marcar etiquetas como impresas).
  const reloadLabStatus = useCallback(async (labId) => {
    try {
      const fresh = await getLabCodeStatus(labId);
      setStatuses((prev) => ({ ...prev, [labId]: fresh }));
      if (isAdmin) setIncongruentes(await readIncongruentesPorLab());
    } catch (error) {
      console.error('No se pudo actualizar el estado del laboratorio:', error);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchLabs();
  }, []);

  // Si el texto del buscador parece un código, no se filtran los laboratorios por nombre.
  const nameFilter = isCodeLike(filter) ? '' : filter;

  const handleSearchEnter = (value) => {
    if (isCodeLike(value)) {
      setExternalQuery({ value: value.trim(), nonce: Date.now() });
    }
  };

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
        let currentFilter = nameFilter.toLowerCase().trim();
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
      laboratoryCards = filteredLaboratories.map(laboratory => (
        <LaboratoryCard
          role={role}
          key={laboratory.id}
          lab={laboratory}
          setLaboratories={setLaboratories}
          status={statuses[laboratory.id]}
          incongruentes={Math.max(incongruentes[laboratory.id] || 0, statuses[laboratory.id]?.incongruentes || 0)}
          selected={laboratory.id === selectedLabId}
          onSelect={(lab) => setSelectedLabId(lab.id)}
          onStatusChanged={reloadLabStatus}
        />
      ))
    }
  }

  const selectedLab = laboratories.find((l) => l.id === selectedLabId) || null;

  return (
    <>
      <Head>
        <title>Inventarios</title>
      </Head>
      <div className={HomeStyles.fixedContainer}>
        <HeaderBar />
        <LabsContainerControls user={user} role={role} setFilter={setFilter} setLaboratories={setLaboratories} onSearchEnter={handleSearchEnter} />
      </div>
      <div className={HomeStyles.homeLayout}>
        <LabsContainer labs={laboratoryCards} />
        {/* El panel aparece cuando ya cargaron los datos */}
        {!loading && (
          <SidePanel
            isAdmin={isAdmin}
            user={user}
            labs={laboratories}
            selectedLab={selectedLab}
            statuses={statuses}
            externalQuery={externalQuery}
            onSelectLab={setSelectedLabId}
            onStatusChanged={reloadLabStatus}
          />
        )}
      </div>
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

function LabsContainerControls({ role, setFilter, setLaboratories, onSearchEnter }) {
  return (
    <div className={HomeStyles.labsControls}>
      <div className={HomeStyles.controls}>
        <SearchAppBar setFilter={setFilter} onEnter={onSearchEnter} placeholder="Buscar laboratorio o código..." />
        <div className={InventoryStyles.flex} style={{ flexWrap: 'wrap' }}>
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
              <div>
                <Button component={Link} href="/importar" startIcon={<UploadFileIcon />} variant="outlined">
                  Importar Excel
                </Button>
              </div>
              <div>
                <Button component={Link} href="/bajas" startIcon={<DeleteSweepIcon />} variant="outlined">
                  Papelera
                </Button>
              </div>

            </>

          )}
        </div>
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

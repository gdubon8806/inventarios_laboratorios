'use client'
//Next and React
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';

//UI components
import SearchAppBar from '../components/searchBar';
import LaboratoryCard from '../components/laboratoryCard';
import AddLabCard from '../components/addLabCard';
import SidePanel from '../components/SidePanel';
import AppHeader from '../components/layout/AppHeader';
import LoadingScreen from '../components/ui/LoadingScreen';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { Toaster } from 'react-hot-toast';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import FactCheckIcon from '@mui/icons-material/FactCheck';

//Firebase Auth
import useRole from '../hooks/useRole';
import LoginForm from '../loginForm';
import { signOutSession } from '../authService';

//Request data components
import readLab from '../components/firebase/read-lab';
import { readAllActiveItems, statusesFromItems } from '../components/firebase/read-lab-statuses';
import readIncongruentesPorLab from '../components/firebase/read-incongruentes';
import { readLabRecords } from '../components/firebase/generate-missing-codes';
import { isCodeLike, normalizeText } from '../lib/codes/normalize';
import { matchRecord } from '../lib/inventory/stats';

//
import { exportAllToXLSX } from '../components/exportData/export';

const SIN_REGISTROS = { total: 0, sinCodigo: 0, pendienteImprimir: 0, impreso: 0, incongruentes: 0, porValidar: 0 };
const MAX_RESULTADOS = 30;

export default function Index() {
  const { user, role, loading } = useRole();

  if (loading) return <LoadingScreen text="Iniciando sesión…" />;

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

// ¿El laboratorio coincide con el texto? (nombre, ubicación y descripción; cada palabra debe aparecer)
function labMatches(lab, text) {
  const words = normalizeText(text).split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const hay = normalizeText(`${lab.name ?? ''} ${lab.ubicacion ?? ''} ${lab.description ?? ''}`);
  return words.every((w) => hay.includes(w));
}

export function HomePage({ user, role }) {
  const router = useRouter();
  const isAdmin = role === 'admin';
  const [laboratories, setLaboratories] = useState([]);
  const [items, setItems] = useState([]); // todos los registros activos (conteos + búsqueda de texto global)
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  // Panel de búsqueda por código: laboratorio activo, estado (abierto/cerrado) y búsqueda disparada desde el buscador.
  const [selectedLabId, setSelectedLabId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [incongruentes, setIncongruentes] = useState({});
  const [externalQuery, setExternalQuery] = useState(null);

  const statuses = useMemo(() => statusesFromItems(items), [items]);

  const fetchLabs = async () => {
    try {
      // Una sola lectura trae los registros de todos los labs (conteos y búsqueda); no se relee en cada render.
      const [labs, all, labIncongruentes] = await Promise.all([
        readLab(),
        readAllActiveItems(),
        isAdmin ? readIncongruentesPorLab() : Promise.resolve({}),
      ]);
      setLaboratories(labs);
      setItems(all.items);
      setLoadError(all.error);
      setIncongruentes(labIncongruentes);
    } catch (error) {
      console.error('Error al extraer los laboratorios de la db.', error)
      setLoadError(error?.message ?? 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Recarga los registros de UN laboratorio (tras generar códigos o marcar etiquetas como impresas).
  const reloadLabStatus = useCallback(async (labId) => {
    try {
      const fresh = await readLabRecords(labId);
      setItems((prev) => [...prev.filter((i) => i.idLab !== labId), ...fresh]);
      if (isAdmin) setIncongruentes(await readIncongruentesPorLab());
    } catch (error) {
      console.error('No se pudo actualizar el estado del laboratorio:', error);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchLabs();
  }, []);

  // Si el texto del buscador parece un código, se busca como código (Enter) y no por nombre.
  const codeLike = isCodeLike(filter);
  const textFilter = codeLike ? '' : filter.trim();

  const handleSearchEnter = (value) => {
    if (isCodeLike(value)) {
      setExternalQuery({ value: value.trim(), nonce: Date.now() });
    }
  };

  const filteredLabs = useMemo(() => laboratories.filter((lab) => labMatches(lab, textFilter)), [laboratories, textFilter]);

  // Artículos de TODOS los laboratorios que coinciden con el texto (nombre, marca, modelo, tipo, ubicación, columna...).
  const itemResults = useMemo(() => {
    if (!textFilter) return [];
    const labName = Object.fromEntries(laboratories.map((l) => [l.id, l.name]));
    const out = [];
    for (const it of items) {
      if (!labName[it.idLab]) continue; // registro de un laboratorio que no existe o está en la papelera
      const hit = matchRecord(it, textFilter, normalizeText);
      if (hit) out.push({ it, hit, lab: labName[it.idLab] });
    }
    return out;
  }, [items, laboratories, textFilter]);

  let laboratoryCards;
  if (loading) {
    laboratoryCards = <LoadingScreen inline text="Cargando laboratorios…" />;
  } else if (laboratories.length == 0) {
    laboratoryCards = <Typography sx={{ gridColumn: '1 / -1', textAlign: 'center', p: 3 }}>No hay registros de laboratorios.</Typography>;
  } else if (filteredLabs.length == 0) {
    laboratoryCards = <Typography sx={{ gridColumn: '1 / -1', textAlign: 'center', p: 3 }}>Ningún laboratorio coincide con la búsqueda.</Typography>;
  } else {
    laboratoryCards = filteredLabs.map((laboratory) => (
      <LaboratoryCard
        role={role}
        key={laboratory.id}
        lab={laboratory}
        setLaboratories={setLaboratories}
        status={loadError ? undefined : (statuses[laboratory.id] ?? SIN_REGISTROS)}
        incongruentes={Math.max(incongruentes[laboratory.id] || 0, statuses[laboratory.id]?.incongruentes || 0)}
        selected={laboratory.id === selectedLabId}
        onSelect={(lab) => setSelectedLabId(lab.id)}
        onStatusChanged={reloadLabStatus}
      />
    ));
  }

  const selectedLab = laboratories.find((l) => l.id === selectedLabId) || null;

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFD' }}>
      <Head>
        <title>Inventarios</title>
      </Head>

      {/* Encabezado fijo con los botones arriba, ordenados como un panel superior */}
      <AppHeader onLogout={signOutSession}>
        {isAdmin && (
          <>
            <AddLabCard setLaboratories={setLaboratories} />
            <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={() => exportAllToXLSX()}>Exportar todo</Button>
            <Button size="small" variant="outlined" component={Link} href="/importar" startIcon={<UploadFileIcon />}>Importar Excel</Button>
            <Button size="small" variant="outlined" component={Link} href="/bajas" startIcon={<DeleteSweepIcon />}>Papelera</Button>
            <Button size="small" variant="outlined" component={Link} href="/diagnostico" startIcon={<FactCheckIcon />}>Diagnóstico</Button>
          </>
        )}
        <Button
          size="small" variant="outlined" startIcon={<QrCodeScannerIcon />} onClick={() => setPanelOpen(true)}
          sx={{ display: { xs: 'none', md: 'inline-flex' } }}
        >
          Buscar por código
        </Button>
      </AppHeader>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '0.75rem' }}>
        {/* Buscador general (debajo del encabezado) */}
        <SearchAppBar setFilter={setFilter} onEnter={handleSearchEnter} placeholder="Buscar laboratorio, artículo o código" />
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.75, px: 0.5 }}>
          {codeLike
            ? <>Parece un código: pulsa Enter para buscarlo.</>
            : <>Busca en todos los laboratorios y en todos sus artículos.</>}
        </Typography>

        {loadError && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            No se pudieron leer los registros de los laboratorios, por eso los conteos pueden aparecer en 0 o faltar: {loadError}
          </Alert>
        )}

        {/* Artículos encontrados en cualquier laboratorio */}
        {textFilter && !loading && (
          <section style={{ marginTop: 12 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Artículos encontrados ({itemResults.length}{itemResults.length > MAX_RESULTADOS ? `, se muestran ${MAX_RESULTADOS}` : ''})
            </Typography>
            {itemResults.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Ningún artículo coincide con «{textFilter}».</Typography>
            ) : (
              <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {itemResults.slice(0, MAX_RESULTADOS).map(({ it, hit, lab }) => (
                  <Button
                    key={it.id} component={Link} href={`/inventory?id=${it.idLab}&item=${it.id}`}
                    variant="outlined" color="inherit"
                    sx={{ justifyContent: 'flex-start', textAlign: 'left', textTransform: 'none', bgcolor: '#fff', display: 'block', p: 1.25, borderRadius: '12px', borderColor: '#cfd8dc' }}
                  >
                    <div style={{ fontWeight: 700, lineHeight: 1.2 }}>{it.equipo}</div>
                    <div style={{ fontSize: '.78rem', color: '#1565c0' }}>Laboratorio: {lab}</div>
                    <div style={{ fontSize: '.75rem', color: '#555' }}>
                      {[it.tipo, it.ubicacion, it.columnadelocalizacion && `col. ${it.columnadelocalizacion}`].filter(Boolean).join(' · ')}
                    </div>
                    {hit.length > 0 && <Chip size="small" variant="outlined" sx={{ mt: 0.5, height: 'auto', fontSize: '.68rem', maxWidth: '100%', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.25 } }} label={`coincide en: ${hit.join(', ')}`} />}
                  </Button>
                ))}
              </div>
            )}
          </section>
        )}

        {textFilter && !loading && <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5 }}>Laboratorios ({filteredLabs.length})</Typography>}
        <div style={{
          marginTop: textFilter ? 0 : 12, display: 'grid', gap: 12, alignItems: 'stretch',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        }}>
          {laboratoryCards}
        </div>
      </main>

      {/* Cajón de búsqueda por código (no fijo): aparece cuando ya cargaron los datos */}
      {!loading && (
        <SidePanel
          open={panelOpen}
          onOpenChange={setPanelOpen}
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
      <Toaster />
    </div>
  );
}

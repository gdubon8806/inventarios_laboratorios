'use client'
import { useSearchParams } from 'next/navigation'
import Head from 'next/head';
import { useRouter } from 'next/router';

import useRole from '../hooks/useRole';
import { signOutSession } from '../authService';

import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import DownloadIcon from '@mui/icons-material/Download';
import { Toaster } from 'react-hot-toast';

import AppHeader from '../components/layout/AppHeader';
import LoadingScreen from '../components/ui/LoadingScreen';
import ItemsFilterer from '../components/itemsFilterer';
import SearchAppBar from '../components/searchBar';
import AddItemCard from '../components/addItemCard';
import StatsBox from '../components/StatsBox';
import RecordCard from '../components/RecordCard';

import { useEffect, useMemo, useState } from 'react';
import readItem from '../components/firebase/read-item';
import readLabById from '../components/firebase/read-lab-with-id';
import { readReportsByLab } from '../components/firebase/read-reports';
import exportToXLSX from '../components/exportData/export';
import { normalizeText } from '../lib/codes/normalize';
import { filterRecords, groupOpenReports } from '../lib/inventory/stats';
import { markLabDirty } from '../lib/cache/home-cache';

export default function Index() {
    const router = useRouter();
    const { user, role, loading: checkingAuth } = useRole();

    useEffect(() => {
        if (!checkingAuth && !user) router.replace('/'); // Redirige a index.js
    }, [checkingAuth, user]);

    if (checkingAuth) return <LoadingScreen text="Iniciando sesión…" />;
    if (user) return <InventoryPage role={role} user={user}></InventoryPage>
}

export function InventoryPage({ role, user }) {
    const [items, setItems] = useState([]);
    const [lab, setLab] = useState(null);
    const [reports, setReports] = useState([]);
    const [filters, setFilters] = useState([]);
    const [filter, setFilter] = useState('');
    const [loading, setLoading] = useState(true);

    const searchpParams = useSearchParams();
    const id = searchpParams.get("id");
    // ?item=<idRegistro> (y opcional &unit=<idUnidad>) abre el detalle del registro; lo usa el panel lateral / buscador por código
    const itemParam = searchpParams.get("item");
    const unitParam = searchpParams.get("unit");
    const idLab = id;
    const isAdmin = role === 'admin';

    const fetchItems = async () => {
        // useSearchParams puede devolver null en el primer render: no consultar sin id
        if (!idLab) return;
        try {
            const [res, labData, reps] = await Promise.all([
                readItem(idLab),
                // readLabById devuelve null si el laboratorio no existe o está dado de baja
                readLabById(idLab),
                readReportsByLab(idLab),
            ]);
            setItems(res);
            setLab(labData);
            setReports(reps);
            setLoading(false);
        } catch (error) {
            console.error(error.message);
            setLoading(false);
        }
    };

    const fetchReports = async () => {
        if (!idLab) return;
        setReports(await readReportsByLab(idLab));
    };

    useEffect(() => {
        fetchItems();
        // Al salir del laboratorio, la pantalla principal relee solo este laboratorio (no todos).
        return () => markLabDirty(id);
    }, [id]);

    const handleRefresh = () => {
        fetchItems();
    };

    const reportGroups = useMemo(() => groupOpenReports(reports), [reports]);
    const itemsToShow = useMemo(
        () => filterRecords(items, { text: filter, tipos: filters }, normalizeText),
        [items, filter, filters]
    );
    const buscando = filter.trim() !== '' || filters.length > 0;

    let itemCards;
    if (loading) {
        itemCards = <LoadingScreen inline text="Cargando registros…" />;
    } else if (!lab) {
        itemCards = <Typography sx={{ gridColumn: '1 / -1', textAlign: 'center', p: 3 }}>El laboratorio no existe o fue dado de baja.</Typography>;
    } else if (items.length == 0) {
        itemCards = <Typography sx={{ gridColumn: '1 / -1', textAlign: 'center', p: 3 }}>No hay registros de ítems en este laboratorio.</Typography>;
    } else if (itemsToShow.length == 0) {
        itemCards = <Typography sx={{ gridColumn: '1 / -1', textAlign: 'center', p: 3 }}>Ningún registro coincide con la búsqueda.</Typography>;
    } else {
        itemCards = itemsToShow.map(item =>
            <RecordCard
                key={item.id}
                data={item}
                items={items}
                setItems={setItems}
                handleRefresh={handleRefresh}
                role={role}
                user={user}
                idLab={idLab}
                labName={lab?.name ?? ''}
                reports={reportGroups.get(item.id)?.reports ?? []}
                onReportsChanged={fetchReports}
                autoOpen={itemParam === item.id}
                highlightUnitId={itemParam === item.id ? unitParam : null}
            />);
    }
    return (
        <div style={{ minHeight: '100vh', background: '#F8FAFD' }}>
            <Head>
                <title>Inventarios</title>
            </Head>

            {/* Encabezado fijo: título, nombre del laboratorio y botones (invitado: solo Atrás y Cerrar sesión) */}
            <AppHeader subtitle={lab?.name ?? ''} backHref="/" onLogout={signOutSession} showLabels={!isAdmin}>
                {isAdmin && (
                    <>
                        <AddItemCard setItems={setItems} idLab={idLab} onCreated={handleRefresh} />
                        <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={() => exportToXLSX(idLab)}>Exportar</Button>
                    </>
                )}
            </AppHeader>

            {!loading && lab && <StatsBox items={items} reports={reports} isAdmin={isAdmin} />}

            {/* Búsqueda dentro de este laboratorio */}
            <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0.6rem 0.75rem 0' }}>
                <div className="fila-busqueda">
                    <div className="fila-busqueda__texto">
                        <SearchAppBar setFilter={setFilter} placeholder="Buscar en este laboratorio" />
                    </div>
                    <div className="fila-busqueda__filtro">
                        <ItemsFilterer filters={filters} setFilters={setFilters} />
                    </div>
                </div>
                <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.75, px: 0.5 }}>
                    La búsqueda se hace solo dentro de este laboratorio.
                    {!loading && items.length > 0 && <> {buscando ? `${itemsToShow.length} de ${items.length}` : items.length} registros.</>}
                </Typography>
            </div>

            <div style={{
                maxWidth: 1400, margin: '0 auto', padding: '0.6rem 0.75rem 1.5rem', display: 'grid', gap: 12,
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', alignItems: 'stretch',
            }}>
                {itemCards}
            </div>
            <Toaster />
        </div>
    )
}

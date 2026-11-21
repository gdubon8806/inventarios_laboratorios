'use client'
import Link from "next/link"
import { useSearchParams } from 'next/navigation'
import Head from 'next/head';
import { useRouter } from 'next/router';

// import { useUser } from '@auth0/nextjs-auth0/client';
import useRole from '../hooks/useRole';
import { signOutSession } from '../authService';


// import NavBar from '../components/profileStuff/NavBar';

import Modal from '@mui/material/Modal';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';

import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import ItemsFilterer from '../components/itemsFilterer';
import { Toaster } from 'react-hot-toast';

import AddItemCard from "../components/addItemCard";
import OptionsItemCard from "../components/optionsItemCard";
import StatsBox from '../components/StatsBox';
import UnitsTable from '../components/UnitsTable';
import ReportModal from '../components/ReportModal';
import ReportsList from '../components/ReportsList';
import PrintLabelsDialog from '../components/labels/PrintLabelsDialog';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CommentIcon from '@mui/icons-material/Comment';
import DownloadIcon from '@mui/icons-material/Download';

import AddItemCommentCard from "../components/ItemComment";
import { EditItemCommentCard } from "../components/ItemComment";
import { DeleteItemCommentCard } from "../components/ItemComment";

import InventoryStyles from '../styles/Inventory.module.css';
import HomeStyles from '../styles/Home.module.css';
import FormStyles from '../styles/Form.module.css';

import { useEffect, useMemo, useRef, useState } from "react";
import SearchAppBar from "../components/searchBar";
import readItem from "../components/firebase/read-item";
import readLabById from "../components/firebase/read-lab-with-id";
import readItemCommentsById from "../components/firebase/readItemComments-with-id";
import { readReportsByLab } from "../components/firebase/read-reports";
import { markPrinted } from "../components/firebase/manage-units";
import exportToXLSX from '../components/exportData/export';
import { normalizeText } from '../lib/codes/normalize';
import { codeStripeColor, filterRecords, groupOpenReports, reportedLabel } from '../lib/inventory/stats';
import { tieneUnidades } from '../lib/constants/tipos';
import { diasParaVencer, valorAFechaInput } from '../lib/validation/vencimiento';

const ESTADO_LABEL = { bueno: 'Bueno', malo: 'Malo', reparacion: 'En reparación' };

export default function Index() {
    const router = useRouter();
    const { user, role, loading: checkingAuth } = useRole();

    useEffect(() => {
        if (!checkingAuth && !user) router.replace('/'); // Redirige a index.js
    }, [checkingAuth, user]);

    if (checkingAuth) return <div>Cargando...</div>;
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
    }, [id]);

    const handleRefresh = () => {
        fetchItems();
    };

    const reportGroups = useMemo(() => groupOpenReports(reports), [reports]);
    const itemsToShow = useMemo(
        () => filterRecords(items, { text: filter, tipos: filters }, normalizeText),
        [items, filter, filters]
    );

    let itemCards;
    if (loading) {
        itemCards = 'Cargando items...';
    } else if (!lab) {
        itemCards = 'El laboratorio no existe o fue dado de baja.';
    } else if (items.length == 0) {
        itemCards = 'No hay registros de ítems en este laboratorio.';
    } else if (itemsToShow.length == 0) {
        itemCards = 'Ningún registro coincide con la búsqueda.';
    } else {
        itemCards = itemsToShow.map(item =>
            <Item
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
        <div>
            <Head>
                <title>Inventarios</title>
                <link
                    rel="stylesheet"
                    href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css"
                    integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T"
                    crossOrigin="anonymous"
                />
                {/* <link rel="stylesheet" href="https://cdn.auth0.com/js/auth0-samples-theme/1.0/css/auth0-theme.min.css" /> */}
            </Head>
            <div className={HomeStyles.fixedContainer}>

                <HeaderBar />
                <InventoryControls setItems={setItems} idLab={idLab} lab={lab?.name ?? ''} setFilters={setFilters} role={role} onCreated={handleRefresh} />
            </div>
            <div>
                <h2 className={InventoryStyles.subheader}>{lab?.name ?? ''}</h2>
            </div>
            {!loading && lab && <StatsBox items={items} reports={reports} isAdmin={isAdmin} />}
            <div className={InventoryStyles.itemsFiltererContainer}>
                <SearchAppBar setFilter={setFilter} />
                <ItemsFilterer filters={filters} setFilters={setFilters} />
            </div>
            <div className={InventoryStyles.itemsContainer}>
                {itemCards}
            </div>
            <Toaster />

        </div>
    )
}

export function HeaderBar() {
    return (
        <header>
            <div className={HomeStyles.headerBar}>
                {/* <Image src='/img/ceutec_logo.png' width='150' height='80' alt='Logo de CEUTEC'></Image> */}
                <div className={HomeStyles.gridInsideHeaderBar}>
                    <h1>Inventario de laboratorios</h1>
                </div>
                <Button style={{ paddingRight: "1rem" }} onClick={signOutSession}>Cerrar Sesión</Button>
                {/* <NavBar /> */}
            </div>
        </header>
    )
}

function InventoryControls({ setItems, idLab, lab, setFilters, role, onCreated }) {
    return (
        <div className={InventoryStyles.InventoryControls}>
            <div className={InventoryStyles.flex}>
                <Link href="/" className={InventoryStyles.beforeIcon}>
                    <Button className={InventoryStyles.backBTN} variant="contained" startIcon={<ArrowBackIcon />}>
                    </Button>
                </Link>
                <div className={InventoryStyles.flex}>
                    {role === 'admin' && (
                        <>
                            <div className="addItemBtnContainer">
                                <AddItemCard setItems={setItems} idLab={idLab} onCreated={onCreated} />
                            </div>
                            <div>
                                <Button startIcon={<DownloadIcon />}
                                    className={InventoryStyles.downloadBTN} variant="contained" onClick={() => exportToXLSX(idLab)}>
                                    Exportar
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

function Item({ data, items, setItems, handleRefresh, role, user, idLab, labName, reports, onReportsChanged, autoOpen, highlightUnitId }) {
    const isAdmin = role === 'admin';
    const [reportOpen, setReportOpen] = useState(false);
    const cardRef = useRef(null);
    const stripe = isAdmin ? codeStripeColor(data.estadoCodigo) : null;
    const reportCount = new Set(reports.filter((r) => r.unidadId).map((r) => r.unidadId)).size + (reports.some((r) => !r.unidadId) ? 1 : 0);
    const reportText = reportedLabel(data, reportCount);

    useEffect(() => {
        if (autoOpen && cardRef.current) cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [autoOpen]);

    return (
        <Card
            ref={cardRef}
            sx={{
                width: 300,
                borderLeft: stripe ? `8px solid ${stripe}` : undefined,
                outline: autoOpen ? '3px solid #1976d2' : undefined,
            }}
        >
            <CardMedia
                component="img"
                alt="Ilustración del ítem"
                height="140"
                image={data.imgurl}
                className={InventoryStyles.cardmediaOverride}
            />
            <CardContent>
                <ItemDetailsCard
                    details={data} role={role} user={user} idLab={idLab} labName={labName} reports={reports}
                    onChanged={handleRefresh} onReportsChanged={onReportsChanged} defaultOpen={autoOpen} highlightUnitId={highlightUnitId}
                />
                <br></br>
                <div className={InventoryStyles.extras}>
                    <Typography variant="body2" color="text.secondary">
                        {data.marca == "" ? "Sin marca" : "Marca: " + data.marca}
                    </Typography>
                    <Chip color="primary" variant="outlined" label={(!data.tipo ? "Sin tipo" : "Tipo: " + data.tipo)} />
                    <Chip color="primary" variant="outlined" label={(data.cantidad === "" || data.cantidad === undefined || data.cantidad === null ? "Cantidad: 0" :
                        "Cantidad: " + data.cantidad)} />
                    {reportText && <Chip color="error" label={reportText} />}
                    {data.estado === 'malo' && <Chip color="error" variant="outlined" label="Estado: Malo" />}
                    {data.estado === 'reparacion' && <Chip color="warning" variant="outlined" label="En reparación" />}
                    {data.codigo && <Chip variant="outlined" label={data.codigo} />}
                    {isAdmin && data.estadoCodigo === 'pendienteImprimir' && <Chip color="error" label="Pendiente imprimir" />}
                    {isAdmin && (!data.estadoCodigo || data.estadoCodigo === 'sinCodigo') && !data.requiereValidacion && <Chip sx={{ bgcolor: '#ff9800', color: '#fff' }} label="Código sin generar" />}
                    {isAdmin && data.requiereValidacion && <Chip color="warning" label={`⚠ Validar: ${data.motivoValidacion ?? 'datos incongruentes'}`} />}
                </div>
            </CardContent>
            <CardActions>
                {isAdmin && (
                    <OptionsItemCard
                        item={data}
                        items={items}
                        setItems={setItems}
                        handleRefresh={handleRefresh}
                        role={role}
                        user={user}
                    />
                )}
                <Button size="small" color="error" onClick={() => setReportOpen(true)}>Reportar</Button>
            </CardActions>
            <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} registro={data} unidad={null} idLab={idLab} user={user} onCreated={onReportsChanged} />
        </Card>
    );
}
function setImg(details) {
    if (details.imgurl) {
        return <CardMedia
            component="img"
            alt=""
            height="230"
            width="333"
            image={details.imgurl}
        />
    } else {
        return <p className='text-center text-gray-500'>Sin imagen</p>
    }
}


function ItemDetailsCard({ details, role, user, idLab, labName, reports, onChanged, onReportsChanged, defaultOpen, highlightUnitId }) {
    const style = {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '90vw',
        height: '80vh',
        bgcolor: 'background.paper',
        boxShadow: 24,
        p: 4,
        overflowY: 'auto',
    };
    const isAdmin = role === 'admin';
    const conUnidades = tieneUnidades(details.tipo);
    //para abrir detalles de item
    const [open, setOpen] = useState(!!defaultOpen);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);
    useEffect(() => { if (defaultOpen) setOpen(true); }, [defaultOpen]);
    const [reportOpen, setReportOpen] = useState(false);
    const [printLabels, setPrintLabels] = useState(null);

    //para modal de comentarios
    const [openComments, setOpenComments] = useState(false);
    const handleOpenComments = () => {
        fetchItemComments();
        setOpenComments(true);
    }
    const handleCloseComments = () => setOpenComments(false);

    const linkItem = {
        fontSize: '1.2rem',
        color: 'black',
        letterSpacing: '1.2px',
        textDecoration: 'none',
        textTransform: 'capitalize',
        paddingLeft: '0',
    }

    //manejar state de comentarios
    const [itemComentarios, setItemComentarios] = useState([]);
    const [loading, setLoading] = useState(true);

    let itemCommentsCards;

    const fetchItemComments = async () => {
        try {
            await readItemCommentsById(details.id).then((res) => {
                // console.log('Se extrayeron de la db los labs exitosamente.')
                setItemComentarios(res);
                setLoading(false);
            })
        } catch (error) {
            console.error('Error al extraer los comentarios de la db.')
        }
    };

    const handleRefresh = () => {
        fetchItemComments();
    };

    if (loading) {
        itemCommentsCards = 'Cargando comentarios...';
    } else {
        if (itemComentarios.length == 0) {
            itemCommentsCards = 'No hay registros de comentarios.';
        } else {
            itemCommentsCards = itemComentarios.map(itemComment =>
                <ItemCommentCard
                    key={itemComment.id}
                    itemComment={itemComment}
                    handleRefresh={handleRefresh}
                    role={role} // <-- agrega esto
                />
            );
        }

    }

    // Etiqueta del insumo (1 código por registro). Las unidades se imprimen desde su tabla.
    const imprimirInsumo = () => {
        if (!details.codigo) return;
        setPrintLabels([{
            id: details.id, codigo: details.codigo, nombre: details.equipo, lab: labName ?? '',
            tipo: details.tipo, estadoCodigo: details.estadoCodigo ?? 'sinCodigo',
        }]);
    };
    const onPrinted = async () => {
        const r = await markPrinted([{ recordId: details.id }]);
        if (r.status !== 'error') onChanged?.();
    };

    const dias = diasParaVencer(details.fechaVencimiento);
    const observaciones = Array.isArray(details.observaciones) ? details.observaciones.join('\n') : (details.observaciones ?? '');

    return (
        <div>
            {/* <div className={InventoryStyles.ItemLink}> */}
            <div className={InventoryStyles.detailsContainer}>
                <Button style={linkItem} onClick={handleOpen}>{details.equipo}</Button>
                {isAdmin && (
                    <Button>
                        <CommentIcon onClick={handleOpenComments} />
                    </Button>
                )}
            </div>
            <Modal
                open={openComments}
                onClose={handleCloseComments}
                aria-labelledby="modal-modal-title"
                aria-describedby="modal-modal-description"
            >
                {/*Scope para manejar el state de los comentarios*/}

                <Box sx={style}>
                    <div className={FormStyles.headerForm}>
                        <Button startIcon={<ArrowBackIcon />} className={FormStyles.backBtn} onClick={handleCloseComments}>Atrás</Button>
                        <div className={InventoryStyles.flex}>
                            <h1>Comentarios</h1>
                            {isAdmin && (
                                <AddItemCommentCard idItem={details.id} handleRefresh={handleRefresh} />
                            )}
                        </div>
                    </div>
                    <div className={InventoryStyles.commentsContainer}>
                        {itemCommentsCards}
                    </div>

                </Box>

            </Modal>

            <Modal
                open={open}
                onClose={handleClose}
                aria-labelledby="modal-modal-title"
                aria-describedby="modal-modal-description"
            >

                <Box sx={style}>
                    <div className={FormStyles.headerForm}>
                        <Button startIcon={<ArrowBackIcon />} className={FormStyles.backBtn} onClick={handleClose}>Atrás</Button>
                        <h2>Información de ítem</h2>
                    </div>
                    {isAdmin && details.requiereValidacion && (
                        <Alert severity="warning" sx={{ mb: 2 }}>Datos incongruentes: {details.motivoValidacion ?? 'revisar tipo y cantidad'}. Corrígelos en Opciones → Editar.</Alert>
                    )}
                    {setImg(details)}
                    <br></br>
                    <div className={FormStyles.form}>
                        {/* <Image src={details.imgurl} className={InventoryStyles.ImageItemDetails} width={333} height={230}></Image> */}
                        {details.codigo && (<>
                            <label>Código:</label>
                            <input type="text" name="codigo_item" value={details.codigo} readOnly />
                        </>)}
                        <label>Equipo:</label>
                        <input type="text" name="nombre_item" placeholder="Sin datos" value={details.equipo ?? ''} readOnly />
                        <label>Marca:</label>
                        <input type="text" name="marca_item" placeholder="Sin datos" value={details.marca ?? ''} readOnly />
                        <label>Ubicación:</label>
                        <input type="text" name="ubicacion_item" placeholder="Sin datos" value={details.ubicacion ?? ''} readOnly />
                        <label>Modelo:</label>
                        <input type="text" name="modelo_item" placeholder="Sin datos" value={details.modelo ?? ''} readOnly />
                        <label>Columna de localización:</label>
                        <input type="text" name="localizacion_item" placeholder="Sin datos" value={details.columnadelocalizacion ?? ''} readOnly />
                        <label>Tipo:</label>
                        <input type="text" name="tipo_item" placeholder="Sin datos" value={details.tipo ?? ''} readOnly />
                        <label>Cantidad:</label>
                        <input type="text" name="cantidad_item" placeholder="Sin datos" value={details.cantidad ?? ''} readOnly />
                        {!conUnidades && details.tipo === 'Suministro' && (<>
                            <label>Número de serie:</label>
                            <input type="text" name="serie_item" placeholder="Sin datos" value={details.numeroSerie ?? ''} readOnly />
                            <label>Código Fundaempresa:</label>
                            <input type="text" name="fundaempresa_item" placeholder="Sin datos" value={details.codigoFundaempresa ?? ''} readOnly />
                            <label>Estado:</label>
                            <input type="text" name="estado_item" value={ESTADO_LABEL[details.estado ?? 'bueno'] ?? details.estado} readOnly />
                        </>)}
                        {isAdmin && details.tieneVencimiento && (<>
                            <label>Fecha de vencimiento:</label>
                            <input type="text" name="vencimiento_item" readOnly
                                value={`${valorAFechaInput(details.fechaVencimiento) || 'Sin fecha'}${dias !== null ? (dias < 0 ? ' (vencido)' : dias <= 30 ? ` (vence en ${dias} días)` : '') : ''}`} />
                        </>)}
                        <label>Observaciones{conUnidades ? ' generales' : ''}:</label>
                        <input type="text" name="observaciones_item" placeholder="Sin datos" value={observaciones} readOnly />
                        {isAdmin && details.ultimaModificacion?.toDate && (<>
                            <label>Última modificación:</label>
                            <input type="text" name="modificacion_item" readOnly
                                value={`${details.ultimaModificacion.toDate().toLocaleString('es-HN')}${details.ultimaModificacionPor?.email ? ` · ${details.ultimaModificacionPor.email}` : ''}`} />
                        </>)}
                    </div >

                    {isAdmin && !conUnidades && details.codigo && (
                        <Button variant="outlined" onClick={imprimirInsumo} sx={{ mb: 2 }}>Imprimir etiqueta ({details.codigo})</Button>
                    )}

                    {isAdmin && conUnidades && (
                        <UnitsTable
                            registro={details} idLab={idLab} labName={labName} user={user} reports={reports}
                            onChanged={() => { onChanged?.(); }} highlightUnitId={highlightUnitId}
                        />
                    )}

                    <ReportsList
                        registro={details} reports={reports} isAdmin={isAdmin} user={user}
                        onChanged={() => { onReportsChanged?.(); onChanged?.(); }} onReport={() => setReportOpen(true)}
                    />
                    <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} registro={details} unidad={null} idLab={idLab} user={user} onCreated={onReportsChanged} />
                    <PrintLabelsDialog
                        open={!!printLabels} onClose={() => setPrintLabels(null)} labName={labName}
                        labels={printLabels ?? []} onConfirmed={onPrinted}
                    />
                </Box>
            </Modal>
        </div>
    )
}

function ItemCommentCard({ itemComment, handleRefresh, role }) {
    const date = itemComment.time ? itemComment.time.toDate() : null;

    return (
        <>
            <div className={InventoryStyles.flex}>
                <div>
                    <div className={InventoryStyles.commentHeader}>
                        <h3 className={InventoryStyles.commentTitle}><strong>{itemComment.title}</strong></h3>
                        <h3>{date ? date.toLocaleString('es-HN') : 'Fecha no disponible'}</h3>
                    </div>
                    <p>
                        {itemComment.description}
                    </p>
                </div>
                <div>
                    {role === 'admin' && (
                        <>
                            <EditItemCommentCard itemComment={itemComment} handleRefresh={handleRefresh} />
                            <DeleteItemCommentCard itemComment={itemComment} handleRefresh={handleRefresh} />
                        </>
                    )}
                </div>
            </div>
        </>
    )
}

import Link from "next/link"
import { useSearchParams } from 'next/navigation'
import Image from 'next/image';
import Head from 'next/head';

import { useUser } from '@auth0/nextjs-auth0/client';

import NavBar from '../components/profileStuff/NavBar';

import Modal from '@mui/material/Modal';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';

import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import ItemsFilterer from '../components/itemsFilterer';
import { Toaster } from 'react-hot-toast';

import AddItemCard from "../components/addItemCard";
import OptionsItemCard from "../components/optionsItemCard";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CommentIcon from '@mui/icons-material/Comment';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';

import AddItemCommentCard from "../components/ItemComment";
import { EditItemCommentCard } from "../components/ItemComment";
import { DeleteItemCommentCard } from "../components/ItemComment";

import InventoryStyles from '../styles/Inventory.module.css';
import HomeStyles from '../styles/Home.module.css';
import FormStyles from '../styles/Form.module.css';

import { useEffect, useState } from "react";
import SearchAppBar from "../components/searchBar";
import readItem from "../components/firebaseStuff/read-item";
import readLabById from "../components/firebaseStuff/read-lab-with-id";
import readItemCommentsById from "../components/firebaseStuff/readItemComments-with-id";
import exportToXLSX from '../components/exportData/export';

export default function Index() {
    const { user, error, isLoading } = useUser();

    if (isLoading) return <div>Cargando...</div>;
    if (error) return <div>{error.message}</div>;

    if (user) {
        return (
            <div>
                <InventoryPage></InventoryPage>
            </div>
        );
    }

    return (
        <div className={FormStyles.loginContainerWrapper}>
            <div className={FormStyles.loginContainer}>
                <Image
                    src='/img/ceutec_logo.png'
                    width={180}
                    height={180}
                    alt='Logo de CEUTEC'></Image>
                <h1>
                    ¡Bienvenido!
                </h1>
                <h2>Estás en Inventarios de Laboratorios</h2>
                <Button variant="contained" href='/api/auth/login'>Iniciar Sesión</Button>
            </div>
        </div>
    )
}

export function InventoryPage() {
    const [items, setItems] = useState([]);
    const [lab, setLab] = useState("");
    const [filters, setFilters] = useState([]);
    const [filter, setFilter] = useState('');
    const [loading, setLoading] = useState(true);

    const searchpParams = useSearchParams();
    let id = searchpParams.get("id");
    let itemCards;
    let idLab = id;

    const fetchItems = async () => {
        try {
            const response = await readItem(idLab).then((res) => {
                setItems(res);
                setLoading(false);
            })
            const readLabRes = await readLabById(idLab).then((res) => {
                setLab(res.name);
            });

        } catch (error) {
            console.error(error.message);
        }
    };


    useEffect(() => {
        fetchItems();
    }, [id]);

    const handleRefresh = () => {
        fetchItems();
    };


    if (loading) {
        itemCards = 'Cargando items...';
    } else {

        if (items.length == 0) {
            itemCards = 'No hay registros de items en este laboratorio.';
        } else {

            let itemsToShow;
            if (filters.length > 0) {
                itemsToShow = items.filter((item) => {
                    let ToShow = false;
                    for (const currentFilter of filters) {
                        if (currentFilter == item.tipo) {
                            ToShow = true;
                            break;
                        }
                    }
                    return ToShow;
                }).filter((item) => {
                    if ((item.equipo.toUpperCase()).includes(filter.toUpperCase())) {
                        return item;
                    }
                })

                // let filteredItems = itemsToShow.filter((item) => {
                //     if ((item.equipo.toUpperCase()).includes(filter.toUpperCase())) {
                //         return item;
                //     }
                // })
                // itemsToShow = filteredItems;
            } else {
                itemsToShow = items.filter((item) => {
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
                    //transforma el nombre del equipo tambien de la db sin caracteres especiales
                    let newNombreEquipo = "";
                    item.equipo = item.equipo.toLowerCase();
                    for (const letter of item.equipo) { //termómetro
                        if (letter == "á" ||
                            letter == "é" ||
                            letter == "í" ||
                            letter == "ó" ||
                            letter == "ú" ||
                            letter == "ü" ||
                            letter == "ñ") {
                            newNombreEquipo += vowels[letter];
                        } else {
                            newNombreEquipo += letter;
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

                    if ((newNombreEquipo.toUpperCase()).includes(newFilter.toUpperCase())) {
                        return item;
                    }
                });
            }

            itemCards = itemsToShow.map(item => <Item key={item.id} data={item} items={items} setItems={setItems} handleRefresh={handleRefresh}></Item>);
        }
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
                <InventoryControls handleRefresh={handleRefresh} idLab={idLab} lab={lab} setFilters={setFilters} />
            </div>
            <div>
                <h2 className={InventoryStyles.subheader}>{lab}</h2>
            </div>
            <div className={InventoryStyles.itemsFiltererContainer}>
                <SearchAppBar setFilter={setFilter} />
                <ItemsFilterer setFilters={setFilters} />
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
                <NavBar />
            </div>
        </header>
    )
}

function InventoryControls({ handleRefresh, idLab, lab, setFilters }) {
    // console.log(idLab);
    const { user } = useUser();
    if (user.email !== 'coordinacionlaboratorios@gmail.com') {
        return (
            <div className={InventoryStyles.InventoryControls}>
                <div>
                    <Link href="/" className={InventoryStyles.beforeIcon}>
                        <Button className={`${InventoryStyles.backBTN} responsiveBackBTN`} variant="contained" startIcon={<ArrowBackIcon />}>
                            Atrás
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className={InventoryStyles.InventoryControls}>
            <div>
                <Link href="/" className={InventoryStyles.beforeIcon}>
                    <Button className={`${InventoryStyles.backBTN} responsiveBackBTN`} variant="contained" startIcon={<ArrowBackIcon />}>

                    </Button>
                </Link>
            </div>
            <div className={InventoryStyles.flex}>
                <div className="addItemBtnContainer">
                    <AddItemCard handleRefresh={handleRefresh} idLab={idLab} />
                </div>
                <div>
                    <Button startIcon={<DownloadIcon />}
                        className={InventoryStyles.downloadBTN} variant="contained" onClick={() => exportToXLSX(idLab)}>
                        Exportar</Button>
                </div>
            </div>


        </div>
    )
}

function Item({ data, items, setItems, handleRefresh }) {
    return (
        <Card sx={{ maxWidth: 345 }}>
            <CardMedia
                component="img"
                alt=""
                height="140"
                image={data.imgurl}
                className={InventoryStyles.cardmediaOverride}
            />
            <CardContent>
                <ItemDetailsCard details={data} />
                <br></br>
                <div className={InventoryStyles.extras}>
                    <Typography variant="body2" color="text.secondary">
                        {data.marca == "" ? "Sin marca" : "Marca: " + data.marca}
                    </Typography>
                    <Chip color="primary" variant="outlined" label={(data.tipo == "" ? "Sin tipo" : "Tipo: " + data.tipo)} />
                    <Chip color="primary" variant="outlined" label={(data.cantidad == "" ? "Cantidad: 0" :
                        "Cantidad: " + data.cantidad)} />
                </div>
            </CardContent>
            <CardActions>
                <OptionsItemCard item={data} items={items} setItems={setItems} handleRefresh={handleRefresh} />
            </CardActions>
        </Card>
    );
}
function setImg(details) {
    if (details.imgurl !== '') {
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


function ItemDetailsCard({ details }) {
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
    //para abrir detalles de item
    const [open, setOpen] = useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);


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

    // useEffect(() => {
    //     fetchItemComments();
    // }, []);

    const handleRefresh = () => {
        fetchItemComments();
    };

    if (loading) {
        itemCommentsCards = 'Cargando comentarios...';
    } else {
        if (itemComentarios.length == 0) {
            itemCommentsCards = 'No hay registros de comentarios.';
        } else {
            itemCommentsCards = itemComentarios.map(itemComment => <ItemCommentCard key={itemComment.id} itemComment={itemComment} handleRefresh={handleRefresh}> </ItemCommentCard>)
        }

    }

    function selectComment() {

    }

    return (
        <div>
            {/* <div className={InventoryStyles.ItemLink}> */}
            <div className={InventoryStyles.detailsContainer}>
                <Button style={linkItem} onClick={handleOpen}>{details.equipo}</Button>
                <Button><CommentIcon onClick={handleOpenComments}></CommentIcon></Button>
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
                            <AddItemCommentCard idItem={details.id} handleRefresh={handleRefresh}></AddItemCommentCard>
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
                    {setImg(details)}
                    <br></br>
                    <div className={FormStyles.form}>
                        {/* <Image src={details.imgurl} className={InventoryStyles.ImageItemDetails} width={333} height={230}></Image> */}
                        <label>Equipo:</label>
                        <input type="text" name="nombre_item" placeholder="Sin datos" value={details.equipo} readOnly />
                        <label>Marca:</label>
                        <input type="text" name="marca_item" placeholder="Sin datos" value={details.marca} readOnly />
                        <label>Ubicación:</label>
                        <input type="text" name="ubicacion_item" placeholder="Sin datos" value={details.ubicacion} readOnly />
                        <label>Modelo:</label>
                        <input type="text" name="modelo_item" placeholder="Sin datos" value={details.modelo} readOnly />
                        <label>Columna de localización:</label>
                        <input type="text" name="localizacion_item" placeholder="Sin datos" value={details.columnadelocalizacion} readOnly />
                        <label>Tipo:</label>
                        <input type="text" name="tipo_item" placeholder="Sin datos" value={details.tipo} readOnly />
                        <label>Cantidad:</label>
                        <input type="text" name="cantidad_item" placeholder="Sin datos" value={details.cantidad} readOnly />
                        <label>Observaciones:</label>
                        <input type="text" name="observaciones_item" placeholder="Sin datos" value={details.observaciones} readOnly />
                    </div >
                </Box>
            </Modal>
        </div>
    )
}

function ItemCommentCard({ itemComment, handleRefresh }) {
    const date = itemComment.time ? itemComment.time.toDate() : null;

    const { user } = useUser();
    if (user.email !== 'coordinacionlaboratorios@gmail.com') {
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
                </div>
            </>
        );
    }

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
                    <EditItemCommentCard itemComment={itemComment} handleRefresh={handleRefresh}></EditItemCommentCard>
                    <DeleteItemCommentCard itemComment={itemComment} handleRefresh={handleRefresh} ></DeleteItemCommentCard>
                </div>

            </div>
        </>
    )
}
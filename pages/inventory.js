import Link from "next/link"
import { useSearchParams } from 'next/navigation'
import Image from 'next/image';
import HomeStyles from '../styles/Home.module.css';

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

import InventoryStyles from '../styles/Inventory.module.css';
import FormStyles from '../styles/Form.module.css';

import { useEffect, useState } from "react";
import readItem from "../components/firebaseStuff/read-item";

export default function inventoryPage() {
    const [items, setItems] = useState([]);
    const [lab, setLab] = useState("");
    const [filters, setFilters] = useState([]);
    const [loading, setLoading] = useState(true);

    const searchpParams = useSearchParams();
    let id = searchpParams.get("id");
    let itemCards;
    let id_lab = id;

    const fetchItems = async () => {
        try {
            const response = await readItem(id_lab).then((res) => {
                setItems(res);
                setLoading(false);
            })

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
                })
            } else {
                itemsToShow = items;
            }

            itemCards = itemsToShow.map(item => <Item key={item.id} data={item} items={items} setItems={setItems} handleRefresh={handleRefresh}></Item>);
        }
    }

    function addItem() {

    }

    return (
        <div>
            <HeaderBar />
            <h2 className={InventoryStyles.subheader}>{lab}</h2>
            <InventoryControls handleRefresh={handleRefresh} id_lab={id_lab} name={lab} addItem={addItem} setFilters={setFilters} />
            <div className={InventoryStyles.itemsFiltererContainer}>
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
            <div className={InventoryStyles.headerBar}>
                {/* <Image src='/img/ceutec_logo.png' width='150' height='80' alt='Logo de CEUTEC'></Image> */}
                <h1>Inventario de laboratorios</h1>
            </div>
        </header>
    )
}

function InventoryControls({ handleRefresh, id_lab, name, addItem, setFilters }) {
    return (
        <div className={InventoryStyles.InventoryControls}>
            <div>
                <Link href="/" className={InventoryStyles.beforeIcon}>
                    <Button className="backBTN" variant="contained" startIcon={<ArrowBackIcon />}>Atrás</Button>
                </Link>
            </div>
            <div className="addItemBtnContainer">
                <AddItemCard handleRefresh={handleRefresh} id_lab={id_lab} handleAdd={addItem} />
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
            />
            <CardContent>
                <ItemDetailsCard details={data} />
                <br></br>
                <div className={InventoryStyles.extras}>
                    <Typography variant="body2" color="text.secondary">
                        {data.marca}
                    </Typography>
                    <Chip color="primary" variant="outlined" label={data.tipo} />
                    <Chip color="primary" variant="outlined" label={"Cantidad: " + data.cantidad} />

                </div>
            </CardContent>
            <CardActions>
                <OptionsItemCard item={data} items={items} setItems={setItems} handleRefresh={handleRefresh} />
            </CardActions>
        </Card>
    );
}
function setImg(imgurl) {
    if (imgurl !== '') {
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
    const [open, setOpen] = useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);
    const linkItem = {
        fontSize: '1.2rem',
        color: 'black',
        letterSpacing: '1.2px',
        textDecoration: 'none',
        textTransform: 'capitalize',
        paddingLeft: '0',
    }

    return (
        <div>
            {/* <div className={InventoryStyles.ItemLink}> */}
            <Button style={linkItem} onClick={handleOpen}>{details.equipo}</Button>
            {/* </div> */}
            <Modal
                open={open}
                onClose={handleClose}
                aria-labelledby="modal-modal-title"
                aria-describedby="modal-modal-description"
            >

                <Box sx={style}>
                    <div className={FormStyles.headerForm}>
                        <Button startIcon={<ArrowBackIcon />} className={FormStyles.backBtn} onClick={handleClose}>Atrás</Button>
                        <h2>Detalles de ítem</h2>
                    </div>
                    {setImg(details.imgurl)}
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
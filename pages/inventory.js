import Link from "next/link"
import { useSearchParams } from 'next/navigation'
import { HeaderBar } from './index';
import Image from 'next/image';

import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import ItemsFilterer from '../components/itemsFilterer';


import AddItemCard from "../components/addItemCard";
import OptionsItemCard from "../components/optionsItemCard";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import InventoryStyles from '../styles/Inventory.module.css';
import { useEffect, useState } from "react";

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

export default function inventoryPage() {
    const [items, setItems] = useState([]);
    const [lab, setLab] = useState("");
    const [filters, setFilters] = useState([]);

    const searchpParams = useSearchParams();
    let id = parseInt(searchpParams.get("id"));
    let itemCards;

    function addItem({
        equipo,
        marca,
        modelo,
        ubicacion,
        columnaDeLocalizacion,
        tipo,
        cantidad,
        img,
        observaciones
    }) {
        const newItem = {
            equipo,
            marca,
            modelo,
            ubicacion,
            columnaDeLocalizacion,
            tipo,
            cantidad,
            img,
            observaciones
        }
        setItems([...items, newItem]);
    }

    useEffect(() => {
        if (!isNaN(id)) {
            // Aquí puedes realizar otras operaciones que dependan de 'id'
            setItems(labs.get(id).items);
            setLab(labs.get(id).name)
        }
    }, [id]); // Ejecutar el efecto cuando 'id' cambie

    if (items.length == 0) {
        itemCards = 'No hay items registrados';
    } else {
        let itemsToShow;

        if (filters.length > 0) {
            itemsToShow = items.filter((item) => {
                let ToShow = false;
                for(const currentFilter of filters ) {
                    if(currentFilter == item.tipo) {
                        ToShow = true;
                        break;
                    }
                }
                return ToShow;
            })
        } else {
            itemsToShow = items;
        }
        console.log(itemsToShow);

        itemCards = itemsToShow.map(item => <Item data={item} items={items} setItems={setItems}></Item>);
    }

    return (
        <div>
            <HeaderBar />
            <h2 className={InventoryStyles.subheader}>{lab}</h2>
            <InventoryControls name={lab} addItem={addItem} setFilters = {setFilters} />
            <div className= {InventoryStyles.itemsFiltererContainer}>
                <ItemsFilterer setFilters = {setFilters} />
            </div>
            <div className={InventoryStyles.itemsContainer}>
                {itemCards}
            </div>
        
        </div>
    )
}

function InventoryControls({ name, addItem, setFilters }) {
    return (
        <div className={InventoryStyles.InventoryControls}>
            <div>
                <Link href="/" className={InventoryStyles.beforeIcon}>
                    <Button variant="contained" startIcon={<ArrowBackIcon />}>Atrás</Button>
                </Link>
            </div>
            <div>
                <AddItemCard handleAdd={addItem} />
            </div>

        </div>
    )
}

function Item({ data, items, setItems }) {
    const [show, setShow] = useState(false);

    function showItemsDetailsCard() {
        setShow(!show);
    }

    return (
        <Card sx={{ maxWidth: 345 }}>
            <CardMedia
                component="img"
                alt="Item de laboratorio"
                height="140"
                image={data.img}
            />
            <CardContent>
                <Typography className={InventoryStyles.ItemLink} onClick={showItemsDetailsCard} gutterBottom variant="p" component="div">
                    {data.equipo}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {data.marca}
                </Typography>
            </CardContent>
            <CardActions>
                <OptionsItemCard item={data} items={items} setItems={setItems} />
            </CardActions>
            <div className={`${!show ? InventoryStyles.hide : ''}`}>
                <ItemDetailsCard showItemsDetailsCard={showItemsDetailsCard} details={data} />
            </div>
        </Card>
    );
}

function ItemDetailsCard({ showItemsDetailsCard, details }) {

    return (
        <div className={InventoryStyles.itemDetailsCardWrapper}>
            <div className={InventoryStyles.itemDetailsCard}>
                <div>
                    <button className={InventoryStyles.btnC1} onClick={showItemsDetailsCard} >Cancel</button>
                    <h4 className={InventoryStyles.btnC1} >Detalles</h4>
                    <button className={InventoryStyles.btnC1} onClick={showItemsDetailsCard} >Hecho</button>
                </div>
                <div className={InventoryStyles.itemDetails}>
                    <Image src={details.img} className={InventoryStyles.ImageItemDetails} width={333} height={230}></Image>
                    <div>
                        <label>Equipo:</label>
                        <input type="text" name="nombre_item" placeholder="Sin datos" value={details.equipo} />
                    </div>
                    <div>
                        <label>Marca:</label>
                        <input type="text" name="marca_item" placeholder="Sin datos" value={details.marca} />
                    </div>
                    <div>
                        <label>Ubicación:</label>
                        <input type="text" name="ubicacion_item" placeholder="Sin datos" value={details.ubicacion} />
                    </div>
                    <div>
                        <label>Modelo:</label>
                        <input type="text" name="modelo_item" placeholder="Sin datos" value={details.modelo} />
                    </div>
                    <div>
                        <label>Columna de localización:</label>
                        <input type="text" name="localizacion_item" placeholder="Sin datos" value={details.columnaDeLocalizacion} />
                    </div>
                    <div>
                        <label>Tipo:</label>
                        <input type="text" name="tipo_item" placeholder="Sin datos" value={details.tipo} />
                    </div>
                    <div>
                        <label>Cantidad:</label>
                        <input type="text" name="cantidad_item" placeholder="Sin datos" value={details.cantidad} />
                    </div>

                </div>
            </div>
        </div >
    )
}
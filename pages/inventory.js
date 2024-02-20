import Link from "next/Link"
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import InventoryStyles from '../styles/Inventory.module.css';
import { useEffect, useState } from "react";

import labs from './db';

export default function inventoryPage() {
    const [items, setItems] = useState([]);
    const [lab, setLab] = useState("");
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
    itemCards = items.map(item => <Item data={item}></Item>);
    return (
        <div>
            <HeaderBar />
            <h2 className={InventoryStyles.subheader}>{lab}</h2>
            <InventoryControls name={lab} addItem={addItem} />
            <div className={InventoryStyles.itemsContainer}>
                {itemCards}
            </div>

        </div>
    )
}

function InventoryControls({ name, addItem }) {
    return (
        <div className={InventoryStyles.InventoryControls}>
            <div>
                <Link href="/" className={InventoryStyles.beforeIcon}>
                    <Button variant="contained" startIcon={<ArrowBackIcon />}>Atrás</Button>
                </Link>
            </div>
            <div>
                <ItemsFilterer />
            </div>
            <div>
                <AddItemCard handleAdd={addItem} />
            </div>

        </div>
    )
}

function Item({ data }) {
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
                <Button size="small">Opciones
                    {/* <span className='icon-dot-3'></span> */}
                </Button>

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
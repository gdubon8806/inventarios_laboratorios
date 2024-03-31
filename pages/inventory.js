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

export default function inventoryPage() {
    const [items, setItems] = useState([]);
    const [lab, setLab] = useState("");
    const [filters, setFilters] = useState([]);
    const [loading, setLoading] = useState(true);

    const searchpParams = useSearchParams();
    let id = parseInt(searchpParams.get("id"));
    let itemCards;
    let id_lab = id;

    const fetchItems = async () => {
        try {
            const response = await fetch('/api/read_items', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id
                })
            }); // Aquí debes poner la ruta correcta a tu API
            if (!response.ok) {
                throw new Error('Error al obtener datos: ' + response.statusText);
            }
            const data = await response.json();

            const fetchedItems = data.result.rows;
            setItems(fetchedItems)
            setLoading(false);
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
            <InventoryControls handleRefresh={handleRefresh} id_lab = {id_lab} name={lab} addItem={addItem} setFilters={setFilters} />
            <div className={InventoryStyles.itemsFiltererContainer}>
                <ItemsFilterer setFilters={setFilters} />
            </div>
            <div className={InventoryStyles.itemsContainer}>
                {itemCards}
            </div>

        </div>
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
                <AddItemCard handleRefresh={handleRefresh} id_lab= {id_lab} handleAdd={addItem} />
            </div>

        </div>
    )
}

function Item({ data, items, setItems, handleRefresh }) {
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
                image={data.imgurl}
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
                <OptionsItemCard item={data} items={items} setItems={setItems} handleRefresh={handleRefresh} />
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
                    {/* <Image src={details.imgurl} className={InventoryStyles.ImageItemDetails} width={333} height={230}></Image> */}
                    <CardMedia
                        component="img"
                        alt=""
                        height="230"
                        width="333"
                        image={details.imgurl}
                    />
                    <div>
                        <label>Equipo:</label>
                        <input type="text" name="nombre_item" placeholder="Sin datos" value={details.equipo} readOnly/>
                    </div>
                    <div>
                        <label>Marca:</label>
                        <input type="text" name="marca_item" placeholder="Sin datos" value={details.marca} readOnly />
                    </div>
                    <div>
                        <label>Ubicación:</label>
                        <input type="text" name="ubicacion_item" placeholder="Sin datos" value={details.ubicacion} readOnly/>
                    </div>
                    <div>
                        <label>Modelo:</label>
                        <input type="text" name="modelo_item" placeholder="Sin datos" value={details.modelo} readOnly/>
                    </div>
                    <div>
                        <label>Columna de localización:</label>
                        <input type="text" name="localizacion_item" placeholder="Sin datos" value={details.columnaDeLocalizacion}  readOnly/>
                    </div>
                    <div>
                        <label>Tipo:</label>
                        <input type="text" name="tipo_item" placeholder="Sin datos" value={details.tipo} readOnly/>
                    </div>
                    <div>
                        <label>Cantidad:</label>
                        <input type="text" name="cantidad_item" placeholder="Sin datos" value={details.cantidad}  readOnly/>
                    </div>
                </div>
            </div>
        </div >
    )
}
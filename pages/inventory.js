import Link from "next/Link"
import { useSearchParams } from 'next/navigation'
import { HeaderBar } from './index';
import Image from 'next/image';


import Fab from '@mui/material/Fab';
import AddIcon from '@mui/icons-material/Add';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';


import InventoryStyles from '../styles/Inventory.module.css';
import { useState } from "react";

export default function inventoryPage() {
    const searchpParams = useSearchParams();
    const id = searchpParams.get("id");

    //asumamos que hicimos una query a la db de todos los items que esten dentro de el inventario
    let items = [
        { equipo: "Programmable DC POWER Supply", marca: "EXTECH-Instruments", modelo: "382280", ubicacion: "Mesa de trabajo", columnaDeLocalizacion: "3/F2-1/E2-3/D2", tipo: "Equipo", cantidad: "7", real: "7", img: "/img/items/item1.jpg", observaciones: "Ninguna" },
        { equipo: "NI ELVIS ", marca: "EXTECH-Instruments", modelo: "382280", ubicacion: "Mesa de trabajo", columnaDeLocalizacion: "3/F2-1/E2-3/D2", tipo: "Equipo", cantidad: "7", real: "7", img: "/img/items/item2.jpg", observaciones: "Ninguna" },
        { equipo: "Estacion de Soldadura", marca: "Ya Xun", modelo: "852T", ubicacion: "Mesa de trabajo", columnaDeLocalizacion: "1/Ñ1-1/M1", tipo: "Equipo", cantidad: "2", real: "2", img: "/img/items/item3.jpg", observaciones: "Ninguna" },
        { equipo: "Emona Telecommunications Trainer", marca: "Datex", modelo: "ETT-202", ubicacion: "Armario 2", columnaDeLocalizacion: "Nivel 1", tipo: "Equipo", cantidad: "7", real: "7", img: "/img/items/item4.jpg", observaciones: "Ninguna" },
        { equipo: "Digital Electronics FPGA BOARD", marca: "NATIONAL-Instruments", modelo: "193426B-01L", ubicacion: "Armario 2", columnaDeLocalizacion: "Nivel 2 (12) -Nivel 3 (3)", tipo: "Equipo", cantidad: "15", real: "15", img: "/img/items/item5.jpg", observaciones: "Ninguna" },
    ];
    const itemCards = items.map(item => <Item data={item}></Item>);
    return (
        <div>
            <HeaderBar />
            <InventoryControls idLab={id} />
            <div className={InventoryStyles.itemsContainer}>
                {itemCards}
            </div>
        </div>
    )
}

function InventoryControls({ idLab }) {
    return (
        <div className={InventoryStyles.InventoryControls}>
            <div>
                <Link href="/" className={InventoryStyles.beforeIcon}>
                    <span className='icon-left-big'>
                    </span>
                </Link>
            </div>
            <div>
                <h2>Inventario de {idLab}</h2>
            </div>
            <div className='addItemContainer'>
                <Fab size="small" aria-label="add">
                    <AddIcon />
                </Fab>
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
                alt=""
                height="140"
                image= ""
            />
            <CardContent>
                <Typography onClick={showItemsDetailsCard} gutterBottom variant="p" component="div">
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
                        <label>Nombre de ítem:</label>
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
import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Modal from '@mui/material/Modal';

import ModeEditIcon from '@mui/icons-material/ModeEdit';
import DeleteIcon from '@mui/icons-material/Delete';

import Uploader from './uploader';

import { useState } from 'react';

import FormStyles from '../styles/Form.module.css'


const style = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: "90vw",
    height: "80vh",
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 4,
    overflow: "auto"
};

export default function OptionsItemCard({ item, items, setItems, handleRefresh }) {
    const [open, setOpen] = React.useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    return (
        <div>
            {/* <ModeEditIcon></ModeEditIcon> */}
            <Button onClick={handleOpen}>Opciones</Button>
            <Modal
                open={open}
                onClose={handleClose}
                aria-labelledby="modal-modal-title"
                aria-describedby="modal-modal-description"
            >
                <Box sx={style}>
                    <Typography id="modal-modal-description" sx={{ mt: 2 }}>
                        <h2>Opciones</h2>
                    </Typography>
                    <Typography id="modal-modal-description" sx={{ mt: 2 }}>
                        <EditItemCard item={item} items={items} setItems={setItems} handleRefresh ={handleRefresh} close = {handleClose} />
                    </Typography>
                    <Typography id="modal-modal-description" sx={{ mt: 2 }}>
                        <DeleteItemCard item={item} items={items} setItems={setItems} startIcon={<DeleteIcon />} />
                    </Typography>
                </Box>
            </Modal>
        </div >
    );
}


function EditItemCard({ item, items, setItems, handleRefresh,close }) {
    const [id, setID] = useState(item.id);
    const [equipo, setEquipo] = useState(item.equipo);
    const [marca, setMarca] = useState(item.marca);
    const [modelo, setModelo] = useState(item.modelo);
    const [ubicacion, setUbicacion] = useState(item.ubicacion);
    const [columnaDeLocalizacion, setcolumnaDeLocalizacion] = useState(item.columnaDeLocalizacion);
    const [tipo, setTipo] = useState(item.tipo);
    const [cantidad, setCantidad] = useState(item.cantidad);
    const [imgURL, setImgURL] = useState(item.imgURL);
    const [observaciones, setObservaciones] = useState(item.observaciones);

    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            const response = await fetch('/api/update_item', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    id, 
                    equipo,
                    marca, 
                    modelo,
                    ubicacion,
                    columnaDeLocalizacion,
                    tipo,
                    cantidad,
                    imgURL,
                    observaciones
                 })
            });

            if (!response.ok) {
                throw new Error('Error al actualizar laboratorio: ' + response.statusText);
            }

            // Limpiar los campos del formulario después de la actualización exitosa
            setEquipo('');
            setMarca('')
            setModelo('');
            setUbicacion('');
            setcolumnaDeLocalizacion('');
            setTipo('');
            setCantidad('');
            setObservaciones('');
            
            handleRefresh();
            close();
        } catch (error) {
            console.error(error.message);
        }
    };

    // const handleSubmit2 = (e) => {
    //     e.preventDefault();
    //     let newItems = items.map((current) => {
    //         if (current.id == item.id) {
    //             current.equipo = equipo;
    //             current.marca = marca;
    //             current.modelo = modelo;
    //             current.ubicacion = ubicacion;
    //             current.columnaDeLocalizacion = columnaDeLocalizacion;
    //             current.tipo = tipo;
    //             current.cantidad = cantidad;
    //             current.imgURL = imgURL;
    //             current.observaciones = observaciones;
    //             return current;
    //         } else {
    //             return current;
    //         }
    //     });

    //     setItems(() => {
    //         return newItems;
    //     })

    //     setEquipo('');
    //     setMarca('');
    //     setModelo('');
    //     setUbicacion('');
    //     setcolumnaDeLocalizacion('');
    //     setTipo('');
    //     setCantidad('');
    //     setObservaciones('');
    //     handleClose();
    // }


    const [open, setOpen] = React.useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    return (
        <div>
            <Button onClick={handleOpen} startIcon={<ModeEditIcon />}>
                Editar
            </Button>
            <Modal
                open={open}
                onClose={handleClose}
                aria-labelledby="modal-modal-title"
                aria-describedby="modal-modal-description"
            >
                <Box sx={style}>
                    <Typography id="modal-modal-description" sx={{ mt: 2 }}>
                        <h2>Editar ítem</h2>
                    </Typography>
                    <form className={FormStyles.form}>
                        <div>
                            <label>
                                Equipo:
                            </label>
                            <input type="text" name="equipo" value={equipo} onChange={(e) => setEquipo(e.target.value)} placeholder='Programmable DC POWER Supply' />
                        </div>
                        <div>
                            <label>Marca:</label>
                            <input type="text" name="marca" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder='EXTECH-Instruments' />
                        </div>
                        <div>
                            <label>
                                Modelo:
                            </label>
                            <input type="text" name="modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder='382280' />
                        </div>
                        <div>
                            <label>
                                Ubicacion:
                            </label>
                            <input type="text" name="ubicacion" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder='Mesa de trabajo' />
                        </div>
                        <div>
                            <label>
                                Columna de localizacion:
                            </label>
                            <input type="text" name="columnaDeLocalizacion" value={columnaDeLocalizacion} onChange={(e) => setcolumnaDeLocalizacion(e.target.value)} placeholder='3/F2-1/E2-3/D2' />
                        </div>
                        <div>
                            <label>
                                Tipo:
                            </label>
                            <input type="text" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder='Equipo' />
                        </div>

                        <div>
                            <label>
                                Cantidad:
                            </label>
                            <input type="text" name="cantidad" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder='7' />
                        </div>
                        <div>
                            <label>
                                Observaciones:
                            </label>
                            <input type="text" name="observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder='' />
                        </div>

                        <div className={FormStyles.buttonsContainer}>
                            <Button onClick={handleClose}>Cancelar</Button>
                            <Button onClick={handleSubmit}>Guardar cambios</Button>
                        </div>
                    </form>
                    <Uploader setImgURL = {setImgURL}></Uploader>
                </Box>
            </Modal>
        </div>
    );
}


function DeleteItemCard({ item, items, setItems }) {
    const handleSubmit = (e) => {
        e.preventDefault();
        let newItems = items.filter((current) => {
            if (current.id != item.id) {
                return current;
            }
            
        });
        setItems(() => {
            return newItems;
        })
        setEquipo('');
        setMarca('');
        setModelo('');
        setUbicacion('');
        setcolumnaDeLocalizacion('');
        setTipo('');
        setCantidad('');
        setImgURL('');
        setObservaciones('');
        handleClose();
    }


    const [open, setOpen] = React.useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    return (
        <div>
            <Button onClick={handleOpen} startIcon={<DeleteIcon />}>
                Eliminar
            </Button>
            <Modal
                open={open}
                onClose={handleClose}
                aria-labelledby="modal-modal-title"
                aria-describedby="modal-modal-description"
            >
                <Box sx={style}>
                    <Typography id="modal-modal-description" sx={{ mt: 2 }}>
                        <h2>Eliminar</h2>
                    </Typography>
                    <Typography id="modal-modal-description" sx={{ mt: 2 }}>
                        <p>
                            ¿Está seguro que desesa eliminar el ítem?
                        </p>
                    </Typography>
                    <div className={FormStyles.buttonsContainer}>
                        <Button onClick={handleClose}>Cancelar</Button>
                        <Button onClick={handleSubmit}>Confirmar</Button>
                    </div>
                </Box>
            </Modal>
        </div>
    );
}




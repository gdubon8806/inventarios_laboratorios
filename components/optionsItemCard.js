import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Modal from '@mui/material/Modal';

import ModeEditIcon from '@mui/icons-material/ModeEdit';
import DeleteIcon from '@mui/icons-material/Delete';

import Uploader from './uploader';
import toast from 'react-hot-toast';

import updateItem from './firebaseStuff/update-item';
import deleteItem from './firebaseStuff/delete-item';
import deleteImage from './firebaseStuff/delete-blob';

import { useState } from 'react';

import FormStyles from '../styles/Form.module.css'


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
                        Opciones
                    </Typography>
                    <EditItemCard item={item} items={items} setItems={setItems} handleRefresh={handleRefresh} close={handleClose} />
                    <DeleteItemCard item={item} close={handleClose} handleRefresh={handleRefresh} startIcon={<DeleteIcon />} />
                </Box>
            </Modal>
        </div >
    );
}


function EditItemCard({ item, items, setItems, handleRefresh, close }) {
    const [id, setID] = useState(item.id);
    const [equipo, setEquipo] = useState(item.equipo);
    const [marca, setMarca] = useState(item.marca);
    const [modelo, setModelo] = useState(item.modelo);
    const [ubicacion, setUbicacion] = useState(item.ubicacion);
    const [columnaDeLocalizacion, setcolumnaDeLocalizacion] = useState(item.columnadelocalizacion);
    const [tipo, setTipo] = useState(item.tipo);
    const [cantidad, setCantidad] = useState(item.cantidad);
    const [imgURL, setImgURL] = useState(item.imgurl);
    const [imgName, setImgName] = useState(item.imgname);
    const [observaciones, setObservaciones] = useState(item.observaciones);

    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            const newData = {
                equipo,
                marca,
                modelo,
                ubicacion,
                columnaDeLocalizacion,
                tipo,
                cantidad,
                imgurl: imgURL,
                imgname: imgName,
                observaciones
            }

            const response = updateItem(id, newData).then(() => {
                toast("Se ha actualizado el ítem exitosamente.");
            })

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
                        Editar ítem
                    </Typography>
                    <form className={FormStyles.form}>
                        <label>
                            Equipo:
                        </label>
                        <input type="text" name="equipo" value={equipo} onChange={(e) => setEquipo(e.target.value)} placeholder='Programmable DC POWER Supply' />
                        <label>Marca:</label>
                        <input type="text" name="marca" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder='EXTECH-Instruments' />
                        <label>
                            Modelo:
                        </label>
                        <input type="text" name="modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder='382280' />
                        <label>
                            Ubicacion:
                        </label>
                        <input type="text" name="ubicacion" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder='Mesa de trabajo' />
                        <label>
                            Columna de localizacion:
                        </label>
                        <input type="text" name="columnaDeLocalizacion" value={columnaDeLocalizacion} onChange={(e) => setcolumnaDeLocalizacion(e.target.value)} placeholder='3/F2-1/E2-3/D2' />
                        <label>
                            Tipo:
                        </label>
                        <input type="text" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder='Equipo' />
                        <label>
                            Cantidad:
                        </label>
                        <input type="text" name="cantidad" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder='7' />
                        <label>
                            Observaciones:
                        </label>
                        <input type="text" name="observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder='' />
                    </form>
                    <Uploader setImgURL={setImgURL} setImgName={setImgName}></Uploader>
                    <div className={FormStyles.btnsContainer}>
                        <Button onClick={handleClose}>Cancelar</Button>
                        <Button onClick={handleSubmit}>Guardar cambios</Button>
                    </div>
                </Box>
            </Modal>
        </div>
    );
}


function DeleteItemCard({ item, close, handleRefresh }) {
    const [idItem, setIdItem] = useState(item.id);
    const [imgURL, setImgURL] = useState(item.imgname);
    const handleSubmit = async (event) => {
        event.preventDefault();

        try {
            const resFireStore = await deleteItem(idItem);
            if (resFireStore) {
                toast('¡El ítem se eliminó correctamente!');
            } else {
                toast.error('¡Hubo un error al eliminar el ítem!');
            }
            const resStorage = await deleteImage(`images/${item.imgname}`);
            if (resStorage) {
                toast('¡La imagen asociada se eliminó correctamente tambien!');
            } else {
                toast.error('¡Hubo un error al eliminar la imagen asociada al ítem!');
            }
            // Limpiar el campo del formulario después de la eliminación exitosa
            handleRefresh();
            close();
        } catch (error) {
            console.error(error.message);
        }
    };


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
                        Eliminar
                    </Typography>
                    <Typography id="modal-modal-description" sx={{ mt: 2 }}>
                        ¿Está seguro que desesa eliminar el ítem?
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




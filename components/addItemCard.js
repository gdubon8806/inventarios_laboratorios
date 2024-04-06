import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Modal from '@mui/material/Modal';
import AddIcon from '@mui/icons-material/Add';

import { useState } from 'react';
import Uploader from './uploader';
import toast from 'react-hot-toast';


import FormStyles from '../styles/Form.module.css'
import createItem from './firebaseStuff/create-item';


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

export default function AddItemCard({ handleRefresh, id_lab, handleAdd }) {
    const [open, setOpen] = React.useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    return (
        <div>
            {/* <AddButton></AddButton> */}
            <Button variant="contained" onClick={handleOpen} startIcon={<AddIcon />}>Agregar</Button>
            <Modal
                open={open}
                onClose={handleClose}
                aria-labelledby="modal-modal-title"
                aria-describedby="modal-modal-description"
            >
                <Box sx={style}>
                    <Typography id="modal-modal-title" variant="h5" component="h2">
                        Agregar nuevo Item
                    </Typography>
                    <AddLabForm handleRefresh={handleRefresh} id_lab={id_lab} close={handleClose} add={handleAdd} />
                </Box>
            </Modal>
        </div>
    );
}

function AddLabForm({ handleRefresh, id_lab, close, add }) {
    const [idLab, setIdLab] = useState(id_lab);
    const [equipo, setEquipo] = useState('');
    const [marca, setMarca] = useState('');
    const [modelo, setModelo] = useState('');
    const [ubicacion, setUbicacion] = useState('');
    const [columnaDeLocalizacion, setColumnaDeLocalizacion] = useState('');
    const [tipo, setTipo] = useState('');
    const [cantidad, setCantidad] = useState('');
    const [imgURL, setImgURL] = useState('');
    const [imgName, setImgName] = useState('');

    const [observaciones, setObservaciones] = useState([]);
    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            if(equipo.length < 1) {
                toast("¡Debes al menos escribir el nombre para agregar el ítem!")
                return;
            }
            const itemData = {
                equipo,
                marca,
                modelo,
                ubicacion,
                columnadelocalizacion: columnaDeLocalizacion,
                tipo,
                cantidad,
                imgurl: imgURL,
                imgname: imgName,
                observaciones,
                id_lab: idLab
            }

            const resFireStore = await createItem(itemData).then((res) => {
                toast("¡Se ha insertado el nuevo ítem exitosamente!")
            })

            // Limpiar los campos del formulario después de la inserción exitosa
            setEquipo('');
            setMarca('');
            setModelo('');
            setUbicacion('');
            setColumnaDeLocalizacion('');
            setTipo('');
            setCantidad('');
            setImgURL('');
            setObservaciones('');
            handleRefresh();
            close();
        } catch (error) {
             toast.error("Ocurrió algo. No se pudo insertar el ítem.");
        }
    };
    return (
        <div>
            <h2 className={FormStyles.headerForm}>Ingresar datos</h2>
            <form className={FormStyles.form}>
                <label>
                    Equipo:
                </label>
                <input type="text" name="nombre" value={equipo} onChange={(e) => setEquipo(e.target.value)} placeholder='Ingresar nombre de equipo...' minLength={1} required />
                <label>Marca:</label>
                <input type="text" name="descripcion" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder='Ingresar...' />
                <label>
                    Modelo:
                </label>
                <input type="text" name="nombre" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder='Ingresar...' />
                <label>
                    Ubicación:
                </label>
                <input type="text" name="nombre" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder='Ingresar...' />
                <label>
                    Columna de localización:
                </label>
                <input type="text" name="nombre" value={columnaDeLocalizacion} onChange={(e) => setColumnaDeLocalizacion(e.target.value)} placeholder='Ingresar...' />
                <label>
                    Tipo:
                </label>
                <input type="text" name="nombre" value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder='Ingresar...' />
                <label>
                    Cantidad:
                </label>
                <input type="text" name="nombre" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder='Ingresar...' />
                <label>
                    Observaciones:
                </label>
                <input type="text" name="nombre" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder='Ingresar...' />
            </form>
            <Uploader setImgURL={setImgURL} setImgName={setImgName}></Uploader>
            <div className={FormStyles.btnsAddLabContainer}>
                <Button onClick={close}>Cancelar</Button>
                <Button onClick={handleSubmit}>Agregar</Button>
            </div>

        </div>
    )
}
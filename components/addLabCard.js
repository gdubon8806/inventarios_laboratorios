import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Modal from '@mui/material/Modal';
import AddIcon from '@mui/icons-material/Add';
import Uploader from './uploader';
import toast from 'react-hot-toast';

import { useState } from 'react';
import { useRouter } from 'next/router';

import FormStyles from '../styles/Form.module.css'
import createLab from './firebaseStuff/create-lab';


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

export default function AddLabCard({ handleRefresh }) {
    const [open, setOpen] = React.useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    return (
        <div className='add-lab-btn-container'>
            <Button className='add-lab-btn' variant="contained" onClick={handleOpen} startIcon={<AddIcon />}>Agregar</Button>
            <Modal
                open={open}
                onClose={handleClose}
                aria-labelledby="modal-modal-title"
                aria-describedby="modal-modal-description"
            >
                <Box sx={style}>
                    <Typography id="modal-modal-title" variant="h5" component="h2">
                        Agregar nuevo laboratorio
                    </Typography>
                    <AddLabForm close={handleClose} handleRefresh={handleRefresh} />
                </Box>
            </Modal>
        </div>
    );
}

function AddLabForm({ close, handleRefresh }) {
    // const router = useRouter();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [imgURL, setImgURL] = useState('');
    const [imgName, setImgName] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        //validar datos
        if(name.length < 1) {
            toast("¡Debes al menos escribir el nombre para agregar el laboratorio!")
            return;
        }
        //intentar enviar datos a db
        try {
            createLab(name, description, imgURL, imgName).then(() => {
                toast("¡Se ha insertado el nuevo laboratorio exitosamente!")
            })
        } catch (error) {
            toast.error("Ocurrió algo. No se pudo insertar el laboratorio.");
        }

        try {
            // Limpiar los campos del formulario después de la inserción exitosa
            setName('');
            setDescription('');
            setImgURL('')
            handleRefresh(); //cambiar por otra forma
            close();

            //recargar pagina para ver cambios
            // router.reload();
        } catch (error) {
            console.error(error.message);
        }
    };
    return (
        <div>
            <h2 className={FormStyles.headerForm}>Ingresar datos</h2>
            <form className={FormStyles.form}>
                <label>Nombre:</label>
                <input type="text" name="nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder='Ingresar nombre...' minLength={1} required/>
                <label>Descripción:</label>
                <input type="text" name="descripcion" value={description} onChange={(e) => setDescription(e.target.value)} placeholder='Ingresar detalles...' />
            </form>
            <Uploader setImgURL={setImgURL} setImgName={setImgName}></Uploader>
            <div className={FormStyles.btnsAddLabContainer}>
                <Button onClick={close}>Cancelar</Button>
                <Button onClick={handleSubmit}>Agregar</Button>
            </div>

        </div>

    )
}
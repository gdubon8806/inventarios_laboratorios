import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Modal from '@mui/material/Modal';
import AddIcon from '@mui/icons-material/Add';
import Uploader from './uploader';

import { useState } from 'react';

import FormStyles from '../styles/Form.module.css'


const style = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 'auto',
    height: '70vh',
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 4,
    overflowY: 'auto'
    
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
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [imgURL, setImgURL] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();

        try {
            const response = await fetch('/api/create_lab', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, description, imgURL })
            });

            if (!response.ok) {
                throw new Error('Error al insertar laboratorio: ' + response.statusText);
            }

            // Limpiar los campos del formulario después de la inserción exitosa
            setName('');
            setDescription('');
            setImgURL('')
            alert("Se ha insertado el nuevo laboratorio exitosamente.")
            handleRefresh();
            close();
        } catch (error) {
            console.error(error.message);
        }
    };
    return (
        <div>

            <form className={FormStyles.form}>
                <div className={FormStyles.inputsForm}>
                    <label>
                        Nombre:
                    </label>
                    <input type="text" name="nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder='Laboratorio de MAC' />
                </div>
                <div>
                    <label>Descripción:</label>
                    <input type="text" name="descripcion" value={description} onChange={(e) => setDescription(e.target.value)} placeholder='Laboratorio equipado con computadoras iMac.' />
                </div>
                <div className={FormStyles.addLabUploaderImage}>
                    {/* <Uploader setImgURL = {setImgURL}></Uploader> */}
                </div>
            </form>
            <Uploader setImgURL={setImgURL}></Uploader>
            <div className={FormStyles.btnsForm}>
                <Button onClick={close}>Cancelar</Button>
                <Button onClick={handleSubmit}>Agregar</Button>
            </div>
            
        </div>

    )
}
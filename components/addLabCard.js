import * as React from 'react';
import Box from '@mui/material/Box';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Button from '@mui/material/Button';
import Modal from '@mui/material/Modal';
import AddIcon from '@mui/icons-material/Add';
import Uploader from './uploader/uploader';
import toast from 'react-hot-toast';
// import { useUser } from '@auth0/nextjs-auth0/client';


import { useState } from 'react';

import FormStyles from '../styles/Form.module.css'
import createLab from './firebaseStuff/create-lab';
import { uploadImage } from './firebaseStuff/uploadImages';


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
    //Si el usuario esta autorizado entonces este componente se renderizara
    // const { user } = useUser();
    // if (user.email !== 'coordinacionlaboratorios@gmail.com') {
    //     return (
    //         <div>
    //         </div>
    //     );
    // }

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
    const [imgName, setImgName] = useState('');
    const [imgFile, setImgFile] = useState(null);

    const handleSubmit = async (event) => {
        event.preventDefault();
        //validar datos
        if (name.length < 1) {
            toast("¡Debes al menos escribir el nombre para agregar el laboratorio!")
            return;
        }
        //intentar enviar datos a db
        try {
            if (imgFile != null) {
                await uploadImage(imgFile)
                    .then(async (res) => {
                        if (res[0] === 1) {
                            // const { url } = (await res.json()) as PutBlobResult
                            setImgURL(res[1]);
                            setImgName(res[2]);
                            toast("¡Se ha insertado la imagen exitosamente!")
                            createLab(name, description, res[1], res[2]).then(() => {
                                toast("¡Se ha insertado el nuevo laboratorio exitosamente!")
                            })
                        }
                    })
            } else {
                const result = await createLab(name, description, imgURL, imgName);
                if (result === false) {
                    toast.error("¡Vaya! Ocurrió un error al insertar el laboratorio.");
                } else {
                    toast("Se ha insertado el nuevo laboratorio exitosamente.");
                }
            }

        } catch (error) {
            toast.error("Ocurrió algo. No se pudo insertar el laboratorio.");
        }

        // Limpiar los campos del formulario después de la inserción exitosa
        setName('');
        setDescription('');
        setImgURL('');
        setImgName('');
        setImgFile(null);
        handleRefresh();
        close();
    };
    return (
        <div>
            <div className={FormStyles.headerForm}>
                <Button startIcon={<ArrowBackIcon />} className={FormStyles.backBtn} onClick={close}>Atrás</Button>
                <h2>Nuevo laboratorio</h2>
                <h2 className={FormStyles.headerForm}>Ingresar datos</h2>
            </div>
            <form className={FormStyles.form}>
                <label>Nombre:</label>
                <input type="text" name="nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder='Ingresar nombre...' minLength={1} required />
                <label>Descripción:</label>
                <input type="text" name="descripcion" value={description} onChange={(e) => setDescription(e.target.value)} placeholder='Ingresar detalles...' />
            </form>
            <Uploader setImgFile={setImgFile} setImgURL={setImgURL} setImgName={setImgName}></Uploader>
            <div className={FormStyles.btnsAddLabContainer}>
                <Button onClick={close}>Cancelar</Button>
                <Button onClick={handleSubmit}>Agregar</Button>
            </div>
        </div>
    )
}
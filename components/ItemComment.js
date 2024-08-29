import * as React from 'react';
import Box from '@mui/material/Box';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Button from '@mui/material/Button';
import Modal from '@mui/material/Modal';
import AddIcon from '@mui/icons-material/Add';
import Uploader from './uploader';
import ModeEditIcon from '@mui/icons-material/ModeEdit';
import DeleteIcon from '@mui/icons-material/Delete';
import toast from 'react-hot-toast';
import Typography from '@mui/material/Typography';
import { useUser } from '@auth0/nextjs-auth0/client';



import { useState } from 'react';

import FormStyles from '../styles/Form.module.css'
import createLab from './firebaseStuff/create-lab';
import createItemComment from './firebaseStuff/create-itemComment';
import { uploadImage } from './firebaseStuff/uploadImages';
import { Timestamp } from 'firebase/firestore';

import updateItemComment from './firebaseStuff/update-itemComment';
import deleteItemComment from './firebaseStuff/delete-itemComment';


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

export default function AddItemCommentCard({ idItem, handleRefresh }) {
    const [open, setOpen] = React.useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);
    
    const { user } = useUser();
    if (user.email !== 'coordinacionlaboratorios@gmail.com') {
        return (
            <div>
            </div>
        );
    }
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
                    <AddItemCommentForm idItem={idItem} close={handleClose} handleRefresh={handleRefresh} />
                </Box>
            </Modal>
        </div>
    );
}


export function EditItemCommentCard({ itemComment, handleRefresh }) {
    const [title, setTitle] = useState(itemComment.title);
    const [description, setDescription] = useState(itemComment.description);

    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            const newCommentData = {
                title: title,
                description: description,
                time: Timestamp.now()
            }
            updateItemComment(itemComment.id, newCommentData);
            toast("¡Se ha actualizado el comentario exitosamente!")
        } catch (error) {
            console.error(error.message);
        }
        handleRefresh();
        handleClose();

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
                    <div className={FormStyles.headerForm}>
                        <h2>Opciones</h2>
                    </div>
                    <br></br>
                    <form className={FormStyles.form}>
                        <label>
                            Titulo:
                        </label>
                        <input type="text" name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder='Ingresar...' />
                        <label>
                            Descripcion:
                        </label>
                        <input type="text" name="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder='Ingresar...' />
                    </form>
                    <div className={FormStyles.btnsContainer}>
                        <Button onClick={handleClose}>Cancelar</Button>
                        <Button onClick={handleSubmit}>Guardar cambios</Button>
                    </div>
                </Box>
            </Modal>
        </div>
    );
}



function AddItemCommentForm({ idItem, close, handleRefresh }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        //validar datos
        if (title.length < 1) {
            toast("¡Debes al menos escribir el titulo para agregar el comentario!")
            return;
        }
        //intentar enviar datos a db
        try {
            createItemComment(title, description, idItem).then(() => {
                toast("¡Se ha insertado el comentario exitosamente!")
            })

        } catch (error) {
            toast.error("Ocurrió algo. No se pudo insertar el comentario.");
        }

        // Limpiar los campos del formulario después de la inserción exitosa
        setTitle('');
        setDescription('');
        // setImgFile(null);
        handleRefresh();
        close();
    };
    return (
        <div>
            <div className={FormStyles.headerForm}>
                <Button startIcon={<ArrowBackIcon />} className={FormStyles.backBtn} onClick={close}>Atrás</Button>
                <h2>Nuevo Comentario</h2>
                <h2 className={FormStyles.headerForm}>Ingresar datos</h2>
            </div>
            <form className={FormStyles.form}>
                <label>Titulo:</label>
                <input type="text" name="nombre" value={title} onChange={(e) => setTitle(e.target.value)} placeholder='Ingresar titulo...' minLength={1} required />
                <label>Descripción:</label>
                <input type="text" name="descripcion" value={description} onChange={(e) => setDescription(e.target.value)} placeholder='Ingresar detalles...' />
            </form>
            {/* <Uploader setImgFile={setImgFile} setImgURL={setImgURL} setImgName={setImgName}></Uploader> */}
            <div className={FormStyles.btnsAddLabContainer}>
                <Button onClick={close}>Cancelar</Button>
                <Button onClick={handleSubmit}>Agregar</Button>
            </div>
        </div>
    )
}


export function DeleteItemCommentCard({ itemComment, handleRefresh }) {
    const [idItem, setIdItem] = useState(itemComment.id);
    const handleSubmit = async (event) => {
        event.preventDefault();

        try {
            const resFireStore = await deleteItemComment(idItem);
            if (resFireStore) {
                toast('¡El comentario se eliminó correctamente!');
            } else {
                toast.error('¡Hubo un error al eliminar el comentario!');
            }
            handleClose()
            handleRefresh();
        } catch (error) {
            console.error(error.message);
        }
    };


    const [open, setOpen] = React.useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    return (
        <div className={FormStyles.deleteBtnContainer}>
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
                    <div className={FormStyles.headerForm}>
                        <Button startIcon={<ArrowBackIcon />} className={FormStyles.backBtn} onClick={handleClose}>Atrás</Button>
                        <h2>Eliminar comentario</h2>
                    </div>
                    <Typography id="modal-modal-description" sx={{ mt: 2 }}>
                        ¿Está seguro que desesa eliminar el comentario?
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




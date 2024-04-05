import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Modal from '@mui/material/Modal';
import DeleteIcon from '@mui/icons-material/Delete';
import ModeEditIcon from '@mui/icons-material/ModeEdit';

import Uploader from './uploader'

import updateLab from './firebaseStuff/update-lab';
import deleteLab from './firebaseStuff/delete-lab';

import { useState } from 'react';

import FormStyles from '../styles/Form.module.css'
import { FormatAlignCenterOutlined } from '@mui/icons-material';
import deleteImage from './firebaseStuff/delete-blob';


const style = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '100vw',
    height: '80vh',
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 4,
    overflow: "auto"
};

export default function OptionsLabCard({ lab, handleRefresh }) {
    const [open, setOpen] = React.useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    return (
        <div>
            {/* <ModeEditIcon></ModeEditIcon> */}
            <Button onClick={handleOpen} startIcon={<ModeEditIcon />}>Editar</Button>
            <Modal
                open={open}
                onClose={handleClose}
                aria-labelledby="modal-modal-title"
                aria-describedby="modal-modal-description"
            >
                <Box sx={style}>
                    <Typography id="modal-modal-title" variant="h5" component="h2">
                        Opciones
                    </Typography>
                    <DeleteLabCard lab={lab} close={handleClose} handleRefresh={handleRefresh} />
                    <EditLabCard lab={lab} close={handleClose} handleRefresh={handleRefresh}></EditLabCard>
                </Box>
            </Modal>
        </div>
    );
}
function EditLabCard({ lab, close, handleRefresh }) {
    const [id, useID] = useState(lab.id);
    const [name, setName] = useState(lab.name);
    const [description, setDescription] = useState(lab.description);
    const [imgurl, setImgURL] = useState(lab.imgurl);

    const handleSubmit = async (event) => {
        event.preventDefault();

        try {
            // const response = await fetch('/api/update_lab', {
            //     method: 'PUT',
            //     headers: {
            //         'Content-Type': 'application/json'
            //     },
            //     body: JSON.stringify({
            //         id,
            //         name,
            //         description,
            //         imgurl
            //     })
            // });

            // if (!response.ok) {
            //     throw new Error('Error al actualizar laboratorio: ' + response.statusText);
            // }

            const labId = id; // Reemplaza 'ID_DEL_LABORATORIO' con el ID del laboratorio que deseas actualizar
            const newData = {
                name,
                description,
                imgurl
            };
            const resultado = await updateLab(labId, newData);
            if (resultado) {
                console.log('El laboratorio se actualizó correctamente.');
            } else {
                console.log('Hubo un error al actualizar el laboratorio.');
            }


            // Limpiar los campos del formulario después de la actualización exitosa
            setName('');
            setDescription('');
            close();
            handleRefresh();
        } catch (error) {
            console.error(error.message);
        }
    };

    return (
        <div className={FormStyles.editLabFormContainer}>
            <form className={FormStyles.form}>
                <div>
                    <label>
                        Nombre:
                    </label>
                    <input type="text" name="nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder='Laboratorio de MAC' />
                </div>
                <div>
                    <label>Descripción:</label>
                    <input type="text" name="descripcion" value={description} onChange={(e) => setDescription(e.target.value)} placeholder='Laboratorio equipado con computadoras iMac.' />
                </div>
                <div className={FormStyles.buttonsContainer}>
                    <Button onClick={close}>Cancelar</Button>
                    <Button onClick={handleSubmit}>Guardar cambios</Button>
                </div>
            </form>
            <Uploader setImgURL={setImgURL}></Uploader>
        </div>

    )
}

function DeleteLabCard({ lab, close, handleRefresh }) {
    const [id, useID] = useState(lab.id);
    const [imgURL, useImgURL] = useState(lab.imgurl);
    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            // const responsePOSTGRES = await fetch('/api/delete_lab', {
            //     method: 'DELETE',
            //     headers: {
            //         'Content-Type': 'application/json'
            //     },
            //     body: JSON.stringify({ idLab: id })
            // });
            const labId = id; // Reemplaza 'ID_DEL_LABORATORIO' con el ID del laboratorio que deseas eliminar
            const resFireStore = await deleteLab(labId);
            if (resFireStore) {
                console.log('El laboratorio se eliminó correctamente.');
            } else {
                console.log('Hubo un error al eliminar el laboratorio.');
            }

            const resStorage = await deleteImage(`images/${lab.imgname}`);
            if (resStorage) {
                console.log('El laboratorio se eliminó correctamente.');
            } else {
                console.log('Hubo un error al eliminar el laboratorio.');
            }


        // const responseBLOB = await fetch('/api/delete_blob', {
        //     method: 'DELETE',
        //     headers: {
        //         'Content-Type': 'application/json'
        //     },
        //     body: JSON.stringify({ url: imgURL })
        // });


        // if (!responsePOSTGRES.ok || !responseBLOB.ok) {
        //     throw new Error('Error al eliminar laboratorio: ' + responsePOSTGRES.statusText);
        // } else {
        //     alert("Se ha eliminado correctamente.");
        // }

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
                    ¿Está seguro que desesa eliminar el laboratorio?
                    Se eliminarán también los ítems.
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
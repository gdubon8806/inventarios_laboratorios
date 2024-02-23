import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Modal from '@mui/material/Modal';
import DeleteIcon from '@mui/icons-material/Delete';
import ModeEditIcon from '@mui/icons-material/ModeEdit';

import { useState } from 'react';

import FormStyles from '../styles/Form.module.css'


const style = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 400,
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 4,
};

export default function OptionsLabCard({ lab, labs, setLabs }) {
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
                    <DeleteLabCard lab={lab} labs={labs} setLabs={setLabs} />

                    <Typography id="modal-modal-description" sx={{ mt: 2 }}>
                        <EditLabCard lab={lab} labs={labs} setLabs={setLabs} close={handleClose}></EditLabCard>
                    </Typography>
                </Box>
            </Modal>
        </div>
    );
}
function EditLabCard({ lab, labs, setLabs, close }) {
    const [name, setName] = useState(lab.name);
    const [description, setDescription] = useState(lab.description);
    const [img, setImg] = useState(lab.img);

    const handleSubmit = (e) => {
        e.preventDefault();
        let newLabs = labs.map((current) => {
            if (current.id == lab.id) {
                current.name = name;
                current.description = description;
                current.img = img;
                return current;
            } else {
                return current;
            }
        });

        setLabs(() => {
            return newLabs;
        })
        setName('');
        setDescription('');
        setImg('');
        close();
    }
    return (
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
    )
}

function DeleteLabCard({ lab, labs, setLabs }) {
    const handleSubmit = (e) => {
        e.preventDefault();
        let newLabs = labs.filter((current) => {
            if (current.id != lab.id) {
                return current;
            }
            
        });
        setLabs(() => {
            return newLabs;
        })
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
                            ¿Está seguro que desesa eliminar el laboratorio?
                            Se eliminarán también los ítems.
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
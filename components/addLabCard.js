import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Modal from '@mui/material/Modal';

import {useState} from 'react';

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

export default function AddLabCard({ handleAdd }) {
    const [open, setOpen] = React.useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    return (
        <div>
            {/* <AddButton></AddButton> */}
            <Button onClick={handleOpen}>Agregar</Button>
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
                    <Typography id="modal-modal-description" sx={{ mt: 2 }}>
                        <AddLabForm close={handleClose} add={handleAdd} />
                    </Typography>
                </Box>
            </Modal>
        </div>
    );
}

function AddLabForm({ close, add }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [img, setImg] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        // Llama a la función proporcionada desde el componente padre y pasa los datos del nuevo laboratorio
        add({name, description, img });
        // Limpiar los inputs después de enviar el formulario
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
                <div>
                    <Button onClick={close}>Cancelar</Button>
                    <Button onClick={handleSubmit}>Agregar</Button>
                </div>
            </form>
        )
}
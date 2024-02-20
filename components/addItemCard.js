import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Modal from '@mui/material/Modal';
import AddIcon from '@mui/icons-material/Add';

import { useState } from 'react';

import FormStyles from '../styles/Form.module.css'


const style = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 'auto',
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 4,
};

export default function AddItemCard({ handleAdd }) {
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
                    <Typography id="modal-modal-description" sx={{ mt: 2 }}>
                        <AddLabForm close={handleClose} add={handleAdd} />
                    </Typography>
                </Box>
            </Modal>
        </div>
    );
}

function AddLabForm({ close, add }) {
    const [equipo, setEquipo] = useState('');
    const [marca, setMarca] = useState('');
    const [modelo, setModelo] = useState('');
    const [ubicacion, setUbicacion] = useState('');
    const [columnaDeLocalizacion, setColumnaDeLocalizacion] = useState('');
    const [tipo, setTipo] = useState('');
    const [cantidad, setCantidad] = useState('');
    const [img, setImg] = useState('');
    const [observaciones, setObservaciones] = useState([]);
    const handleSubmit = (e) => {
        e.preventDefault();
        add({ 
            equipo, 
            marca, 
            modelo,
            ubicacion,
            columnaDeLocalizacion,
            tipo,
            cantidad,
            img,
            observaciones
        });
        setEquipo('');
        setMarca('');
        setModelo('');
        setUbicacion('');
        setColumnaDeLocalizacion('');
        setTipo('');
        setCantidad('');
        setImg('');
        setObservaciones('');
        close();
    }
    return (
        <form className={FormStyles.form}>
            <div>
                <label>
                    Equipo:
                </label>
                <input type="text" name="nombre" value={equipo} onChange={(e) => setEquipo(e.target.value)} placeholder='Router' />
            </div>
            <div>
                <label>Marca:</label>
                <input type="text" name="descripcion" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder='MikroTik' />
            </div>
            <div>
                <label>
                    modelo:
                </label>
                <input type="text" name="nombre" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder='hEX lite' />
            </div>
            <div>
                <label>
                    Ubicación:
                </label>
                <input type="text" name="nombre" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder='Armario 3' />
            </div>
            <div>
                <label>
                    Columna de localización:
                </label>
                <input type="text" name="nombre" value={columnaDeLocalizacion} onChange={(e) => setColumnaDeLocalizacion(e.target.value)} placeholder='Nivel 4' />
            </div>
            <div>
                <label>
                    Tipo:
                </label>
                <input type="text" name="nombre" value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder='Equipo' />
            </div>
            <div>
                <label>
                    Cantidad:
                </label>
                <input type="text" name="nombre" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder='5' />
            </div>
            <div>
                <label>
                    Imagen:
                </label>
                <input type="text" name="nombre" value={img} onChange={(e) => setImg(e.target.value)} placeholder='/img/items/item4.jpg' />
            </div>
            <div>
                <label>
                    Observaciones:
                </label>
                <input type="text" name="nombre" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder='queeee' />
            </div>
            <div>
                <Button onClick={close}>Cancelar</Button>
                <Button onClick={handleSubmit}>Agregar</Button>
            </div>
        </form>
    )
}
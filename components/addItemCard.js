import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Modal from '@mui/material/Modal';
import AddIcon from '@mui/icons-material/Add';

import { useState } from 'react';
import Uploader from './uploader/uploader';
import toast from 'react-hot-toast';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';


import FormStyles from '../styles/Form.module.css'
import createItem from './firebase/create-item';
import { uploadImage } from './firebase/uploadImages';



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

export default function AddItemCard({ setItems, idLab }) {
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
                    <AddItemForm setItems={setItems} idLab={idLab} close={handleClose} />
                </Box>
            </Modal>
        </div>
    );
}

function AddItemForm({ setItems, idLab, close }) {
    const [equipo, setEquipo] = useState('');
    const [marca, setMarca] = useState('');
    const [modelo, setModelo] = useState('');
    const [ubicacion, setUbicacion] = useState('');
    const [columnaDeLocalizacion, setColumnaDeLocalizacion] = useState('');
    const [tipo, setTipo] = useState('');
    const [cantidad, setCantidad] = useState('');
    const [imgURL, setImgURL] = useState('');
    const [imgName, setImgName] = useState('');
    const [imgFile, setImgFile] = useState(null);
    const [observaciones, setObservaciones] = useState([]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            if (equipo.length < 1) {
                toast("¡Debes al menos escribir el nombre para agregar el ítem!")
                return;
            }
            try {
                if (imgFile != null) {
                    await uploadImage(imgFile)
                        .then(async (res) => {
                            if (res[0] === 1) {
                                setImgURL(res[1]);
                                setImgName(res[2]);
                                toast("Se ha insertado la imagen exitosamente en la base de datos.")
                                const itemData = {
                                    equipo,
                                    marca,
                                    modelo,
                                    ubicacion,
                                    columnadelocalizacion: columnaDeLocalizacion,
                                    tipo,
                                    cantidad,
                                    imgurl: res[1],
                                    imgname: res[2],
                                    observaciones,
                                    idLab: idLab
                                }
                                const sucess = await createItem(itemData);
                                if (sucess === false) {
                                    toast.error("Ocurrió algo. No se pudo insertar el ítem en la base de datos.");
                                } else {
                                    setItems(prevItems => [...prevItems, { id: sucess, ...itemData }]);
                                    toast("Se ha insertado el nuevo ítem exitosamente")
                                    close();
                                }
                            } else {
                                toast.error("Ocurrió algo. No se pudo insertar la imagen en la base de datos.");
                            }
                        })
                } else {
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
                        idLab: idLab
                    }
                    const success = await createItem(itemData);
                    if (success === false) {
                        toast.error("Ocurrió algo. No se pudo insertar el ítem en la base de datos.");
                    } else {
                        toast("Se ha insertado el nuevo ítem exitosamente en la base de datos.")
                        setItems(prevItems => [...prevItems, { id: success, ...itemData }]);
                        close();
                    }
                }

            } catch (error) {
                toast.error("Ocurrió algo. No se pudo insertar el ítem.");
            }
        } catch (error) {
            toast.error("Ocurrió algo. No se pudo insertar el ítem.");
        }
    };
    return (
        <div>
            <div className={FormStyles.headerForm}>
                <Button startIcon={<ArrowBackIcon />} className={FormStyles.backBtn} onClick={close}>Atrás</Button>
                <h2>Nuevo Ítem</h2>
                <h2 className={FormStyles.headerForm}>Ingresar datos</h2>
            </div>
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
                <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                    <option value="" disabled>Seleccionar tipo...</option>
                    <option value="Herramienta">Herramienta</option>
                    <option value="Suministro">Suministro</option>
                    <option value="Equipo">Equipo</option>
                    <option value="Mobiliario">Mobiliario</option>
                </select><label>
                    Cantidad:
                </label>
                <input type="text" name="nombre" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder='Ingresar...' />
                <label>
                    Observaciones:
                </label>
                <input type="text" name="nombre" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder='Ingresar...' />
            </form>
            <Uploader setImgFile={setImgFile} setImgURL={setImgURL} setImgName={setImgName}></Uploader>
            <div className={FormStyles.btnsAddLabContainer}>
                <Button onClick={close}>Cancelar</Button>
                <Button onClick={handleSubmit}>Agregar</Button>
            </div>

        </div>
    )
}
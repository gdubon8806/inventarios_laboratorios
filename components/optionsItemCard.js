import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Modal from '@mui/material/Modal';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import Image from 'next/image'

import ModeEditIcon from '@mui/icons-material/ModeEdit';
import DeleteIcon from '@mui/icons-material/Delete';

import Uploader from './uploader/uploader';
import toast from 'react-hot-toast';

import updateItem from './firebase/update-item';
import { uploadImage } from './firebase/uploadImages';
import deleteItem from './firebase/delete-item';
import deleteImage from './firebase/delete-blob';
// import { useUser } from '@auth0/nextjs-auth0/client';


import { useState } from 'react';

import FormStyles from '../styles/Form.module.css'


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

export default function OptionsItemCard({ item, items, setItems, handleRefresh }) {
    const [open, setOpen] = React.useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    return (
        <div>
            {/* <ModeEditIcon></ModeEditIcon> */}
            <Button onClick={handleOpen}>Opciones</Button>
            <Modal
                open={open}
                onClose={handleClose}
                aria-labelledby="modal-modal-title"
                aria-describedby="modal-modal-description"
            >
                <Box sx={style}>
                    <div className={FormStyles.headerForm}>
                        <Button startIcon={<ArrowBackIcon />} className={FormStyles.backBtn} onClick={handleClose}>Atrás </Button>
                        <h2>Opciones</h2>
                    </div>
                    <EditItemCard item={item} items={items} setItems={setItems} close={handleClose} />
                    <DeleteItemCard item={item} close={handleClose} setItems = {setItems} startIcon={<DeleteIcon />} />
                </Box>
            </Modal>
        </div >
    );
}


function setImg(item, setImgUrl, setImgName, setItems) {
    const [loading, setLoading] = useState(true);

    const handleLoad = () => {
        setLoading(false);
    };

    async function deleteImg() {
        if (item.imgname != '') {
            const resStorage = await deleteImage(`images/${item.imgname}`);
            if (resStorage) {
                toast('Su imagen asociada se eliminó correctamente.');

                setImgUrl("");
                setImgName("");
                const id = item.id;
                const newData = {
                    imgurl: "",
                    imgname: ""
                };
                const success = await updateItem(id, newData);
                if (success) {
                    toast('El ítem se actualizó exitosamente en la base de datos.');
                    setItems(prevItems => prevItems.map(i => i.id === id ? { ...i, ...newData } : i));
                } else {
                    toast.error('Hubo un error al actualizar el ítem.');
                }
            } else {
                toast.error('Hubo un error al eliminar su imagen asociada.');
            }

        }
    }
    if (item.imgurl !== '') {
        return (
            <>
                <div className={FormStyles.deleteBtnContainer}>
                    <Button onClick={deleteImg} startIcon={<DeleteIcon />}>
                        Eliminar imagen
                    </Button>
                </div>
                <div style={{ position: 'relative' }}>
                    {loading && (
                        <div
                            style={{
                                textAlign: 'center',
                            }}
                        >
                            Cargando imagen...
                        </div>
                    )}
                    <Image
                        src={item.imgurl}
                        alt="Imagen de ítem"
                        width={500}
                        height={300}
                        layout="responsive"
                        onLoad={handleLoad}
                    />
                </div>
            </>
        )
    } else {
        return <p className='text-center text-gray-500'>Sin imagen</p>
    }
}

function EditItemCard({ item, items, setItems, close }) {
    const [id, setID] = useState(item.id);
    const [equipo, setEquipo] = useState(item.equipo);
    const [marca, setMarca] = useState(item.marca);
    const [modelo, setModelo] = useState(item.modelo);
    const [ubicacion, setUbicacion] = useState(item.ubicacion);
    const [columnaDeLocalizacion, setcolumnaDeLocalizacion] = useState(item.columnadelocalizacion);
    const [tipo, setTipo] = useState(item.tipo);
    const [cantidad, setCantidad] = useState(item.cantidad);
    const [imgURL, setImgURL] = useState(item.imgurl);
    const [imgName, setImgName] = useState(item.imgname);
    const [observaciones, setObservaciones] = useState(item.observaciones);
    const [imgFile, setImgFile] = useState(null);

    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            //Si tiene imgurl y imgname debe eliminar la imagen anterior
            if (imgName != "" && imgFile != null) {
                const resStorage = await deleteImage(`images/${imgName}`);
                if (resStorage) {
                    toast('Su imagen asociada previa se eliminó correctamente.');
                    await uploadImage(imgFile)
                        .then(async (res) => {
                            if (res[0] === 1) {
                                setImgURL(res[1]);
                                setImgName(res[2]);
                                toast("Se ha insertado la imagen exitosamente")
                                const newData = {
                                    equipo,
                                    marca,
                                    modelo,
                                    ubicacion,
                                    columnadelocalizacion: columnaDeLocalizacion,
                                    tipo,
                                    cantidad,
                                    imgurl: res[1],
                                    imgname: res[2],
                                    observaciones
                                };
                                const sucess = await updateItem(id, newData);
                                if (sucess) {
                                    setItems(prevItems => prevItems.map(i => i.id === id ? { ...i, ...newData } : i));
                                    toast('El ítem se actualizó correctamente en la base de datos.');
                                    close();
                                } else {
                                    toast.error('Hubo un error al actualizar el ítem en la base de datos.');
                                }
                            } else {
                                toast.error("Hubo un error al insertar la nueva imagen.");
                            }
                        })
                } else {
                    toast.error('Hubo un error al eliminar su imagen asociada previa');
                }

                //si no solo debe llamar a uploadImage y luego usar updateLab
            } else if (imgFile != null && (imgURL == "" || imgName == "")) {

                await uploadImage(imgFile).then(async (res) => {
                    if (res[0] === 1) {
                        toast("Se ha insertado la imagen exitosamente.")
                        setImgURL(res[1]);
                        setImgName(res[2]);
                        const newData = {
                            equipo,
                            marca,
                            modelo,
                            ubicacion,
                            columnadelocalizacion: columnaDeLocalizacion,
                            tipo,
                            cantidad,
                            imgurl: res[1],
                            imgname: res[2],
                            observaciones
                        };
                        const success = updateItem(id, newData);
                        if (success) {
                            setItems(prevItems => prevItems.map(i => i.id === id ? { ...i, ...newData } : i));
                            toast('El ítem se actualizó correctamente en la base de datos.');
                            close();
                        } else {
                            toast.error('Hubo un error al actualizar el ítem en la base de datos.');
                        }

                    }
                }
                )
            } else if (imgFile == null) {

                const newData = {
                    equipo,
                    marca,
                    modelo,
                    ubicacion,
                    columnadelocalizacion: columnaDeLocalizacion,
                    tipo,
                    cantidad,
                    imgurl: imgURL,
                    imgname: imgName,
                    observaciones
                }
                const success = await updateItem(id, newData);
                if (success) {
                    setItems(prevItems => prevItems.map(i => i.id === id ? { ...i, ...newData } : i));
                    toast('El ítem se actualizó correctamente en la base de datos.');
                    close();
                } else {
                    toast.error('Hubo un error al actualizar el ítem en la base de datos.');
                }
            }
        } catch (error) {
            console.error(error.message);
        }

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
                        <Button startIcon={<ArrowBackIcon />} className={FormStyles.backBtn} onClick={handleClose}>Atrás </Button>
                        <h2>Opciones</h2>
                    </div>
                    {setImg(item, setImgURL, setImgName, setItems)}
                    <br></br>
                    <form className={FormStyles.form}>
                        <label>
                            Equipo:
                        </label>
                        <input type="text" name="equipo" value={equipo} onChange={(e) => setEquipo(e.target.value)} placeholder='Ingresar...' />
                        <label>Marca:</label>
                        <input type="text" name="marca" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder='Ingresar...' />
                        <label>
                            Modelo:
                        </label>
                        <input type="text" name="modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder='Ingresar...' />
                        <label>
                            Ubicacion:
                        </label>
                        <input type="text" name="ubicacion" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder='Ingresar...' />
                        <label>
                            Columna de localizacion:
                        </label>
                        <input type="text" name="columnaDeLocalizacion" value={columnaDeLocalizacion} onChange={(e) => setcolumnaDeLocalizacion(e.target.value)} placeholder='Ingresar...' />
                        <label>
                            Tipo:
                        </label>
                        <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                            <option value="" disabled>Seleccionar tipo...</option>
                            <option value="Herramienta">Herramienta</option>
                            <option value="Suministro">Suministro</option>
                            <option value="Equipo">Equipo</option>
                            <option value="Mobiliario">Mobiliario</option>
                        </select>
                        <label>
                            Cantidad:
                        </label>
                        <input type="text" name="cantidad" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder='Ingresar...' />
                        <label>
                            Observaciones:
                        </label>
                        <input type="text" name="observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder='Ingresar...' />
                    </form>
                    <Uploader setImgFile={setImgFile} setImgURL={setImgURL} setImgName={setImgName}></Uploader>
                    <div className={FormStyles.btnsContainer}>
                        <Button onClick={close}>Cancelar</Button>
                        <Button onClick={handleSubmit}>Guardar cambios</Button>
                    </div>
                </Box>
            </Modal>
        </div>
    );
}


function DeleteItemCard({ item, close, setItems }) {
    const [idItem, setIdItem] = useState(item.id);
    const [imgURL, setImgURL] = useState(item.imgname);
    const handleSubmit = async (event) => {
        event.preventDefault();

        try {
            if (item.imgname != '') {
                const resStorage = await deleteImage(`images/${item.imgname}`);
                if (resStorage) {
                    toast('La imagen asociada se eliminó correctamente.');
                    const resFireStore = await deleteItem(idItem);
                    if (resFireStore) {
                        toast('El ítem se eliminó correctamente.');
                        setItems(prevItems => prevItems.filter(i => i.id !== idItem));
                        close();
                    } else {
                        toast.error('Hubo un error al eliminar el ítem.');
                    }
                } else {
                    toast.error('Hubo un error al eliminar la imagen asociada al ítem.');
                }

            } else {
                const resFireStore = await deleteItem(idItem);
                if (resFireStore) {
                    toast('El ítem se eliminó correctamente.');
                    setItems(prevItems => prevItems.filter(i => i.id !== idItem));
                    close();
                } else {
                    toast.error('Hubo un error al eliminar el ítem.');
                }
            }
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
                        <h2>Eliminar ítem</h2>
                    </div>
                    <Typography id="modal-modal-description" sx={{ mt: 2 }}>
                        ¿Está seguro que desesa eliminar el ítem?
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




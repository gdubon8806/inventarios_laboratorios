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

import updateItem from './firebaseStuff/update-item';
import { uploadImage } from './firebaseStuff/uploadImages';
import deleteItem from './firebaseStuff/delete-item';
import deleteImage from './firebaseStuff/delete-blob';
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
                    <EditItemCard item={item} items={items} setItems={setItems} handleRefresh={handleRefresh} close={handleClose} />
                    <DeleteItemCard item={item} close={handleClose} handleRefresh={handleRefresh} startIcon={<DeleteIcon />} />
                </Box>
            </Modal>
        </div >
    );
}


function setImg(item, setImgUrl, setImgName, handleRefresh, close) {
    const [loading, setLoading] = useState(true);

    const handleLoad = () => {
        setLoading(false);
    };

    async function deleteImg() {
        if (item.imgname != '') {
            const resStorage = await deleteImage(`images/${item.imgname}`);
            if (resStorage) {
                toast('¡Su imagen asociada se eliminó correctamente tambien!');
            } else {
                toast.error('¡Hubo un error al eliminar su imagen asociada!');
            }
            setImgUrl("");
            setImgName("");
            const id = item.id;
            const newData = {
                imgurl: "",
                imgname: ""
            };
            const resultado = await updateItem(id, newData);
            if (resultado) {
                toast('¡El ítem se actualizó correctamente!');
            } else {
                toast.error('¡Hubo un error al actualizar el ítem!');
            }
            handleRefresh();
            close();
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

function EditItemCard({ item, items, setItems, handleRefresh, close }) {
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
                    toast('¡Su imagen asociada previa se eliminó correctamente!');
                } else {
                    toast.error('¡Hubo un error al eliminar su imagen asociada previa!');
                }
                await uploadImage(imgFile)
                    .then(async (res) => {
                        if (res[0] === 1) {
                            setImgURL(res[1]);
                            setImgName(res[2]);
                            toast("¡Se ha insertado la imagen exitosamente!")
                            const newData = {
                                equipo,
                                marca,
                                modelo,
                                ubicacion,
                                columnadelocalizacion: columnaDeLocalizacion,
                                tipo,
                                cantidad,
                                imgurl: res[1], //aqui no mando a llamar con state porque no me da los datos que recien supuestamente actualice
                                imgname: res[2],
                                observaciones
                            };
                            updateItem(id, newData);
                        }
                    })
                //si no solo debe llamar a uploadImage y luego usar updateLab
            } else if (imgFile != null && (imgURL == "" || imgName == "")) {

                await uploadImage(imgFile).then(async (res) => {
                    if (res[0] === 1) {
                        toast("¡Se ha insertado la imagen exitosamente!")
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
                            imgurl: res[1], //aqui no mando a llamar con state porque no me da los datos que recien supuestamente actualice
                            imgname: res[2],
                            observaciones
                        };
                        updateItem(id, newData);

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
                updateItem(id, newData);
            }
            handleRefresh();
            close();
        } catch (error) {
            console.error(error.message);
        }
        handleRefresh();
        close();

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
                    {setImg(item, setImgURL, setImgName, handleRefresh, close)}
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
                        <option value="" disabled selected>Seleccionar tipo...</option>
                            <option value="Herramienta">Herramienta</option>
                            <option value="Suministro">Suministro</option>
                            <option value="Equipo">Equipo</option>
                            <option value="Mobiliario">Mobiliario</option>
                        </select><label>
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


function DeleteItemCard({ item, close, handleRefresh }) {
    const [idItem, setIdItem] = useState(item.id);
    const [imgURL, setImgURL] = useState(item.imgname);
    const handleSubmit = async (event) => {
        event.preventDefault();

        try {
            const resFireStore = await deleteItem(idItem);
            if (resFireStore) {
                toast('¡El ítem se eliminó correctamente!');
            } else {
                toast.error('¡Hubo un error al eliminar el ítem!');
            }

            if (item.imgname != '') {
                const resStorage = await deleteImage(`images/${item.imgname}`);
                if (resStorage) {
                    toast('¡La imagen asociada se eliminó correctamente tambien!');
                } else {
                    toast.error('¡Hubo un error al eliminar la imagen asociada al ítem!');
                }
                // Limpiar el campo del formulario después de la eliminación exitosa
            }
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




import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Modal from '@mui/material/Modal';
import DeleteIcon from '@mui/icons-material/Delete';
import ModeEditIcon from '@mui/icons-material/ModeEdit';
// import { useUser } from '@auth0/nextjs-auth0/client';


import Uploader from './uploader/uploader'
import toast from 'react-hot-toast';
import Image from 'next/image';

import updateLab from './firebase/update-lab';
import { deactivateLab } from './firebase/delete-lab';
import { uploadImage } from './firebase/uploadImages';

import { useState } from 'react';

import FormStyles from '../styles/Form.module.css'
import deleteImage from './firebase/delete-blob';


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

export default function OptionsLabCard({ lab, setLaboratories, role }) {
    const [open, setOpen] = React.useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    // Solo renderiza el botón si el usuario es admin
    if (role !== 'admin') return null;

    return (
        <div>
            <Button onClick={handleOpen}>Opciones</Button>
            <Modal
                open={open}
                onClose={handleClose}
                aria-labelledby="modal-modal-title"
                aria-describedby="modal-modal-description"
            >
                <Box sx={style}>
                    <div className={FormStyles.headerForm}>
                        <Button startIcon={<ArrowBackIcon />} className={FormStyles.backBtn} onClick={handleClose}>Atrás</Button>
                        <h2>Opciones de laboratorio</h2>
                    </div>
                    <EditLabCard lab={lab} close={handleClose} setLaboratories={setLaboratories} />
                    <DeleteLabCard lab={lab} close={handleClose} setLaboratories={setLaboratories} />
                </Box>
            </Modal>
        </div >
    );
}

function EditLabCard({ lab, close, setLaboratories }) {
    const [id, useID] = useState(lab.id);
    const [name, setName] = useState(lab.name);
    const [description, setDescription] = useState(lab.description);
    const [ubicacion, setUbicacion] = useState(lab.ubicacion ?? '');
    const [imgurl, setImgURL] = useState(lab.imgurl);
    const [imgname, setImgName] = useState(lab.imgname);
    const [imgFile, setImgFile] = useState(null);

    const [open, setOpen] = React.useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            //Si tiene imgurl y imgname debe eliminar la imagen anterior
            if (imgname != "" && imgFile != null) {
                const resStorage = await deleteImage(`images/${imgname}`);
                if (resStorage) {
                    toast('¡Su imagen asociada previa se eliminó correctamente!');
                    await uploadImage(imgFile)
                        .then(async (res) => {
                            if (res[0] === 1) {
                                setImgURL(res[1]);
                                setImgName(res[2]);
                                toast("¡Se ha insertado la imagen exitosamente!")
                                const newData = {
                                    name,
                                    description,
                                    ubicacion: ubicacion.trim(),
                                    imgurl: res[1], //aqui no mando a llamar con state porque no me da los datos que recien supuestamente actualice
                                    imgname: res[2],
                                };
                                const success = await updateLab(id, newData);
                                if (success) {
                                    // Actualiza el estado de los laboratorios en el componente padre
                                    setLaboratories(prevLabs => prevLabs.map(l => l.id === id ? { ...l, ...newData } : l));
                                    toast("Se ha actualizado la información del laboratorio exitosamente");
                                    close();
                                } else {
                                    toast.error('Hubo un error al actualizar la información del laboratorio.');
                                }

                            }
                        })
                } else {
                    toast.error('Hubo un error al eliminar la imagen asociada previa, no se actualizó la información del laboratorio.');
                }

                //si no solo debe llamar a uploadImage y luego usar updateLab
            } else if (imgFile != null && (imgurl == "" || imgname == "")) {

                await uploadImage(imgFile).then(async (res) => {
                    if (res[0] === 1) {
                        toast("¡Se ha insertado la imagen exitosamente!")
                        setImgURL(res[1]);
                        setImgName(res[2]);
                        const newData = {
                            name,
                            description,
                            ubicacion: ubicacion.trim(),
                            imgurl: res[1],
                            imgname: res[2],
                        };
                        const success = await updateLab(id, newData);
                        if (success) {
                            // Actualiza el estado de los laboratorios en el componente padre
                            setLaboratories(prevLabs => prevLabs.map(l => l.id === id ? { ...l, ...newData } : l));
                            toast("Se ha actualizado la información del laboratorio exitosamente");
                            close();
                        } else {
                            toast.error('Hubo un error al actualizar la información del laboratorio.');
                        }

                    }
                }
                )
            } else if (imgFile == null) {
                const newData = {
                    name,
                    description,
                    ubicacion: ubicacion.trim(),
                    imgurl: imgurl,
                    imgname: imgname,
                };
                const success = await updateLab(id, newData);
                if (success) {
                    // Actualiza el estado de los laboratorios en el componente padre
                    setLaboratories(prevLabs => prevLabs.map(l => l.id === id ? { ...l, ...newData } : l));
                    toast("Se ha actualizado la información del laboratorio exitosamente");
                    close();

                } else {
                    toast.error('Hubo un error al actualizar la información del laboratorio.');
                }
            }
        } catch (error) {
            console.error(error.message);
        }
    };
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
                    <div>
                        <div className={FormStyles.editLabFormContainer}>
                            <div className={FormStyles.headerForm}>
                                <Button startIcon={<ArrowBackIcon />} className={FormStyles.backBtn} onClick={close}>Atrás</Button>
                                <h2>Editar laboratorio</h2>
                                <h2 className={FormStyles.headerForm}>Editar datos</h2>
                            </div>
                            {setImg(lab, setImgURL, setImgName, setLaboratories, handleClose)}
                            <br />
                            <form className={FormStyles.form}>
                                <label>
                                    Nombre:
                                </label>
                                <input type="text" name="nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder='Ingresar nombre...' />
                                <label>Descripción:</label>
                                <input type="text" name="descripcion" value={description} onChange={(e) => setDescription(e.target.value)} placeholder='Ingresar detalles...' />
                                <label>Ubicación:</label>
                                <input type="text" name="ubicacion" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder='Ej. Edificio B, 2.º piso...' />
                            </form>
                        </div >
                        <Uploader setImgFile={setImgFile} setImgURL={setImgURL} setImgName={setImgName}></Uploader>
                        <div className={FormStyles.btnsContainer}>
                            {/* <DeleteLabCard lab={lab} close={close} handleRefresh={handleRefresh} /> */}
                            <Button onClick={close}>Cancelar</Button>
                            <Button onClick={handleSubmit}>Guardar cambios</Button>
                        </div>
                    </div >
                </Box>
            </Modal>
        </div>
    )
}

// BAJA LÓGICA del laboratorio (plan D3/D14): el laboratorio pasa a la papelera (/bajas) y puede restaurarse.
// NO se borra su imagen del storage (solo se borraría en la eliminación definitiva desde la papelera)
// y sus artículos quedan ocultos mientras el laboratorio esté dado de baja.
// Motivo obligatorio (mínimo 5 caracteres).
function DeleteLabCard({ lab, close, setLaboratories }) {
    const [motivo, setMotivo] = useState('');
    const [busy, setBusy] = useState(false);
    const motivoValido = motivo.trim().length >= 5;

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!motivoValido) {
            toast.error('Escribe el motivo de la baja (mínimo 5 caracteres).');
            return;
        }
        setBusy(true);
        try {
            await deactivateLab(lab.id, motivo.trim());
            toast('El laboratorio se dio de baja. Puedes restaurarlo desde la papelera.');
            setLaboratories(prevLabs => prevLabs.filter(l => l.id !== lab.id));
            close();
        } catch (error) {
            console.error(error.message);
            toast.error('¡Hubo un error al dar de baja el laboratorio!');
        } finally {
            setBusy(false);
        }
    };

    const [open, setOpen] = React.useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    return (
        <div className={FormStyles.deleteBtnContainer}>
            <Button onClick={handleOpen} startIcon={<DeleteIcon />}>
                Dar de baja
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
                        <h2>Dar de baja el laboratorio</h2>
                    </div>
                    <Typography id="modal-modal-description" sx={{ mt: 2 }}>
                        ¿Está seguro que desea dar de baja el laboratorio «{lab.name}»?
                        Pasará a la papelera (se puede restaurar) y sus artículos quedarán ocultos mientras tanto.
                        No se borra ninguna imagen ni dato.
                    </Typography>
                    <TextField
                        sx={{ mt: 2 }}
                        fullWidth
                        label="Motivo de la baja (obligatorio)"
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        error={motivo.length > 0 && !motivoValido}
                        helperText="Mínimo 5 caracteres"
                    />
                    <div className={FormStyles.buttonsContainer}>
                        <Button onClick={handleClose} disabled={busy}>Cancelar</Button>
                        <Button onClick={handleSubmit} disabled={busy || !motivoValido}>Confirmar</Button>
                    </div>
                </Box>
            </Modal>
        </div>
    );
}

function setImg(lab, setImgUrl, setImgName, setLaboratories, close) {
    const [loading, setLoading] = useState(true);

    const handleLoad = () => {
        setLoading(false);
    };

    async function deleteImg() {
        if (lab.imgname != '') {
            const resStorage = await deleteImage(`images/${lab.imgname}`);
            if (resStorage) {
                toast('Imagen asociada se eliminó exitosamente de la base de datos.');
                setImgUrl("");
                setImgName("");
                const labId = lab.id;
                const newData = {
                    imgurl: "", //no se usa el valor de state porque no me da el valor actualizado
                    imgname: "" //no se usa el valor de state porque no me da el valor actualizado
                };
                const success = await updateLab(labId, newData);
                if (success) {
                    toast('El laboratorio se actualizó correctamente en la base de datos.');
                    setLaboratories(prevLabs => prevLabs.map(l => l.id === labId ? { ...l, ...newData } : l));
                } else {
                    toast.error('Hubo un error al actualizar el laboratorio en la base de datos.');
                }
                
            } else {
                toast.error('Hubo un error al eliminar su imagen asociada en la base de datos.');
            }

        }
    }

    if (lab.imgurl !== '') {
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
                            }}                        >
                            Cargando imagen...
                        </div>
                    )}
                    <Image
                        src={lab.imgurl}
                        alt="Imagen de laboratorio"
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
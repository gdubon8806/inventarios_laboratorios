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
import { deactivateItem } from './firebase/delete-item';
import deleteImage from './firebase/delete-blob';
import { TIPOS, esTipoValido, tieneUnidades } from '../lib/constants/tipos';
import { Timestamp } from 'firebase/firestore';
import Alert from '@mui/material/Alert';
import { parseCantidad } from '../lib/codes/thresholds';
import { ESTADOS } from '../lib/codes/prefixes';
import { validarVencimiento, valorAFechaInput } from '../lib/validation/vencimiento';
import { VencimientoFields, InsumoFields, UnidadesNota } from './ItemFields';
import { QuantityDialog } from './QuantityDialogs';
import ChangeTypeDialog from './ChangeTypeDialog';
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

// Un registro necesita corrección si no tiene tipo válido o su cantidad no es válida (datos incongruentes):
// solo en ese caso el tipo y la cantidad se pueden escribir directamente. En los demás el tipo es INMUTABLE
// (se cambia con el proceso «Cambiar tipo…») y la cantidad se cambia con «Cambiar cantidad…».
export function necesitaCorreccion(item) {
    return !!item.requiereValidacion || !esTipoValido(item.tipo) || !parseCantidad(item.cantidad).ok;
}

export default function OptionsItemCard({ item, items, setItems, handleRefresh, user }) {
    const [open, setOpen] = React.useState(false);
    const [openQuantity, setOpenQuantity] = React.useState(false);
    const [openType, setOpenType] = React.useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);
    const corregir = necesitaCorreccion(item);

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
                    <EditItemCard item={item} items={items} setItems={setItems} close={handleClose} handleRefresh={handleRefresh} />
                    {!corregir && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem' }}>
                            <Button variant="outlined" onClick={() => setOpenQuantity(true)}>Cambiar cantidad…</Button>
                            <Button variant="outlined" color="warning" onClick={() => setOpenType(true)}>Cambiar tipo…</Button>
                        </div>
                    )}
                    <DeleteItemCard item={item} close={handleClose} setItems = {setItems} startIcon={<DeleteIcon />} />
                    <QuantityDialog open={openQuantity} onClose={() => setOpenQuantity(false)} registro={item} user={user} onDone={() => { handleRefresh?.(); }} />
                    <ChangeTypeDialog open={openType} onClose={() => setOpenType(false)} registro={item} user={user} onDone={() => { handleClose(); handleRefresh?.(); }} />
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
                try {
                    await updateItem(id, newData);
                    toast('El ítem se actualizó exitosamente en la base de datos.');
                    setItems(prevItems => prevItems.map(i => i.id === id ? { ...i, ...newData } : i));
                } catch (error) {
                    toast.error(`Hubo un error al actualizar el ítem. ${error.message || ''}`);
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

function EditItemCard({ item, items, setItems, close: closeOptions, handleRefresh }) {
    const id = item.id;
    const corregir = necesitaCorreccion(item);
    const esInsumo = item.tipo === 'Suministro';

    const [equipo, setEquipo] = useState(item.equipo ?? '');
    const [marca, setMarca] = useState(item.marca ?? '');
    const [modelo, setModelo] = useState(item.modelo ?? '');
    const [ubicacion, setUbicacion] = useState(item.ubicacion ?? '');
    const [columnaDeLocalizacion, setcolumnaDeLocalizacion] = useState(item.columnadelocalizacion ?? '');
    const [tipo, setTipo] = useState(item.tipo ?? '');
    const [cantidad, setCantidad] = useState(item.cantidad ?? '');
    const [imgURL, setImgURL] = useState(item.imgurl);
    const [imgName, setImgName] = useState(item.imgname);
    // Los datos viejos pueden traer observaciones como arreglo: se muestran como texto sin perder contenido
    const [observaciones, setObservaciones] = useState(
        Array.isArray(item.observaciones) ? item.observaciones.join('\n') : (item.observaciones ?? '')
    );
    const [numeroSerie, setNumeroSerie] = useState(item.numeroSerie ?? '');
    const [codigoFundaempresa, setCodigoFundaempresa] = useState(item.codigoFundaempresa ?? '');
    const [estado, setEstado] = useState(item.estado ?? 'bueno');
    const [tieneVencimiento, setTieneVencimiento] = useState(!!item.tieneVencimiento);
    const [fechaVencimiento, setFechaVencimiento] = useState(valorAFechaInput(item.fechaVencimiento));
    const [imgFile, setImgFile] = useState(null);
    const [busy, setBusy] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (equipo.trim().length < 1) { toast.error('El nombre del equipo no puede quedar vacío.'); return; }
        const venc = validarVencimiento({ tieneVencimiento, fecha: fechaVencimiento });
        if (!venc.ok) { toast.error(venc.error); return; }
        if (corregir) {
            if (!tipo) { toast.error('Selecciona el tipo del registro.'); return; }
            const c = parseCantidad(cantidad);
            if (!c.ok) { toast.error(`Cantidad inválida: ${c.motivo}.`); return; }
        }
        setBusy(true);
        try {
            let imgurl = imgURL;
            let imgname = imgName;
            if (imgFile != null) {
                //Si tiene imgurl y imgname debe eliminar la imagen anterior
                if (imgName) {
                    const resStorage = await deleteImage(`images/${imgName}`);
                    if (!resStorage) { toast.error('Hubo un error al eliminar su imagen asociada previa'); return; }
                    toast('Su imagen asociada previa se eliminó correctamente.');
                }
                const res = await uploadImage(imgFile);
                if (res[0] !== 1) { toast.error("Hubo un error al insertar la nueva imagen."); return; }
                imgurl = res[1];
                imgname = res[2];
                setImgURL(imgurl);
                setImgName(imgname);
                toast("Se ha insertado la imagen exitosamente");
            }
            const newData = {
                equipo: equipo.trim(),
                marca,
                modelo,
                ubicacion,
                columnadelocalizacion: columnaDeLocalizacion,
                imgurl,
                imgname,
                observaciones,
                tieneVencimiento,
                fechaVencimiento: venc.fecha ? Timestamp.fromDate(venc.fecha) : null,
            };
            // El tipo y la cantidad solo se escriben aquí cuando el registro necesita corrección (datos incongruentes).
            if (corregir) {
                newData.tipo = tipo;
                newData.cantidad = cantidad;
            }
            if (esInsumo) {
                newData.numeroSerie = numeroSerie;
                newData.codigoFundaempresa = codigoFundaempresa;
                newData.estado = estado;
            }
            // updateItem lanza el error si falla (antes devolvía false y se perdía el motivo)
            await updateItem(id, newData);
            toast('El ítem se actualizó correctamente en la base de datos.');
            if (handleRefresh) handleRefresh();
            else setItems(prevItems => prevItems.map(i => i.id === id ? { ...i, ...newData } : i));
            handleClose();
        } catch (error) {
            console.error(error.message);
            toast.error(`Hubo un error al actualizar el ítem. ${error.message || ''}`);
        } finally {
            setBusy(false);
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
                        <h2>Editar ítem</h2>
                    </div>
                    {corregir && (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            Datos incongruentes{item.motivoValidacion ? `: ${item.motivoValidacion}` : ''}. Corrige el tipo y la cantidad para que el registro pueda recibir código.
                        </Alert>
                    )}
                    {setImg(item, setImgURL, setImgName, setItems)}
                    <br></br>
                    <form className={FormStyles.form} onSubmit={(e) => e.preventDefault()}>
                        <label>Código:</label>
                        <input type="text" name="codigo" value={item.codigo ?? (tieneUnidades(item.tipo) ? 'Un código por unidad (ver tabla de unidades)' : 'Sin código todavía')} readOnly disabled />
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
                        <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} disabled={!corregir}>
                            <option value="" disabled>Seleccionar tipo...</option>
                            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <label>
                            Cantidad:
                        </label>
                        <input type="text" name="cantidad" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder='Ingresar...' readOnly={!corregir} disabled={!corregir} />
                        {!corregir && (
                            <p style={{ gridColumn: '1 / -1', fontSize: '0.85rem', color: '#555', margin: 0 }}>
                                El tipo y la cantidad no se editan aquí: usa «Cambiar tipo…» y «Cambiar cantidad…» (regeneran códigos y unidades).
                            </p>
                        )}
                        {esInsumo
                            ? <>
                                <InsumoFields serie={numeroSerie} setSerie={setNumeroSerie} fundaempresa={codigoFundaempresa} setFundaempresa={setCodigoFundaempresa} />
                                <label>Estado:</label>
                                <select name="estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
                                    {ESTADOS.map((s) => <option key={s} value={s}>{s === 'reparacion' ? 'En reparación' : s === 'malo' ? 'Malo' : 'Bueno'}</option>)}
                                </select>
                            </>
                            : tieneUnidades(item.tipo) && <UnidadesNota />}
                        <VencimientoFields tiene={tieneVencimiento} setTiene={setTieneVencimiento} fecha={fechaVencimiento} setFecha={setFechaVencimiento} />
                        <label>
                            Observaciones{tieneUnidades(item.tipo) ? ' generales' : ''}:
                        </label>
                        <input type="text" name="observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder='Ingresar...' />
                    </form>
                    <Uploader setImgFile={setImgFile} setImgURL={setImgURL} setImgName={setImgName}></Uploader>
                    <div className={FormStyles.btnsContainer}>
                        <Button onClick={handleClose} disabled={busy}>Cancelar</Button>
                        <Button onClick={handleSubmit} disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</Button>
                    </div>
                </Box>
            </Modal>
        </div>
    );
}


// "Eliminar" ahora es BAJA LÓGICA: el ítem pasa a la papelera (/bajas) y se puede restaurar.
// Ya NO se borra la imagen de Storage (solo se borra al eliminar definitivamente desde la papelera).
function DeleteItemCard({ item, close, setItems }) {
    const [idItem, setIdItem] = useState(item.id);
    const [motivo, setMotivo] = useState('');
    const handleSubmit = async (event) => {
        event.preventDefault();
        if (motivo.trim().length < 5) {
            toast.error('Indica el motivo de la baja (mínimo 5 caracteres).');
            return;
        }
        try {
            await deactivateItem(idItem, motivo);
            toast('El ítem se dio de baja correctamente. Puedes restaurarlo desde la papelera.');
            setItems(prevItems => prevItems.filter(i => i.id !== idItem));
            close();
        } catch (error) {
            console.error(error.message);
            toast.error(`Hubo un error al dar de baja el ítem. ${error.message || ''}`);
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
                        <h2>Dar de baja ítem</h2>
                    </div>
                    <Typography id="modal-modal-description" sx={{ mt: 2 }}>
                        ¿Está seguro que desea dar de baja el ítem? Pasará a la papelera y podrá restaurarse.
                    </Typography>
                    <form className={FormStyles.form}>
                        <label>Motivo de la baja (obligatorio):</label>
                        <input type="text" name="motivoBaja" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder='Ej.: dañado, perdido, traslado...' />
                    </form>
                    <div className={FormStyles.buttonsContainer}>
                        <Button onClick={handleClose}>Cancelar</Button>
                        <Button onClick={handleSubmit}>Confirmar</Button>
                    </div>
                </Box>
            </Modal>
        </div>
    );
}




import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TuneIcon from '@mui/icons-material/Tune';
import ModeEditIcon from '@mui/icons-material/ModeEdit';
import DeleteIcon from '@mui/icons-material/Delete';
import toast from 'react-hot-toast';

import Uploader from './uploader/uploader';
import updateLab from './firebase/update-lab';
import { deactivateLab } from './firebase/delete-lab';
import { uploadImage } from './firebase/uploadImages';
import deleteImage from './firebase/delete-blob';

import { useState } from 'react';

// Botón «Opciones» del laboratorio (solo admin): Editar y Dar de baja, con el mismo diseño que las opciones de un registro.
export default function OptionsLabCard({ lab, setLaboratories, role }) {
    const [open, setOpen] = React.useState(false);
    const [openEdit, setOpenEdit] = React.useState(false);
    const [openDelete, setOpenDelete] = React.useState(false);
    const handleClose = () => setOpen(false);

    // Solo renderiza el botón si el usuario es admin
    if (role !== 'admin') return null;

    const btn = { justifyContent: 'flex-start', py: 1.1, textTransform: 'none', fontSize: '.95rem' };
    const abrir = (fn) => () => { handleClose(); fn(); };

    return (
        <div style={{ flex: 1, minWidth: 0 }}>
            <Button fullWidth size="small" variant="outlined" startIcon={<TuneIcon fontSize="small" />} onClick={() => setOpen(true)}>Opciones</Button>
            <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderBottom: '1px solid #e0e0e0' }}>
                    <Button startIcon={<ArrowBackIcon />} size="small" variant="outlined" onClick={handleClose}>Atrás</Button>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2, minWidth: 0, wordBreak: 'break-word' }}>Opciones · {lab.name}</Typography>
                </Box>
                <Box sx={{ display: 'grid', gap: 1, p: 1.5 }}>
                    <Button fullWidth variant="contained" sx={btn} startIcon={<ModeEditIcon />} onClick={abrir(() => setOpenEdit(true))}>Editar</Button>
                    <Button fullWidth variant="outlined" color="error" sx={btn} startIcon={<DeleteIcon />} onClick={abrir(() => setOpenDelete(true))}>Dar de baja</Button>
                </Box>
            </Dialog>
            <EditLabCard lab={lab} open={openEdit} close={() => setOpenEdit(false)} setLaboratories={setLaboratories} />
            <DeleteLabCard lab={lab} open={openDelete} close={() => setOpenDelete(false)} setLaboratories={setLaboratories} />
        </div>
    );
}

// Edición del laboratorio: imagen a un lado y los datos al otro (igual que el registro).
function EditLabCard({ lab, open, close, setLaboratories }) {
    const fullScreen = useMediaQuery('(max-width:700px)');
    const [name, setName] = useState(lab.name ?? '');
    const [description, setDescription] = useState(lab.description ?? '');
    const [ubicacion, setUbicacion] = useState(lab.ubicacion ?? '');
    const [imgurl, setImgURL] = useState(lab.imgurl ?? '');
    const [imgname, setImgName] = useState(lab.imgname ?? '');
    const [imgFile, setImgFile] = useState(null);
    const [busy, setBusy] = useState(false);

    const quitarImagen = async () => {
        if (imgname) {
            const ok = await deleteImage(`images/${imgname}`);
            if (!ok) { toast.error('No se pudo eliminar la imagen.'); return; }
        }
        const newData = { imgurl: '', imgname: '' };
        const success = await updateLab(lab.id, newData);
        if (!success) { toast.error('No se pudo actualizar el laboratorio.'); return; }
        setImgURL(''); setImgName(''); setImgFile(null);
        setLaboratories((prev) => prev.map((l) => (l.id === lab.id ? { ...l, ...newData } : l)));
        toast('Imagen eliminada.');
    };

    const guardar = async () => {
        if (name.trim().length < 1) { toast.error('El nombre no puede quedar vacío.'); return; }
        setBusy(true);
        try {
            let url = imgurl;
            let nombreImg = imgname;
            if (imgFile != null) {
                if (imgname) {
                    const ok = await deleteImage(`images/${imgname}`);
                    if (!ok) { toast.error('No se pudo eliminar la imagen anterior; no se guardó nada.'); return; }
                }
                const res = await uploadImage(imgFile);
                if (res[0] !== 1) { toast.error('No se pudo subir la imagen nueva.'); return; }
                url = res[1]; nombreImg = res[2];
                setImgURL(url); setImgName(nombreImg); setImgFile(null);
            }
            const newData = { name: name.trim(), description, ubicacion: ubicacion.trim(), imgurl: url, imgname: nombreImg };
            const success = await updateLab(lab.id, newData);
            if (success) {
                setLaboratories((prev) => prev.map((l) => (l.id === lab.id ? { ...l, ...newData } : l)));
                toast('Laboratorio actualizado.');
                close();
            } else {
                toast.error('No se pudo actualizar el laboratorio.');
            }
        } catch (error) {
            console.error(error.message);
            toast.error('No se pudo guardar el laboratorio.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={!!open} onClose={busy ? undefined : close} fullScreen={fullScreen} fullWidth maxWidth="md">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1.25, bgcolor: '#EEF3FB' }}>
                <Button startIcon={<ArrowBackIcon />} size="small" variant="outlined" onClick={close} disabled={busy}>Atrás</Button>
                <Typography variant="h6" sx={{ fontSize: '1.1rem' }}>Editar laboratorio</Typography>
            </Box>
            <Box sx={{ p: { xs: 1.5, sm: 3 }, display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'minmax(240px, 340px) 1fr' }, alignItems: 'start' }}>
                <Box>
                    <Box sx={{ borderRadius: '16px', overflow: 'hidden', bgcolor: '#EEF3FB', aspectRatio: '4 / 3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {imgurl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imgurl} alt={lab.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : <Typography variant="body2" color="text.secondary">Sin imagen</Typography>}
                    </Box>
                    {imgurl && <Button size="small" color="error" onClick={quitarImagen} sx={{ mt: 1 }}>Quitar imagen</Button>}
                    <Box sx={{ mt: 1 }}>
                        <Uploader setImgFile={setImgFile} setImgURL={setImgURL} setImgName={setImgName} />
                    </Box>
                </Box>
                <Box sx={{ bgcolor: '#F1F5FC', borderRadius: '16px', p: 2.25, display: 'grid', gap: 1.75 }}>
                    <TextField size="small" fullWidth label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
                    <TextField size="small" fullWidth multiline minRows={2} label="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
                    <TextField size="small" fullWidth label="Ubicación" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} />
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        <Button onClick={close} disabled={busy}>Cancelar</Button>
                        <Button variant="contained" onClick={guardar} disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</Button>
                    </Box>
                </Box>
            </Box>
        </Dialog>
    );
}

// BAJA LÓGICA del laboratorio (plan D3/D14): el laboratorio pasa a la papelera (/bajas) y puede restaurarse.
// NO se borra su imagen del storage (solo se borraría en la eliminación definitiva desde la papelera)
// y sus artículos quedan ocultos mientras el laboratorio esté dado de baja.
// Motivo obligatorio (mínimo 5 caracteres).
function DeleteLabCard({ lab, open, close, setLaboratories }) {
    const [motivo, setMotivo] = useState('');
    const [busy, setBusy] = useState(false);
    const motivoValido = motivo.trim().length >= 5;

    const handleSubmit = async () => {
        if (!motivoValido) {
            toast.error('Escribe el motivo de la baja (mínimo 5 caracteres).');
            return;
        }
        setBusy(true);
        try {
            await deactivateLab(lab.id, motivo.trim());
            toast('El laboratorio se dio de baja. Puedes restaurarlo desde la papelera.');
            setLaboratories((prevLabs) => prevLabs.filter((l) => l.id !== lab.id));
            close();
        } catch (error) {
            console.error(error.message);
            toast.error('Hubo un error al dar de baja el laboratorio.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={!!open} onClose={busy ? undefined : close} fullWidth maxWidth="sm">
            <Box sx={{ p: { xs: 2, sm: 3 }, display: 'grid', gap: 2 }}>
                <Typography variant="h6">Dar de baja: {lab.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                    Pasará a la papelera (se puede restaurar) y sus artículos quedarán ocultos mientras tanto. No se borra ninguna imagen ni dato.
                </Typography>
                <TextField
                    size="small" fullWidth label="Motivo de la baja (obligatorio)" value={motivo} onChange={(e) => setMotivo(e.target.value)}
                    error={motivo.length > 0 && !motivoValido} helperText="Mínimo 5 caracteres"
                />
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    <Button onClick={close} disabled={busy}>Cancelar</Button>
                    <Button variant="contained" color="error" onClick={handleSubmit} disabled={busy || !motivoValido}>Confirmar baja</Button>
                </Box>
            </Box>
        </Dialog>
    );
}

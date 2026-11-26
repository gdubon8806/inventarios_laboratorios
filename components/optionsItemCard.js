import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TuneIcon from '@mui/icons-material/Tune';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ModeEditIcon from '@mui/icons-material/ModeEdit';
import DeleteIcon from '@mui/icons-material/Delete';
import toast from 'react-hot-toast';

import { deactivateItem } from './firebase/delete-item';
import { esTipoValido } from '../lib/constants/tipos';
import { parseCantidad } from '../lib/codes/thresholds';
import ChangeTypeDialog from './ChangeTypeDialog';

import { useState } from 'react';

// Un registro necesita corrección si no tiene tipo válido o su cantidad no es válida (datos incongruentes):
// solo en ese caso el tipo y la cantidad se pueden escribir directamente en el modo editar. En los demás el tipo es
// INMUTABLE desde la edición (se cambia con «Cambiar tipo») y la cantidad se cambia con el contador del modo editar.
export function necesitaCorreccion(item) {
    return !!item.requiereValidacion || !esTipoValido(item.tipo) || !parseCantidad(item.cantidad).ok;
}

// Botón «Opciones» de la tarjeta (solo admin). Tres opciones con el mismo diseño:
//   - Editar: abre el detalle en MODO EDITAR (datos generales, cantidad, unidades una por una y reportes).
//   - Cambiar tipo: aparte, porque implica cambiar el código y la etiqueta.
//   - Dar de baja.
// Tocar la tarjeta, en cambio, abre el detalle en modo solo ver.
export default function OptionsItemCard({ item, items, setItems, handleRefresh, user, onOpenDetail }) {
    const [open, setOpen] = React.useState(false);
    const [openDelete, setOpenDelete] = React.useState(false);
    const [openType, setOpenType] = React.useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);
    const corregir = necesitaCorreccion(item);

    const btn = { justifyContent: 'flex-start', py: 1.1, textTransform: 'none', fontSize: '.95rem' };
    const abrir = (fn) => () => { handleClose(); fn(); };

    return (
        <>
            <Button fullWidth size="small" variant="outlined" startIcon={<TuneIcon fontSize="small" />} onClick={handleOpen} sx={{ whiteSpace: 'nowrap', fontSize: '.75rem', px: 0.75, minWidth: 0 }}>Opciones</Button>
            <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderBottom: '1px solid #e0e0e0' }}>
                    <Button startIcon={<ArrowBackIcon />} size="small" variant="outlined" onClick={handleClose}>Atrás</Button>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2, minWidth: 0, wordBreak: 'break-word' }}>Opciones · {item.equipo}</Typography>
                </Box>
                <Box sx={{ display: 'grid', gap: 1, p: 1.5 }}>
                    <Button fullWidth variant="contained" sx={btn} startIcon={<ModeEditIcon />} onClick={abrir(() => onOpenDetail?.())}>Editar</Button>
                    {!corregir && <Button fullWidth variant="outlined" color="warning" sx={btn} startIcon={<SwapHorizIcon />} onClick={abrir(() => setOpenType(true))}>Cambiar tipo</Button>}
                    <Button fullWidth variant="outlined" color="error" sx={btn} startIcon={<DeleteIcon />} onClick={abrir(() => setOpenDelete(true))}>Dar de baja</Button>
                </Box>
            </Dialog>
            <DeleteItemCard item={item} open={openDelete} onClose={() => setOpenDelete(false)} setItems={setItems} />
            <ChangeTypeDialog open={openType} onClose={() => setOpenType(false)} registro={item} user={user} onDone={() => { handleRefresh?.(); }} />
        </>
    );
}


// "Eliminar" es BAJA LÓGICA: el ítem pasa a la papelera (/bajas) y se puede restaurar.
// Ya NO se borra la imagen de Storage (solo se borra al eliminar definitivamente desde la papelera).
function DeleteItemCard({ item, open, onClose, setItems }) {
    const [motivo, setMotivo] = useState('');
    const [busy, setBusy] = useState(false);
    const close = () => onClose?.();

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (motivo.trim().length < 5) {
            toast.error('Indica el motivo de la baja (mínimo 5 caracteres).');
            return;
        }
        setBusy(true);
        try {
            await deactivateItem(item.id, motivo);
            toast('El ítem se dio de baja correctamente. Puedes restaurarlo desde la papelera.');
            setItems((prevItems) => prevItems.filter((i) => i.id !== item.id));
            close();
        } catch (error) {
            console.error(error.message);
            toast.error(`Hubo un error al dar de baja el ítem. ${error.message || ''}`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={!!open} onClose={busy ? undefined : close} fullWidth maxWidth="sm">
            <Box sx={{ p: { xs: 2, sm: 3 }, display: 'grid', gap: 2 }}>
                <Typography variant="h6">Dar de baja: {item.equipo}</Typography>
                <Typography variant="body2" color="text.secondary">
                    El ítem pasará a la papelera y podrá restaurarse.
                </Typography>
                <TextField size="small" fullWidth label="Motivo de la baja (obligatorio, mínimo 5 caracteres)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    <Button onClick={close} disabled={busy}>Cancelar</Button>
                    <Button variant="contained" color="error" onClick={handleSubmit} disabled={busy || motivo.trim().length < 5}>Confirmar baja</Button>
                </Box>
            </Box>
        </Dialog>
    );
}

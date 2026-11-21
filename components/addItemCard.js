import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Modal from '@mui/material/Modal';
import AddIcon from '@mui/icons-material/Add';

import { useState } from 'react';
import Uploader from './uploader/uploader';
import toast from 'react-hot-toast';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Timestamp } from 'firebase/firestore';

import FormStyles from '../styles/Form.module.css'
import { createRecordWithCode } from './firebase/generate-code';
import { uploadImage } from './firebase/uploadImages';
import { TIPOS, tieneUnidades } from '../lib/constants/tipos';
import { checkQuantity, parseCantidad } from '../lib/codes/thresholds';
import { validarVencimiento } from '../lib/validation/vencimiento';
import { VencimientoFields, InsumoFields, UnidadesNota } from './ItemFields';
import { ThresholdConfirmDialog } from './QuantityDialogs';

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

// Alta de registros. Los registros nuevos NACEN CON CÓDIGO (autogenerado, nunca manual):
// Mobiliario/Equipo/Herramienta crean tantas unidades como la cantidad; Suministro lleva un código por registro.
// Props: idLab, onCreated() (refrescar la lista), setItems (compatibilidad; ya no se usa).
export default function AddItemCard({ setItems, idLab, onCreated }) {
    const [open, setOpen] = React.useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    return (
        <div>
            <Button variant="contained" onClick={handleOpen} startIcon={<AddIcon />}>Agregar</Button>
            <Modal
                open={open}
                onClose={handleClose}
                aria-labelledby="modal-modal-title"
                aria-describedby="modal-modal-description"
            >
                <Box sx={style}>
                    <AddItemForm idLab={idLab} close={handleClose} onCreated={onCreated} />
                </Box>
            </Modal>
        </div>
    );
}

function AddItemForm({ idLab, close, onCreated }) {
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
    const [observaciones, setObservaciones] = useState('');
    const [numeroSerie, setNumeroSerie] = useState('');
    const [codigoFundaempresa, setCodigoFundaempresa] = useState('');
    const [tieneVencimiento, setTieneVencimiento] = useState(false);
    const [fechaVencimiento, setFechaVencimiento] = useState('');
    const [busy, setBusy] = useState(false);
    const [confirmInfo, setConfirmInfo] = useState(null);

    const esInsumo = tipo === 'Suministro';

    // Valida todo ANTES de subir la imagen. Devuelve los datos listos o null (ya mostró el error).
    const validar = () => {
        if (equipo.trim().length < 1) { toast("¡Debes al menos escribir el nombre para agregar el ítem!"); return null; }
        if (!tipo) { toast.error('Selecciona el tipo: de él depende el código que se genera.'); return null; }
        const c = parseCantidad(cantidad);
        if (!c.ok) { toast.error(`Cantidad inválida: ${c.reason}.`); return null; }
        if (tieneUnidades(tipo) && c.value < 1) { toast.error('La cantidad debe ser al menos 1.'); return null; }
        const venc = validarVencimiento({ tieneVencimiento, fecha: fechaVencimiento });
        if (!venc.ok) { toast.error(venc.error); return null; }
        return { cantidad: c.value, venc };
    };

    const crear = async (confirmed) => {
        const v = validar();
        if (!v) return;
        const q = checkQuantity(tipo, v.cantidad);
        if (q.action !== 'ok' && !confirmed) {
            setConfirmInfo({ nombre: equipo.trim(), tipo, cantidad: v.cantidad, threshold: q.threshold, action: q.action });
            return;
        }
        setConfirmInfo(null);
        setBusy(true);
        try {
            let imgurl = imgURL;
            let imgname = imgName;
            if (imgFile != null) {
                const res = await uploadImage(imgFile);
                if (res[0] !== 1) {
                    toast.error("Ocurrió algo. No se pudo insertar la imagen en la base de datos.");
                    return;
                }
                imgurl = res[1];
                imgname = res[2];
            }
            const data = {
                equipo: equipo.trim(),
                marca,
                modelo,
                ubicacion,
                columnadelocalizacion: columnaDeLocalizacion,
                tipo,
                cantidad: v.cantidad,
                imgurl,
                imgname,
                observaciones,
                idLab,
                tieneVencimiento,
                fechaVencimiento: v.venc.fecha ? Timestamp.fromDate(v.venc.fecha) : null,
                ...(esInsumo ? { numeroSerie, codigoFundaempresa } : {}),
            };
            const res = await createRecordWithCode(data, { confirmed: true });
            if (res.status === 'created') {
                const detalle = tieneUnidades(tipo)
                    ? `${res.unidades} unidades con código (${res.codes[0]}…).`
                    : `Código ${res.codes[0]}.`;
                toast(`Se ha insertado el nuevo ítem. ${detalle} Pendiente de imprimir.`);
                if (res.incompleto) toast.error('Quedaron unidades sin generar: usa «Generar códigos de barra» en el laboratorio para completar.');
                onCreated?.();
                close();
            } else if (res.status === 'invalid') {
                toast.error(`No se pudo crear el ítem: ${res.motivo}.`);
            } else {
                toast.error(`Ocurrió algo. No se pudo insertar el ítem. ${res.error ?? ''}`);
            }
        } catch (error) {
            console.error(error);
            toast.error(`Ocurrió algo. No se pudo insertar el ítem. ${error.message || ''}`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div>
            <div className={FormStyles.headerForm}>
                <Button startIcon={<ArrowBackIcon />} className={FormStyles.backBtn} onClick={close}>Atrás</Button>
                <h2>Nuevo Ítem</h2>
                <h2 className={FormStyles.headerForm}>Ingresar datos</h2>
            </div>
            <form className={FormStyles.form} onSubmit={(e) => e.preventDefault()}>
                <label>
                    Equipo:
                </label>
                <input type="text" name="nombre" value={equipo} onChange={(e) => setEquipo(e.target.value)} placeholder='Ingresar nombre de equipo...' minLength={1} required />
                <label>Marca:</label>
                <input type="text" name="descripcion" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder='Ingresar...' />
                <label>
                    Modelo:
                </label>
                <input type="text" name="modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder='Ingresar...' />
                <label>
                    Ubicación:
                </label>
                <input type="text" name="ubicacion" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder='Ingresar...' />
                <label>
                    Columna de localización:
                </label>
                <input type="text" name="columna" value={columnaDeLocalizacion} onChange={(e) => setColumnaDeLocalizacion(e.target.value)} placeholder='Ingresar...' />
                <label>
                    Tipo:
                </label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                    <option value="" disabled>Seleccionar tipo...</option>
                    {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <label>
                    Cantidad:
                </label>
                <input type="number" min={tieneUnidades(tipo) ? 1 : 0} step={1} name="cantidad" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder='Ingresar...' />
                {tipo && (esInsumo
                    ? <InsumoFields serie={numeroSerie} setSerie={setNumeroSerie} fundaempresa={codigoFundaempresa} setFundaempresa={setCodigoFundaempresa} />
                    : <UnidadesNota />)}
                <VencimientoFields tiene={tieneVencimiento} setTiene={setTieneVencimiento} fecha={fechaVencimiento} setFecha={setFechaVencimiento} />
                <label>
                    Observaciones:
                </label>
                <input type="text" name="observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder='Ingresar...' />
                <p style={{ gridColumn: '1 / -1', fontSize: '0.85rem', color: '#555', margin: 0 }}>
                    El código se genera automáticamente según el tipo (MOB, HER, INS, EQU) y no se puede escribir a mano.
                </p>
            </form>
            <Uploader setImgFile={setImgFile} setImgURL={setImgURL} setImgName={setImgName}></Uploader>
            <div className={FormStyles.btnsAddLabContainer}>
                <Button onClick={close} disabled={busy}>Cancelar</Button>
                <Button onClick={() => crear(false)} disabled={busy}>{busy ? 'Guardando…' : 'Agregar'}</Button>
            </div>
            <ThresholdConfirmDialog open={!!confirmInfo} info={confirmInfo} busy={busy} onCancel={() => setConfirmInfo(null)} onConfirm={() => crear(true)} />
        </div>
    )
}

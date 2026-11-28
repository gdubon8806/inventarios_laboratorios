'use client'
// Papelera / archivos de baja (solo admin). PLAN_FUNCIONALIDADES_V2.md §5.
import Head from 'next/head';
import { invalidateHomeCache } from '../lib/cache/home-cache';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableContainer from '@mui/material/TableContainer';
import Paper from '@mui/material/Paper';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RestoreIcon from '@mui/icons-material/Restore';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';

import useRole from '../hooks/useRole';
import { readItemsInactivos } from '../components/firebase/read-item';
import { readAllLabs, readLabsInactivos } from '../components/firebase/read-lab';
import { restoreItem, deleteItemHard } from '../components/firebase/delete-item';
import { restoreLab, deleteLabHard } from '../components/firebase/delete-lab';
import { planTrash, emptyTrash } from '../components/firebase/trash';
import { downloadTrashBackup } from '../lib/backup/trashBackup';

function fechaTexto(f) {
  if (!f) return '';
  const d = typeof f.toDate === 'function' ? f.toDate() : typeof f.seconds === 'number' ? new Date(f.seconds * 1000) : null;
  return d ? d.toLocaleString('es-HN') : '';
}

function quien(p) {
  return p && (p.email || p.uid) ? p.email || p.uid : '';
}

export default function Bajas() {
  const router = useRouter();
  const { user, isAdmin, loading } = useRole();

  // Restaurar o vaciar la papelera cambia varios laboratorios: la pantalla principal relee todo al volver.
  useEffect(() => () => invalidateHomeCache(), []);

  useEffect(() => {
    if (loading) return;
    // Sin sesión -> inicio de sesión; con sesión pero sin ser admin -> inicio
    if (!user || !isAdmin) router.replace('/');
  }, [loading, user, isAdmin]);

  if (loading) return <div>Cargando...</div>;
  if (!user || !isAdmin) return null;
  return <PapeleraPage />;
}

// Diálogo genérico: exige escribir una palabra para confirmar acciones irreversibles
function ConfirmarPalabra({ open, titulo, texto, palabra, etiquetaBoton, onConfirm, onClose, ocupado }) {
  const [escrito, setEscrito] = useState('');
  useEffect(() => { if (open) setEscrito(''); }, [open]);
  return (
    <Dialog open={open} onClose={ocupado ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{titulo}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>{texto}</Typography>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label={`Escribe ${palabra} para confirmar`}
          value={escrito}
          onChange={(e) => setEscrito(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={ocupado}>Cancelar</Button>
        <Button color="error" variant="contained" disabled={ocupado || escrito !== palabra} onClick={onConfirm}>
          {etiquetaBoton}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function PapeleraPage() {
  const [tab, setTab] = useState(0);
  const [items, setItems] = useState([]);
  const [labsInactivos, setLabsInactivos] = useState([]);
  const [nombresLab, setNombresLab] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aEliminar, setAEliminar] = useState(null); // { tipo: 'item' | 'lab', doc }
  const [eliminando, setEliminando] = useState(false);
  const [vaciarAbierto, setVaciarAbierto] = useState(false);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [its, labsBaja, todos] = await Promise.all([readItemsInactivos(), readLabsInactivos(), readAllLabs()]);
      setItems(its);
      setLabsInactivos(labsBaja);
      const nombres = {};
      todos.forEach((l) => { nombres[l.id] = l.name; });
      setNombresLab(nombres);
    } catch (e) {
      console.error(e);
      setError(`No se pudo leer la papelera: ${e.message}`);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { recargar(); }, [recargar]);

  const restaurarItem = async (it) => {
    try {
      await restoreItem(it.id);
      toast('Artículo restaurado.');
      recargar();
    } catch (e) {
      toast.error(e.code === 'LAB_INACTIVO'
        ? 'El laboratorio de este artículo está dado de baja: restaura primero el laboratorio (pestaña Laboratorios).'
        : e.message);
    }
  };

  const restaurarLab = async (lab) => {
    try {
      await restoreLab(lab.id);
      toast('Laboratorio restaurado.');
      recargar();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const confirmarEliminar = async () => {
    if (!aEliminar) return;
    setEliminando(true);
    try {
      if (aEliminar.tipo === 'item') await deleteItemHard(aEliminar.doc.id);
      else await deleteLabHard(aEliminar.doc.id);
      toast('Eliminado definitivamente.');
      setAEliminar(null);
      recargar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEliminando(false);
    }
  };

  const nombreLab = (id) => nombresLab[id] || '(laboratorio inexistente)';

  return (
    <div style={{ padding: '1rem 2rem' }}>
      <Head><title>Papelera - Inventarios</title></Head>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <Link href="/">
          <Button variant="contained" startIcon={<ArrowBackIcon />}>Volver</Button>
        </Link>
        <h2 style={{ margin: 0, flex: 1 }}>Archivos de baja (papelera)</h2>
        <Button
          color="error"
          variant="outlined"
          startIcon={<DeleteForeverIcon />}
          disabled={cargando || (items.length === 0 && labsInactivos.length === 0)}
          onClick={() => setVaciarAbierto(true)}
        >
          Vaciar papelera
        </Button>
      </div>

      {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}
      {cargando && <LinearProgress sx={{ mb: 2 }} />}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Artículos (${items.length})`} />
        <Tab label={`Laboratorios (${labsInactivos.length})`} />
      </Tabs>

      {tab === 0 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Laboratorio</TableCell>
                <TableCell>Fecha de baja</TableCell>
                <TableCell>Motivo</TableCell>
                <TableCell>Dado de baja por</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 && !cargando && (
                <TableRow><TableCell colSpan={8}>La papelera de artículos está vacía.</TableCell></TableRow>
              )}
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.codigo || '—'}</TableCell>
                  <TableCell>{it.equipo}</TableCell>
                  <TableCell>{it.tipo}</TableCell>
                  <TableCell>{nombreLab(it.idLab)}</TableCell>
                  <TableCell>{fechaTexto(it.fechaBaja)}</TableCell>
                  <TableCell>{it.motivoBaja}</TableCell>
                  <TableCell>{quien(it.bajaPor)}</TableCell>
                  <TableCell align="right">
                    <Button size="small" startIcon={<RestoreIcon />} onClick={() => restaurarItem(it)}>Restaurar</Button>
                    <Button size="small" color="error" startIcon={<DeleteForeverIcon />} onClick={() => setAEliminar({ tipo: 'item', doc: it })}>
                      Eliminar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 1 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Descripción</TableCell>
                <TableCell>Fecha de baja</TableCell>
                <TableCell>Motivo</TableCell>
                <TableCell>Dado de baja por</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {labsInactivos.length === 0 && !cargando && (
                <TableRow><TableCell colSpan={6}>No hay laboratorios dados de baja.</TableCell></TableRow>
              )}
              {labsInactivos.map((lab) => (
                <TableRow key={lab.id}>
                  <TableCell>{lab.name}</TableCell>
                  <TableCell>{lab.description}</TableCell>
                  <TableCell>{fechaTexto(lab.fechaBaja)}</TableCell>
                  <TableCell>{lab.motivoBaja}</TableCell>
                  <TableCell>{quien(lab.bajaPor)}</TableCell>
                  <TableCell align="right">
                    <Button size="small" startIcon={<RestoreIcon />} onClick={() => restaurarLab(lab)}>Restaurar</Button>
                    <Button size="small" color="error" startIcon={<DeleteForeverIcon />} onClick={() => setAEliminar({ tipo: 'lab', doc: lab })}>
                      Eliminar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <ConfirmarPalabra
        open={!!aEliminar}
        titulo="Eliminar definitivamente"
        texto={aEliminar
          ? aEliminar.tipo === 'item'
            ? `Se eliminará "${aEliminar.doc.equipo}" con sus unidades, reportes e imagen (si nadie más la usa). Esta acción no se puede deshacer. Su código no se volverá a usar.`
            : `Se eliminará el laboratorio "${aEliminar.doc.name}" y su imagen (si nadie más la usa). Solo es posible si ya no tiene artículos. Esta acción no se puede deshacer.`
          : ''}
        palabra="ELIMINAR"
        etiquetaBoton="Eliminar definitivamente"
        ocupado={eliminando}
        onConfirm={confirmarEliminar}
        onClose={() => setAEliminar(null)}
      />

      <VaciarPapeleraDialog
        open={vaciarAbierto}
        onClose={() => setVaciarAbierto(false)}
        nombresLab={nombresLab}
        onTerminado={recargar}
      />
      <Toaster />
    </div>
  );
}

// Vaciar papelera: conteo exacto -> respaldo xlsx automático -> escribir VACIAR -> eliminación
function VaciarPapeleraDialog({ open, onClose, nombresLab, onTerminado }) {
  const [scope, setScope] = useState('todo');
  const [dias, setDias] = useState('');
  const [plan, setPlan] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const [escrito, setEscrito] = useState('');
  const [ejecutando, setEjecutando] = useState(false);
  const [progreso, setProgreso] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setScope('todo'); setDias(''); setPlan(null); setEscrito(''); setProgreso(null); setResumen(null); setError('');
    }
  }, [open]);

  // Cualquier cambio de opciones invalida el conteo anterior
  useEffect(() => { setPlan(null); setEscrito(''); }, [scope, dias]);

  const opciones = useMemo(() => ({ scope, olderThanDays: Number(dias) > 0 ? Number(dias) : 0 }), [scope, dias]);

  const calcular = async () => {
    setCalculando(true);
    setError('');
    try {
      setPlan(await planTrash(opciones));
    } catch (e) {
      console.error(e);
      setError(`No se pudo calcular lo que se eliminaría: ${e.message}`);
    } finally {
      setCalculando(false);
    }
  };

  const vaciar = async () => {
    if (!plan) return;
    setEjecutando(true);
    setError('');
    try {
      // 1) Respaldo ANTES de eliminar: si falla, no se elimina nada
      downloadTrashBackup({ items: plan.items, labs: plan.labs, nombresLab });
      // 2) Eliminación
      const r = await emptyTrash(plan, { onProgress: setProgreso });
      setResumen(r);
      onTerminado();
    } catch (e) {
      console.error(e);
      setError(`No se pudo completar: ${e.message}`);
    } finally {
      setEjecutando(false);
    }
  };

  const t = plan ? plan.totales : null;
  const hayAlgo = t && (t.items > 0 || t.labs > 0);

  return (
    <Dialog open={open} onClose={ejecutando ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Vaciar papelera</DialogTitle>
      <DialogContent>
        {!resumen && (
          <>
            <Typography sx={{ mb: 2 }}>
              Elimina de forma <b>definitiva e irreversible</b> lo que está en la papelera. Antes se descargará un
              respaldo en Excel de lo que se va a borrar.
            </Typography>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <TextField select size="small" label="Qué vaciar" value={scope} onChange={(e) => setScope(e.target.value)} sx={{ minWidth: 180 }} disabled={ejecutando}>
                <MenuItem value="todo">Todo</MenuItem>
                <MenuItem value="articulos">Solo artículos</MenuItem>
                <MenuItem value="laboratorios">Solo laboratorios</MenuItem>
              </TextField>
              <TextField
                size="small"
                type="number"
                label="Solo con más de N días en baja (opcional)"
                value={dias}
                onChange={(e) => setDias(e.target.value)}
                inputProps={{ min: 0 }}
                fullWidth
                disabled={ejecutando}
              />
            </div>
            <Button variant="outlined" onClick={calcular} disabled={calculando || ejecutando}>
              {calculando ? 'Calculando...' : 'Calcular lo que se eliminará'}
            </Button>

            {t && (
              <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
                <Typography><b>Se eliminarán:</b></Typography>
                <ul style={{ margin: '0.5rem 0' }}>
                  <li>{t.items} artículo(s)</li>
                  <li>{t.unidades} unidad(es)</li>
                  <li>{t.reportes} reporte(s)</li>
                  <li>{t.imagenes} imagen(es) de Storage</li>
                  <li>{t.labs} laboratorio(s)</li>
                </ul>
                {t.labsOmitidos > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    {t.labsOmitidos} laboratorio(s) se conservarán porque aún tienen artículos que no se eliminan:
                    {' '}{plan.labsOmitidos.map((o) => `${o.lab.name} (${o.restantes})`).join(', ')}.
                  </Typography>
                )}
                {!hayAlgo && <Typography>No hay nada que eliminar con estas opciones.</Typography>}
              </Paper>
            )}

            {hayAlgo && (
              <TextField
                sx={{ mt: 2 }}
                fullWidth
                size="small"
                label="Escribe VACIAR para confirmar"
                value={escrito}
                onChange={(e) => setEscrito(e.target.value)}
                disabled={ejecutando}
              />
            )}
            {ejecutando && progreso && (
              <div style={{ marginTop: '1rem' }}>
                <LinearProgress variant="determinate" value={progreso.total ? (progreso.hechos / progreso.total) * 100 : 0} />
                <Typography variant="body2">{progreso.hechos} de {progreso.total}</Typography>
              </div>
            )}
          </>
        )}

        {resumen && (
          <>
            <Typography sx={{ mb: 1 }}><b>Papelera vaciada.</b></Typography>
            <ul>
              <li>{resumen.items} artículo(s), {resumen.unidades} unidad(es), {resumen.reportes} reporte(s)</li>
              <li>{resumen.labs} laboratorio(s), {resumen.imagenes} imagen(es)</li>
            </ul>
            {resumen.errores.length > 0 && (
              <>
                <Typography color="error">No se pudieron eliminar {resumen.errores.length} elemento(s):</Typography>
                <ul>
                  {resumen.errores.map((er) => <li key={er.id}>{er.nombre || er.id}: {er.mensaje}</li>)}
                </ul>
              </>
            )}
          </>
        )}
        {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={ejecutando}>{resumen ? 'Cerrar' : 'Cancelar'}</Button>
        {!resumen && (
          <Button color="error" variant="contained" disabled={!hayAlgo || escrito !== 'VACIAR' || ejecutando} onClick={vaciar}>
            {ejecutando ? 'Eliminando...' : 'Descargar respaldo y vaciar'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

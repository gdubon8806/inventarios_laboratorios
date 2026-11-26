import { useState } from 'react';
import Button from '@mui/material/Button';
import PrintIcon from '@mui/icons-material/Print';
import toast from 'react-hot-toast';

import PrintLabelsDialog from './labels/PrintLabelsDialog';
import readLabLabels, { labelIdToTarget } from './firebase/read-lab-labels';
import { markPrinted } from './firebase/manage-units';

// Botón "Imprimir etiquetas" de la tarjeta de un laboratorio. SOLO ADMIN (el caller no lo monta para invitados).
// Carga las etiquetas del lab (una por unidad MOB/HER/EQU, una por registro INS), abre PrintLabelsDialog
// ("¿Imprimir N etiquetas del laboratorio X?", tandas de 100, "¿Salieron bien?") y SOLO tras confirmar
// marca las etiquetas como impresas (markPrinted). Rojo cuando hay etiquetas pendientes de imprimir.
//
// Props: { lab, status, onDone }   onDone(): recargar el estado del lab tras marcar impresas.
export default function LabPrintButton({ lab, status, onDone }) {
  const [loading, setLoading] = useState(false);
  const [labels, setLabels] = useState([]);
  const [open, setOpen] = useState(false);

  const total = status?.total ?? 0;
  const withoutCode = status?.sinCodigo ?? 0;
  const pending = status?.pendienteImprimir ?? 0;

  // Sin registros, o todos sin código: no hay nada que imprimir (primero se generan los códigos).
  if (!status || total === 0 || withoutCode >= total) return null;

  const handleClick = async () => {
    setLoading(true);
    try {
      const found = await readLabLabels(lab);
      if (found.length === 0) {
        toast('Este laboratorio no tiene etiquetas con código para imprimir.');
        return;
      }
      setLabels(found);
      setOpen(true);
    } catch (error) {
      console.error(error);
      toast.error('No se pudieron leer las etiquetas del laboratorio.');
    } finally {
      setLoading(false);
    }
  };

  // Solo se llama cuando el admin respondió "Sí, salieron bien" para una tanda.
  const handleConfirmed = async (ids) => {
    const result = await markPrinted(ids.map(labelIdToTarget));
    if (result.status !== 'ok') throw new Error(result.error || 'No se pudo marcar como impresas');
    setLabels((prev) => prev.map((l) => (ids.includes(l.id) ? { ...l, estadoCodigo: 'impreso' } : l)));
    toast(`${ids.length} etiqueta(s) marcadas como impresas.`);
    await onDone?.();
  };

  return (
    <>
      <Button
        fullWidth
        size="small"
        variant={pending > 0 ? 'contained' : 'outlined'}
        color={pending > 0 ? 'error' : 'primary'}
        startIcon={<PrintIcon />}
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? 'Cargando…' : pending > 0 ? `Imprimir etiquetas (${pending} pendientes)` : 'Imprimir etiquetas'}
      </Button>
      {open && (
        <PrintLabelsDialog
          open={open}
          onClose={() => setOpen(false)}
          labName={lab.name}
          labels={labels}
          onConfirmed={handleConfirmed}
        />
      )}
    </>
  );
}

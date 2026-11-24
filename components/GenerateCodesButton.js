import { useState } from 'react';
import Button from '@mui/material/Button';
import GenerateCodesDialog from './GenerateCodesDialog';

// Botón "Generar códigos de barra (N pendientes)" de la tarjeta de un laboratorio. SOLO ADMIN: el caller no
// debe montarlo para invitados. Ámbar mientras haya registros sin código (status.sinCodigo > 0).
//
// Props: { lab, status, onDone }
//   status: { sinCodigo, ... } de getLabCodeStatus/computeLabCodeStatus (undefined mientras carga)
//   onDone(): se llama al terminar una generación para que el padre recargue el estado de ese lab.
// El diálogo sigue montado aunque el conteo llegue a 0 (para mostrar el resumen final).
export default function GenerateCodesButton({ lab, status, onDone }) {
  const [open, setOpen] = useState(false);
  const pending = status?.sinCodigo ?? 0;

  if (!open && pending === 0) return null;

  return (
    <>
      {pending > 0 && (
        <Button fullWidth size="small" variant="contained" color="warning" onClick={() => setOpen(true)}>
          {`Generar códigos (${pending} pendientes)`}
        </Button>
      )}
      {open && (
        <GenerateCodesDialog open={open} onClose={() => setOpen(false)} lab={lab} onDone={onDone} />
      )}
    </>
  );
}

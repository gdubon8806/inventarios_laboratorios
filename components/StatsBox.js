// Cuadro del laboratorio (dinámico): N° de registros, total por cantidad, reportadas y, solo admin, pendientes.
// Se calcula sobre TODOS los registros activos del lab (no sobre los filtrados por la búsqueda).
import { useMemo } from 'react';
import Chip from '@mui/material/Chip';
import { computeLabStats } from '../lib/inventory/stats';

function Box({ label, value, color }) {
  return (
    <div style={{
      minWidth: 140, padding: '0.6rem 1rem', borderRadius: 10, background: '#fff',
      boxShadow: '0 1px 4px rgba(0,0,0,.2)', borderLeft: color ? `6px solid ${color}` : undefined, textAlign: 'center',
    }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 600, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '0.8rem', color: '#555' }}>{label}</div>
    </div>
  );
}

export default function StatsBox({ items, reports, isAdmin }) {
  const s = useMemo(() => computeLabStats(items, reports), [items, reports]);
  return (
    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', padding: '0.5rem 1rem' }}>
      <Box label="Registros" value={s.registros} />
      <Box label="Total por cantidad" value={s.totalCantidad} />
      <Box label="Reportadas" value={s.reportadas} color={s.reportadas > 0 ? '#d32f2f' : undefined} />
      {isAdmin && (
        <>
          <Box label="Sin código" value={s.pendientesCodigo} color={s.pendientesCodigo > 0 ? '#ff9800' : undefined} />
          <Box label="Pendientes de imprimir" value={s.pendientesImpresion} color={s.pendientesImpresion > 0 ? '#d32f2f' : undefined} />
          {(s.incongruentes > 0 || s.porValidar > 0) && (
            <div style={{ alignSelf: 'center' }}>
              {s.incongruentes > 0 && <Chip color="warning" label={`⚠ ${s.incongruentes} con datos incongruentes`} sx={{ mr: 1 }} />}
              {s.porValidar > 0 && <Chip color="warning" variant="outlined" label={`${s.porValidar} por validar`} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}

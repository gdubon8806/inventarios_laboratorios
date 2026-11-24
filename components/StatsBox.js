// Cuadros del laboratorio (tonales, compactos, en una fila o dos como máximo): N° de registros, total por cantidad y
// reportadas (estos tres se muestran siempre, aunque estén en 0) y, solo para admin, «Sin código» y «Pendientes de
// imprimir», que aparecen únicamente cuando hay al menos uno. Se calcula sobre TODOS los registros activos del lab
// (no sobre los filtrados por la búsqueda).
import { useMemo } from 'react';
import Chip from '@mui/material/Chip';
import { computeLabStats } from '../lib/inventory/stats';
import { M3 } from '../styles/theme';

// tono: neutral | error | warning (color de fondo suave + texto oscuro del mismo matiz)
const TONOS = {
  neutral: { bg: M3.surfaceContainer, fg: M3.onPrimaryContainer },
  error: { bg: M3.errorContainer, fg: M3.onErrorContainer },
  warning: { bg: M3.warningContainer, fg: M3.onWarningContainer },
};

function Box({ label, value, tono = 'neutral' }) {
  const t = TONOS[tono];
  return (
    <div style={{ padding: '0.55rem 0.4rem', borderRadius: 14, background: t.bg, color: t.fg, textAlign: 'center', minWidth: 0 }}>
      <div style={{ fontSize: '1.45rem', fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.3px' }}>{value}</div>
      <div style={{ fontSize: '0.68rem', fontWeight: 500, lineHeight: 1.15, marginTop: 3, opacity: 0.85 }}>{label}</div>
    </div>
  );
}

export default function StatsBox({ items, reports, isAdmin }) {
  const s = useMemo(() => computeLabStats(items, reports), [items, reports]);
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '0.85rem 0.75rem 0' }}>
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))' }}>
        <Box label="Registros" value={s.registros} />
        <Box label="Total por cantidad" value={s.totalCantidad} />
        <Box label="Reportadas" value={s.reportadas} tono={s.reportadas > 0 ? 'error' : 'neutral'} />
        {isAdmin && s.pendientesCodigo > 0 && <Box label="Sin código" value={s.pendientesCodigo} tono="warning" />}
        {isAdmin && s.pendientesImpresion > 0 && <Box label="Pendientes de imprimir" value={s.pendientesImpresion} tono="error" />}
      </div>
      {isAdmin && (s.incongruentes > 0 || s.porValidar > 0) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
          {s.incongruentes > 0 && <Chip size="small" color="warning" label={`⚠ ${s.incongruentes} con datos incongruentes`} />}
          {s.porValidar > 0 && <Chip size="small" color="warning" variant="outlined" label={`${s.porValidar} por validar`} />}
        </div>
      )}
    </div>
  );
}

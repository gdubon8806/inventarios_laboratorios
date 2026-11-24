'use client'
// Diagnóstico de datos (SOLO LECTURA, solo admin): explica por qué un laboratorio podría mostrarse con 0 registros.
// Compara cada laboratorio con los registros que existen de verdad en la base y señala:
//   - registros cuyo `idLab` no corresponde a ningún laboratorio (huérfanos: p. ej. el laboratorio se recreó con otro id)
//   - registros con `idLab` vacío o con otro tipo de dato (texto con espacios, número, etc.)
//   - registros dados de baja o de laboratorios dados de baja
//   - diferencias entre lo que ve la pantalla del laboratorio (consulta por idLab) y el conteo real
// No escribe nada en la base.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { collection, getDocs } from 'firebase/firestore';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { firestore } from '../firebaseConfig';
import useRole from '../hooks/useRole';
import readItem from '../components/firebase/read-item';
import LoadingScreen from '../components/ui/LoadingScreen';

async function analizar() {
  const [labsSnap, itemsSnap] = await Promise.all([
    getDocs(collection(firestore, 'laboratorios')),
    getDocs(collection(firestore, 'items')),
  ]);
  const labs = labsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const labIds = new Set(labs.map((l) => l.id));

  const porLab = {};
  const huerfanos = {}; // idLab desconocido -> { n, ejemplos }
  const sinIdLab = [];
  for (const it of items) {
    const raw = it.idLab;
    if (raw === undefined || raw === null || raw === '') { sinIdLab.push(it); continue; }
    const key = typeof raw === 'string' ? raw : `(${typeof raw}) ${String(raw)}`;
    if (typeof raw !== 'string' || !labIds.has(raw)) {
      const h = (huerfanos[key] ||= { n: 0, ejemplos: [], parecido: null });
      h.n += 1;
      if (h.ejemplos.length < 3) h.ejemplos.push(it.equipo || it.id);
      // ¿Es el mismo id con espacios o distinta capitalización?
      if (typeof raw === 'string') h.parecido = labs.find((l) => l.id.toLowerCase() === raw.trim().toLowerCase())?.name ?? null;
      continue;
    }
    const s = (porLab[raw] ||= { total: 0, activos: 0, bajas: 0 });
    s.total += 1;
    if (it.activo === false) s.bajas += 1; else s.activos += 1;
  }

  // Lo que realmente muestra la pantalla de cada laboratorio (misma consulta que pages/inventory.js)
  const filas = [];
  for (const lab of labs) {
    const visibles = (await readItem(lab.id)).length;
    const s = porLab[lab.id] || { total: 0, activos: 0, bajas: 0 };
    filas.push({ lab, ...s, visibles });
  }
  filas.sort((a, b) => String(a.lab.name).localeCompare(String(b.lab.name)));
  return { filas, huerfanos, sinIdLab, totalItems: items.length, totalLabs: labs.length };
}

export default function Diagnostico() {
  const router = useRouter();
  const { user, role, loading } = useRole();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { if (!loading && !user) router.replace('/'); }, [loading, user]);
  useEffect(() => {
    if (loading || role !== 'admin') return;
    analizar().then(setData).catch((e) => setError(`${e.code || ''} ${e.message}`.trim()));
  }, [loading, role]);

  if (loading) return <LoadingScreen text="Iniciando sesión…" />;
  if (!user) return null;
  if (role !== 'admin') return <Alert severity="warning" sx={{ m: 2 }}>Solo el administrador puede ver el diagnóstico.</Alert>;

  const sospechosos = data ? data.filas.filter((f) => f.visibles !== f.activos || (f.activos === 0 && f.bajas > 0)) : [];
  const huerfanosList = data ? Object.entries(data.huerfanos) : [];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '1rem' }}>
      <Button component={Link} href="/" startIcon={<ArrowBackIcon />} sx={{ mb: 1 }}>Volver</Button>
      <Typography variant="h5" gutterBottom>Diagnóstico de datos</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Solo lectura. Compara cada laboratorio con los registros que existen en la base de datos.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>No se pudo leer la base de datos: {error}</Alert>}
      {!data && !error && <LoadingScreen inline text="Analizando laboratorios y registros…" />}

      {data && (
        <>
          <Alert severity={sospechosos.length || huerfanosList.length || data.sinIdLab.length ? 'warning' : 'success'} sx={{ mb: 2 }}>
            {data.totalLabs} laboratorios y {data.totalItems} registros leídos. {' '}
            {huerfanosList.length ? `${huerfanosList.reduce((a, [, h]) => a + h.n, 0)} registros apuntan a un laboratorio que no existe. ` : ''}
            {data.sinIdLab.length ? `${data.sinIdLab.length} registros no tienen laboratorio. ` : ''}
            {!sospechosos.length && !huerfanosList.length && !data.sinIdLab.length ? 'No se detectaron inconsistencias.' : ''}
          </Alert>

          {huerfanosList.length > 0 && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom>Registros que apuntan a un laboratorio inexistente</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Es la causa más probable de un laboratorio en 0: los registros siguen en la base, pero guardan el identificador de otro laboratorio.
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead><TableRow><TableCell>idLab guardado en el registro</TableCell><TableCell align="right">Registros</TableCell><TableCell>Ejemplos</TableCell><TableCell>Pista</TableCell></TableRow></TableHead>
                  <TableBody>
                    {huerfanosList.map(([id, h]) => (
                      <TableRow key={id}>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{id}</TableCell>
                        <TableCell align="right">{h.n}</TableCell>
                        <TableCell>{h.ejemplos.join(', ')}</TableCell>
                        <TableCell>{h.parecido ? `Parecido a "${h.parecido}" (espacios o mayúsculas)` : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {data.sinIdLab.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {data.sinIdLab.length} registros sin laboratorio asignado. Ejemplos: {data.sinIdLab.slice(0, 5).map((i) => i.equipo || i.id).join(', ')}.
            </Alert>
          )}

          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Laboratorio</TableCell><TableCell>Estado</TableCell>
                  <TableCell align="right">Registros en la base</TableCell><TableCell align="right">Activos</TableCell>
                  <TableCell align="right">En papelera</TableCell><TableCell align="right">Los que muestra la pantalla</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.filas.map((f) => {
                  const raro = f.visibles !== f.activos;
                  return (
                    <TableRow key={f.lab.id} sx={raro ? { bgcolor: 'warning.light' } : undefined}>
                      <TableCell>{f.lab.name}<div style={{ fontFamily: 'monospace', fontSize: 11, color: '#666' }}>{f.lab.id}</div></TableCell>
                      <TableCell>{f.lab.activo === false ? <Chip size="small" label="En papelera" /> : <Chip size="small" color="success" label="Activo" />}</TableCell>
                      <TableCell align="right">{f.total}</TableCell>
                      <TableCell align="right">{f.activos}</TableCell>
                      <TableCell align="right">{f.bajas}</TableCell>
                      <TableCell align="right">{f.visibles}{raro ? ' ⚠' : ''}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </div>
  );
}

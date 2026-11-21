'use client'
// Importación de Excel validada (solo admin). PLAN_FUNCIONALIDADES_V2.md §10.
// Flujo: subir .xlsx -> validar contra la BD -> resumen + previsualización -> confirmar -> respaldo -> escribir en lotes.
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';

import { deleteField, doc, getDoc, runTransaction, serverTimestamp, setDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { firestore } from '../firebaseConfig';
import XLSX from '../vendor/xlsx';
import useRole from '../hooks/useRole';
import { downloadBackup, exportAllToXLSX } from '../components/exportData/export';
import { loadSnapshot } from '../components/exportData/snapshot';
import { readWorkbookBuffer, parseWorkbook } from '../lib/import/parse';
import { confirmationsSatisfied, validateImport } from '../lib/import/validate';
import { applyImport, createFirestoreDeps, newImportId } from '../lib/import/apply';

const COLORS = {
  error: '#fdecea',
  warning: '#fff8c4', // amarillo: cambios de nombre, modelo, etc.
  new: '#e8f5e9',
  removed: '#eceff1',
  restored: '#e3f2fd',
};

const rowKey = (r) => `${r.ref.sheet}!${r.ref.row}`;
const currentOf = (snap) => ({ items: snap.items, unidades: snap.unidades, labs: snap.labs });

export default function ImportPage() {
  const router = useRouter();
  const { user, isAdmin, loading } = useRole();

  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [loading, user]);

  if (loading) return <div>Cargando...</div>;
  if (!user) return null;
  if (!isAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Solo los administradores pueden importar datos.</Alert>
        <Button component={Link} href="/" startIcon={<ArrowBackIcon />} sx={{ mt: 2 }}>Volver</Button>
      </Box>
    );
  }
  return <Importer user={user} />;
}

function Importer({ user }) {
  const fileRef = useRef(null);
  const importIdRef = useRef(null); // se conserva entre reintentos de un mismo archivo (reanudable)
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('idle'); // idle | validando | listo | aplicando | hecho
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState('errores');
  const [okWarnings, setOkWarnings] = useState(false);
  const [okBajas, setOkBajas] = useState(false);
  const [okKeys, setOkKeys] = useState({});

  const resetConfirms = () => {
    setOkWarnings(false);
    setOkBajas(false);
    setOkKeys({});
  };

  // Subir (o RE-subir tras corregir) un archivo: siempre vuelve a validar desde cero.
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo después de corregirlo
    if (!file) return;
    setError('');
    setResult(null);
    setProgress(null);
    resetConfirms();
    importIdRef.current = null;
    setFileName(file.name);
    setStage('validando');
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const p = parseWorkbook(XLSX, readWorkbookBuffer(XLSX, buf));
      const snap = await loadSnapshot();
      const rep = validateImport({ parsed: p, current: currentOf(snap) });
      setParsed(p);
      setReport(rep);
      setTab(rep.fileErrors.length > 0 || rep.summary.errorRows > 0 ? 'errores' : 'cambios');
      setStage('listo');
    } catch (err) {
      console.error(err);
      setError(`No se pudo leer el archivo: ${err.message}`);
      setReport(null);
      setStage('idle');
    } finally {
      setBusy(false);
    }
  };

  const groups = useMemo(() => {
    if (!report) return null;
    const rows = report.rows;
    return {
      errores: rows.filter((r) => r.status === 'error'),
      cambios: rows.filter((r) => ['modified', 'restored'].includes(r.status)),
      nuevas: rows.filter((r) => r.status === 'new'),
      bajas: [...rows.filter((r) => r.status === 'removed'), ...report.removedRows],
      ignoradas: report.ignoredNewer,
    };
  }, [report]);

  const satisfied = report
    ? confirmationsSatisfied(report, { warnings: okWarnings, bajas: okBajas, thresholdKeys: Object.keys(okKeys).filter((k) => okKeys[k]) })
    : false;

  const apply = async () => {
    setError('');
    setBusy(true);
    setStage('aplicando');
    try {
      // 1) Releer la BD y re-validar: si cambió desde que se subió el archivo, no se escribe nada.
      const fresh = await loadSnapshot();
      const rep2 = validateImport({ parsed, current: currentOf(fresh) });
      const same = JSON.stringify(rep2.summary) === JSON.stringify(report.summary)
        && JSON.stringify(rep2.needsConfirm) === JSON.stringify(report.needsConfirm);
      if (!same || !rep2.canApply) {
        setReport(rep2);
        resetConfirms();
        setStage('listo');
        setError('La base de datos cambió mientras revisaba el archivo. Se volvió a validar: revise el nuevo resumen y confirme otra vez.');
        return;
      }
      // 2) Respaldo previo (si falla, no se escribe nada)
      await downloadBackup(fresh);
      // 3) Escritura en lotes; mismo importId en reintentos => reanuda donde quedó
      importIdRef.current = importIdRef.current || newImportId();
      const deps = createFirestoreDeps({
        firestore,
        fb: { doc, getDoc, setDoc, writeBatch, runTransaction, serverTimestamp, deleteField, Timestamp },
      });
      const res = await applyImport({
        report: rep2,
        current: currentOf(fresh),
        deps,
        importId: importIdRef.current,
        author: { uid: user.uid, email: user.email || null },
        fileName,
        onProgress: setProgress,
      });
      setResult(res);
      setStage('hecho');
    } catch (err) {
      console.error(err);
      setError(err.message || String(err));
      setStage('listo'); // el botón queda disponible para reintentar (reanuda con el mismo id)
    } finally {
      setBusy(false);
    }
  };

  const s = report?.summary;
  const hasErrors = !!report && (report.fileErrors.length > 0 || s.errorRows > 0);

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
      <Head><title>Importar Excel</title></Head>
      <Button component={Link} href="/" startIcon={<ArrowBackIcon />}>Volver</Button>
      <Typography variant="h4" sx={{ my: 1 }}>Importar Excel</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        1) Descargue el Excel actual, 2) edítelo (el código no se puede cambiar), 3) súbalo aquí: se valida, se muestra un resumen de cambios
        y solo si no hay errores puede aplicarlos. Antes de escribir se descarga un respaldo automático.
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => exportAllToXLSX()} disabled={busy}>
          Descargar Excel actual
        </Button>
        <Button variant="contained" startIcon={<UploadFileIcon />} onClick={() => fileRef.current?.click()} disabled={busy || stage === 'aplicando'}>
          {report ? 'Subir otro archivo / corregido' : 'Subir Excel'}
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={onFile} />
        {fileName && <Chip label={fileName} />}
      </Box>

      {busy && stage === 'validando' && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>{error}</Alert>}

      {report?.fileErrors.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <b>El archivo no se puede procesar:</b>
          <ul style={{ margin: '4px 0 0 18px' }}>{report.fileErrors.map((f, i) => <li key={i}>{f.message}</li>)}</ul>
        </Alert>
      )}

      {report && report.fileErrors.length === 0 && (
        <>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Chip label={`Sin cambios: ${s.unchanged}`} />
            <Chip label={`Modificados: ${s.modified + s.restored}`} sx={{ bgcolor: COLORS.warning }} />
            <Chip label={`Nuevos: ${s.new}`} sx={{ bgcolor: COLORS.new }} />
            <Chip label={`Bajas: ${s.removed}`} sx={{ bgcolor: COLORS.removed }} />
            <Chip label={`Errores: ${s.errorRows} fila(s)`} color={s.errorRows ? 'error' : 'default'} />
            {s.ignoredNewer > 0 && <Chip label={`Ignoradas (creadas en la app tras exportar): ${s.ignoredNewer}`} variant="outlined" />}
          </Box>

          {hasErrors && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Hay {s.errorRows} fila(s) con errores. <b>No se puede subir hasta corregirlos</b>: arregle el Excel y vuelva a subirlo (se valida de nuevo).
            </Alert>
          )}
          {!hasErrors && !report.canApply && <Alert severity="info" sx={{ mb: 2 }}>El archivo no tiene cambios respecto a la base de datos.</Alert>}

          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ mb: 1 }}>
            <Tab value="errores" label={`Errores (${groups.errores.length})`} />
            <Tab value="cambios" label={`Cambios (${groups.cambios.length})`} />
            <Tab value="nuevas" label={`Nuevos (${groups.nuevas.length})`} />
            <Tab value="bajas" label={`Bajas (${groups.bajas.length})`} />
            {groups.ignoradas.length > 0 && <Tab value="ignoradas" label={`Ignoradas (${groups.ignoradas.length})`} />}
          </Tabs>

          <PreviewTable
            rows={groups[tab]}
            mode={tab}
            okKeys={okKeys}
            onToggleKey={(k, v) => setOkKeys((o) => ({ ...o, [k]: v }))}
          />

          {report.canApply && (
            <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>Confirmaciones</Typography>
              {report.needsConfirm.warnings > 0 && (
                <FormControlLabel
                  control={<Checkbox checked={okWarnings} onChange={(e) => setOkWarnings(e.target.checked)} />}
                  label={`Confirmo los ${report.needsConfirm.warnings} cambio(s) marcados en amarillo / nuevos`}
                />
              )}
              {report.needsConfirm.bajas > 0 && (
                <FormControlLabel
                  control={<Checkbox checked={okBajas} onChange={(e) => setOkBajas(e.target.checked)} />}
                  label={`Confirmo dar de baja ${report.needsConfirm.bajas} registro(s)/unidad(es) (baja lógica, se pueden restaurar desde la papelera)`}
                />
              )}
              {report.needsConfirm.thresholdRowKeys.length > 0 && (
                <Alert severity="warning" sx={{ my: 1 }}>
                  {report.needsConfirm.thresholdRowKeys.length} fila(s) superan el umbral de cantidad: marque cada una en la tabla
                  (pestañas Cambios / Nuevos) para validarla una por una.
                </Alert>
              )}
              <Box sx={{ mt: 1 }}>
                <Button variant="contained" color="primary" disabled={!satisfied || busy} onClick={apply}>
                  {busy && stage === 'aplicando' ? 'Aplicando…' : 'Subir cambios'}
                </Button>
              </Box>
              {stage === 'aplicando' && progress && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2">Lote {progress.done} de {progress.total}</Typography>
                  <LinearProgress variant="determinate" value={(progress.done / progress.total) * 100} />
                </Box>
              )}
            </Paper>
          )}
        </>
      )}

      {stage === 'hecho' && result && (
        <Alert severity="success" sx={{ mt: 2 }}>
          {result.alreadyApplied
            ? 'Esta importación ya estaba aplicada.'
            : `Importación aplicada (${result.ops} operaciones en ${result.lotes} lote(s)). Id de auditoría: ${result.importId}.`}
          {' '}Los códigos nuevos quedan "pendientes de imprimir".
        </Alert>
      )}
    </Box>
  );
}

function ChangeCell({ r }) {
  return (
    <>
      {r.issues.map((i, k) => (
        <div key={`i${k}`} style={{ color: i.level === 'error' ? '#b71c1c' : '#8a6d00' }}>
          {i.level === 'error' ? '⛔' : '⚠'} {i.message}
        </div>
      ))}
      {r.changes.map((c, k) => (
        <div key={`c${k}`}>
          <b>{c.label}:</b>{' '}
          <span style={{ textDecoration: 'line-through', color: '#b71c1c' }}>{c.old || '(vacío)'}</span>{' → '}
          <b>{c.new || '(vacío)'}</b>
        </div>
      ))}
      {r.status === 'new' && r.data && (
        <div>
          Se creará «{r.data.nombre}» ({r.data.tipo}), cantidad {r.data.cantidad}
          {r.data.unidades > 0 ? `, con ${r.data.unidades} unidad(es) y código cada una` : ', con 1 código'}.
        </div>
      )}
      {r.origin === 'ausente' && <div>No aparece en el archivo: se dará de baja (no se borra).</div>}
      {r.reason && <div>{r.reason}</div>}
    </>
  );
}

function PreviewTable({ rows, mode, okKeys, onToggleKey }) {
  if (!rows || rows.length === 0) return <Alert severity="success">Nada en esta categoría.</Alert>;
  const bg = { errores: COLORS.error, cambios: COLORS.warning, nuevas: COLORS.new, bajas: COLORS.removed, ignoradas: undefined }[mode];
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 520 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Hoja / fila</TableCell>
            <TableCell>Tipo</TableCell>
            <TableCell>Código</TableCell>
            <TableCell>Nombre</TableCell>
            <TableCell>Detalle</TableCell>
            <TableCell>Validar</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r, idx) => {
            const key = r.ref ? rowKey(r) : `ausente-${r.id}`;
            return (
              <TableRow key={`${key}-${idx}`} sx={{ bgcolor: bg }}>
                <TableCell>{r.ref ? `${r.ref.sheet} · ${r.ref.row}` : '—'}</TableCell>
                <TableCell>{r.kind === 'unidad' ? 'Unidad' : 'Registro'}</TableCell>
                <TableCell>{r.codigo || '—'}</TableCell>
                <TableCell>{r.nombre || '—'}</TableCell>
                <TableCell><ChangeCell r={r} /></TableCell>
                <TableCell>
                  {r.needsRowConfirm && (
                    <FormControlLabel
                      control={<Checkbox checked={!!okKeys[key]} onChange={(e) => onToggleKey(key, e.target.checked)} />}
                      label="Cantidad alta: confirmo"
                    />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

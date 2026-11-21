import { useEffect, useMemo, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import toast from 'react-hot-toast';

import { readLabRecords, generateMissingCodes, computeLabCodeStatus } from './firebase/generate-missing-codes';
import updateItem from './firebase/update-item';
import { planGeneration } from '../lib/codes/planning';
import { prefixForTipo, usesUnits } from '../lib/codes/prefixes';

// Diálogo "Generar códigos de barra" de un laboratorio (solo admin; el caller lo monta únicamente para admin).
// Flujo:  confirmar (¿está seguro?) → [validar uno a uno los registros que superan umbrales D11] →
//         generar (progreso, cancelable entre lotes, reanudable) → resumen ("quedan N pendientes",
//         omitidos y registros con datos incongruentes D13).
//
// Props: { open, onClose, lab: {id,name}, onDone?: () => void }   onDone se llama al terminar (para recargar conteos).

function describePlan(plan, records) {
  const byPrefix = { MOB: 0, HER: 0, INS: 0, EQU: 0 };
  const byId = new Map(records.map((r) => [r.id, r]));
  for (const job of plan.jobs) {
    const rec = byId.get(job.recordId);
    const prefix = rec ? prefixForTipo(rec.tipo) : null;
    if (!prefix) continue;
    byPrefix[prefix] += job.kind === 'ins' ? 1 : job.units;
  }
  const total = Object.values(byPrefix).reduce((a, b) => a + b, 0);
  return { byPrefix, total };
}

export default function GenerateCodesDialog({ open, onClose, lab, onDone }) {
  // 'loading' | 'confirm' | 'validate' | 'running' | 'done'
  const [step, setStep] = useState('loading');
  const [records, setRecords] = useState([]);
  const [decisions, setDecisions] = useState({});
  const [validationTotal, setValidationTotal] = useState(0);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState(null);
  const [finalStatus, setFinalStatus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setStep('loading');
    setDecisions({});
    setSummary(null);
    setFinalStatus(null);
    setError('');
    setProgress({ done: 0, total: 0 });
    readLabRecords(lab.id)
      .then((recs) => {
        if (cancelled) return;
        setRecords(recs);
        setStep('confirm');
      })
      .catch((e) => {
        if (cancelled) return;
        setError(`No se pudieron leer los registros del laboratorio: ${e?.message ?? e}`);
        setStep('confirm');
      });
    return () => { cancelled = true; };
  }, [open, lab.id]);

  const plan = useMemo(() => planGeneration(records, decisions), [records, decisions]);
  const { byPrefix, total: totalCodes } = useMemo(() => describePlan(plan, records), [plan, records]);
  const nameOf = useMemo(() => new Map(records.map((r) => [r.id, r.equipo || '(sin nombre)'])), [records]);
  const current = plan.needValidation[0] || null;

  const run = async (usedDecisions) => {
    setStep('running');
    cancelRef.current = false;
    setBusy(true);
    setError('');
    try {
      const result = await generateMissingCodes(lab.id, {
        decisions: usedDecisions,
        onProgress: (p) => setProgress({ done: p.done, total: p.total }),
        shouldCancel: () => cancelRef.current,
      });
      const fresh = await readLabRecords(lab.id).catch(() => records);
      setRecords(fresh);
      setSummary(result);
      setFinalStatus(computeLabCodeStatus(fresh));
      setStep('done');
      onDone?.();
    } catch (e) {
      setError(e?.message ?? String(e));
      setStep('done');
    } finally {
      setBusy(false);
    }
  };

  // Al contestar el último registro por validar, se genera automáticamente.
  const decide = (id, decision) => {
    const next = { ...decisions, [id]: decision };
    setDecisions(next);
    const stillPending = planGeneration(records, next).needValidation.length;
    if (stillPending === 0) run(next);
  };

  const changeToInsumo = async (rec) => {
    setBusy(true);
    try {
      // El registro aún no tiene código (sinCodigo): corregir su tipo es una corrección de datos segura.
      await updateItem(rec.id, { tipo: 'Suministro' });
      const nextRecords = records.map((r) => (r.id === rec.id ? { ...r, tipo: 'Suministro' } : r));
      setRecords(nextRecords);
      toast('Tipo cambiado a Insumo.');
      const stillPending = planGeneration(nextRecords, decisions).needValidation.length;
      if (stillPending === 0) run(decisions);
    } catch (e) {
      toast.error(`No se pudo cambiar el tipo: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  const startValidationOrRun = () => {
    if (plan.needValidation.length > 0) {
      setValidationTotal(plan.needValidation.length);
      setStep('validate');
    } else {
      run(decisions);
    }
  };

  const incongruentes = summary?.incongruentes?.length ? summary.incongruentes : plan.incongruentes;
  const locked = step === 'running';

  return (
    <Dialog open={open} onClose={locked ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Generar códigos de barra — {lab.name}</DialogTitle>
      <DialogContent dividers>
        {step === 'loading' && <Typography>Revisando los registros del laboratorio…</Typography>}

        {step === 'confirm' && (
          <>
            {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
            {totalCodes + plan.needValidation.length === 0 ? (
              <Alert severity="info">No hay registros pendientes de código en este laboratorio.</Alert>
            ) : (
              <>
                <Typography variant="h6" gutterBottom>¿Está seguro?</Typography>
                <Typography gutterBottom>
                  Se asignarán códigos de barra a los registros sin código, según su tipo
                  (MOB mobiliario, HER herramienta, INS insumo, EQU equipo). No se puede deshacer
                  y los códigos asignados no se vuelven a usar.
                </Typography>
                <Typography variant="subtitle2" sx={{ mt: 1 }}>
                  Códigos a crear ahora: {totalCodes}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {Object.entries(byPrefix).filter(([, n]) => n > 0).map(([p, n]) => `${p}: ${n}`).join(' · ') || '—'}
                </Typography>
                {plan.needValidation.length > 0 && (
                  <Alert severity="warning" sx={{ mt: 1.5 }}>
                    {plan.needValidation.length} registro(s) superan el umbral de cantidad (Herramienta/Equipo más de 10,
                    Mobiliario más de 20, Insumo más de 100). Se validarán uno a uno, con su nombre, antes de crear nada.
                  </Alert>
                )}
                {plan.incongruentes.length > 0 && (
                  <Alert severity="info" sx={{ mt: 1.5 }}>
                    {plan.incongruentes.length} registro(s) con datos incongruentes (sin tipo, tipo raro o cantidad inválida)
                    no recibirán código hasta que los corrijas.
                  </Alert>
                )}
              </>
            )}
          </>
        )}

        {step === 'validate' && current && (
          <>
            <Typography variant="caption" color="text.secondary">
              Validación {Math.min(validationTotal, validationTotal - plan.needValidation.length + 1)} de {validationTotal}
            </Typography>
            <Typography variant="h6" sx={{ mt: 0.5 }}>{current.equipo || '(sin nombre)'}</Typography>
            <Typography color="text.secondary" gutterBottom>
              {current.tipo} · cantidad {current.cantidad} (supera {current.threshold})
            </Typography>
            {usesUnits(current.tipo) ? (
              <Typography>
                Se crearán {current.cantidad} unidades, cada una con su código y su etiqueta
                ({current.cantidad} etiquetas para imprimir). ¿Es correcto?
              </Typography>
            ) : (
              <Typography>
                Un insumo lleva un solo código aunque la cantidad sea {current.cantidad}.
                ¿Confirmas que la cantidad es correcta y quieres generar su código?
              </Typography>
            )}
            {usesUnits(current.tipo) && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Si se trata de material consumible, puedes cambiarlo a Insumo (un solo código).
              </Typography>
            )}
          </>
        )}

        {step === 'running' && (
          <>
            <Typography gutterBottom>Generando códigos… no cierres esta ventana.</Typography>
            <LinearProgress
              variant={progress.total > 0 ? 'determinate' : 'indeterminate'}
              value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0}
            />
            <Typography variant="body2" sx={{ mt: 1 }}>
              {progress.done} de {progress.total} códigos
            </Typography>
          </>
        )}

        {step === 'done' && (
          <>
            {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
            {summary?.status === 'ok' && (
              <Alert severity="success" sx={{ mb: 1 }}>
                Se crearon {summary.created} códigos en {summary.registros} registro(s).
              </Alert>
            )}
            {summary?.status === 'cancelled' && (
              <Alert severity="warning" sx={{ mb: 1 }}>
                Generación cancelada ({summary.created} códigos creados). Puedes reanudarla cuando quieras: continúa donde quedó.
              </Alert>
            )}
            {summary?.status === 'interrupted' && (
              <Alert severity="error" sx={{ mb: 1 }}>
                Se interrumpió ({summary.created} códigos creados): {summary.error}. Vuelve a pulsar «Generar códigos»;
                se reanuda sin duplicar nada.
              </Alert>
            )}
            {finalStatus && (
              <Typography sx={{ mb: 1 }}>
                {finalStatus.sinCodigo > 0
                  ? `Quedan ${finalStatus.sinCodigo} registros pendientes${finalStatus.porValidar > 0 ? ` (${finalStatus.porValidar} omitidos por validar)` : ''}.`
                  : 'No quedan registros pendientes de código.'}
                {finalStatus.pendienteImprimir > 0 && ` ${finalStatus.pendienteImprimir} registro(s) están pendientes de imprimir.`}
              </Typography>
            )}
            {incongruentes.length > 0 && (
              <>
                <Alert severity="warning">
                  {incongruentes.length} registro(s) con datos incongruentes no recibieron código. Corrígelos dentro del laboratorio
                  (están marcados) o dalos de baja.
                </Alert>
                <List dense sx={{ maxHeight: 180, overflowY: 'auto' }}>
                  {incongruentes.map((x) => (
                    <ListItem key={x.id} disableGutters>
                      <ListItemText primary={nameOf.get(x.id) || x.id} secondary={x.motivo} />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        {step === 'confirm' && (
          <>
            <Button onClick={onClose}>Cancelar</Button>
            <Button
              variant="contained"
              color="warning"
              disabled={totalCodes + plan.needValidation.length === 0}
              onClick={startValidationOrRun}
            >
              {plan.needValidation.length > 0 ? 'Continuar' : 'Sí, generar'}
            </Button>
          </>
        )}
        {step === 'validate' && current && (
          <>
            <Button onClick={onClose} disabled={busy}>Cancelar todo</Button>
            {usesUnits(current.tipo) ? (
              <>
                <Button disabled={busy} onClick={() => changeToInsumo(records.find((r) => r.id === current.id))}>
                  Cambiar a Insumo
                </Button>
                <Button disabled={busy} onClick={() => decide(current.id, 'omitir')}>Omitir (queda por validar)</Button>
                <Button variant="contained" disabled={busy} onClick={() => decide(current.id, 'crear')}>
                  Crear {current.cantidad} unidades
                </Button>
              </>
            ) : (
              <>
                <Button disabled={busy} onClick={() => decide(current.id, 'omitir')}>No</Button>
                <Button variant="contained" disabled={busy} onClick={() => decide(current.id, 'crear')}>Sí</Button>
              </>
            )}
          </>
        )}
        {step === 'running' && (
          <Button onClick={() => { cancelRef.current = true; }}>Cancelar (al terminar el lote)</Button>
        )}
        {step === 'done' && <Button variant="contained" onClick={onClose}>Cerrar</Button>}
      </DialogActions>
    </Dialog>
  );
}

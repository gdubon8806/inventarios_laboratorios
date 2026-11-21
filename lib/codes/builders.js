// Constructores PUROS de escrituras (sin Firebase): devuelven listas de {op, path, data}
// que la capa fina (components/firebase/codes-shared.js) aplica dentro de una transacción.
// `now` es un valor opaco (serverTimestamp() en producción, una cadena en los tests).
import { canonicalTipo, formatCode, prefixForTipo, unitId, usesUnits, ESTADOS } from './prefixes.js';
import { allocateRanges, aggregateEstadoCodigo } from './planning.js';
import { validateRecordData } from './thresholds.js';

export const MIN_MOTIVO_LENGTH = 5;
export const EDITABLE_UNIT_FIELDS = ['numeroSerie', 'codigoFundaempresa', 'observaciones', 'estado'];

const set = (path, data) => ({ op: 'set', path, data });
const update = (path, data) => ({ op: 'update', path, data });

export function codigoDoc({ registroId, unidadId = null, labId = null, tipo, now }) {
  return {
    registroId, unidadId, labId, tipo,
    activo: true, eliminado: false, reemplazado: false, reemplazadoPor: null, creado: now,
  };
}

function stamp(now, user) {
  return { ultimaModificacion: now, ultimaModificacionPor: user ?? null };
}

/** Reserva `count` códigos consecutivos de un prefijo y avanza el contador local. */
function takeCodes(state, prefix, count) {
  const start = state.counters[prefix] ?? 1;
  const codes = [];
  for (let i = 0; i < count; i++) codes.push(formatCode(prefix, start + i));
  state.counters[prefix] = start + count;
  state.touched.add(prefix);
  return codes;
}

function counterWrites(state) {
  return [...state.touched].map((p) => set(`counters/${p}`, { next: state.counters[p] }));
}

/**
 * Escrituras de UN lote de generación (una transacción).
 * jobs: [{ recordId, kind, unitsToCreate, final, mode?:'generate'|'increase', cantidadObjetivo? }]
 * records: { [id]: datosActualesDelRegistro }   counters: { EQU: 10 } (siguiente libre; ausente => 1)
 * -> { writes, nextCounters, results:[{recordId, skipped?, reason?, created, codes}] }
 */
export function buildGenerationWrites({ jobs, records, counters = {}, now, user }) {
  const state = { counters: { ...counters }, touched: new Set() };
  const writes = [];
  const results = [];

  for (const job of jobs) {
    const rec = records[job.recordId];
    if (!rec) { results.push({ recordId: job.recordId, skipped: true, reason: 'registro no existe', created: 0, codes: [] }); continue; }
    if (rec.activo === false) { results.push({ recordId: job.recordId, skipped: true, reason: 'registro en baja', created: 0, codes: [] }); continue; }
    const v = validateRecordData(rec);
    if (!v.ok) { results.push({ recordId: job.recordId, skipped: true, reason: v.motivo, created: 0, codes: [] }); continue; }
    const prefix = v.prefix;
    const tipo = canonicalTipo(rec.tipo);
    const rid = job.recordId;

    if (!usesUnits(prefix)) {
      if (rec.codigo) { results.push({ recordId: rid, skipped: true, reason: 'ya tiene código', created: 0, codes: [rec.codigo] }); continue; }
      const [code] = takeCodes(state, prefix, 1);
      writes.push(update(`items/${rid}`, {
        codigo: code, estadoCodigo: 'pendienteImprimir', codigoGeneradoEn: now,
        pendienteValidar: false, requiereValidacion: false, motivoValidacion: null, ...stamp(now, user),
      }));
      writes.push(set(`codigos/${code}`, codigoDoc({ registroId: rid, labId: rec.idLab ?? null, tipo, now })));
      results.push({ recordId: rid, created: 1, codes: [code] });
      continue;
    }

    // Con unidades
    const generated = Number(rec.unidadesGeneradas) || 0;
    const mode = job.mode ?? 'generate';
    let k = job.unitsToCreate;
    if (mode === 'generate') k = Math.min(k, v.cantidad - generated); // idempotencia: nunca pasarse de cantidad
    if (!(k > 0)) { results.push({ recordId: rid, skipped: true, reason: 'sin unidades por crear', created: 0, codes: [] }); continue; }

    const codes = takeCodes(state, prefix, k);
    codes.forEach((code, i) => {
      const uid = unitId(generated + i + 1);
      writes.push(set(`items/${rid}/unidades/${uid}`, {
        registroId: rid, codigo: code, estadoCodigo: 'pendienteImprimir', codigoGeneradoEn: now, codigoImpresoEn: null,
        numeroSerie: '', codigoFundaempresa: '', observaciones: '', estado: 'bueno',
        idLab: rec.idLab ?? null, tipo, activo: true, codigoAnterior: null, ...stamp(now, user),
      }));
      writes.push(set(`codigos/${code}`, codigoDoc({ registroId: rid, unidadId: uid, labId: rec.idLab ?? null, tipo, now })));
    });

    const recUpdate = { unidadesGeneradas: generated + k, pendienteValidar: false, ...stamp(now, user) };
    if (mode === 'increase') {
      const newCantidad = (Number(rec.cantidad) || 0) + k;
      recUpdate.cantidad = newCantidad;
      recUpdate.totalUnidades = newCantidad;
      recUpdate.estadoCodigo = 'pendienteImprimir'; // hay unidades nuevas por imprimir
      recUpdate.cantidadObjetivo = job.final ? null : job.cantidadObjetivo ?? null;
    } else {
      recUpdate.totalUnidades = v.cantidad;
      if (job.final) {
        recUpdate.estadoCodigo = 'pendienteImprimir';
        recUpdate.codigoGeneradoEn = now;
        recUpdate.requiereValidacion = false;
        recUpdate.motivoValidacion = null;
        recUpdate.cambioTipoEnCurso = false;
      }
    }
    writes.push(update(`items/${rid}`, recUpdate));
    results.push({ recordId: rid, created: k, codes });
  }

  writes.push(...counterWrites(state));
  return { writes, nextCounters: state.counters, results };
}

/**
 * Baja lógica de unidades elegidas (para bajar cantidad). Nunca borra.
 * units: unidades a dar de baja ([{id, codigo, activo}...]); activeUnits: todas las activas del registro.
 */
export function buildDeactivationWrites({ record, recordId, units, activeUnits = [], motivo, now, user }) {
  const m = String(motivo ?? '').trim();
  if (m.length < MIN_MOTIVO_LENGTH) return { ok: false, error: `El motivo debe tener al menos ${MIN_MOTIVO_LENGTH} caracteres` };
  if (!units.length) return { ok: false, error: 'No hay unidades seleccionadas' };
  const ids = new Set();
  for (const u of units) {
    if (ids.has(u.id)) return { ok: false, error: `Unidad repetida: ${u.id}` };
    ids.add(u.id);
    if (u.activo === false) return { ok: false, error: `La unidad ${u.id} ya está dada de baja` };
  }
  const current = Number(record.cantidad) || 0;
  if (units.length > current) return { ok: false, error: 'Más bajas que unidades activas' };
  const writes = [];
  for (const u of units) {
    writes.push(update(`items/${recordId}/unidades/${u.id}`, {
      activo: false, fechaBaja: now, motivoBaja: m, bajaPor: user ?? null, ...stamp(now, user),
    }));
    if (u.codigo) writes.push(update(`codigos/${u.codigo}`, { activo: false }));
  }
  const newCantidad = current - units.length;
  const remaining = activeUnits.filter((u) => !ids.has(u.id));
  writes.push(update(`items/${recordId}`, {
    cantidad: newCantidad, totalUnidades: newCantidad,
    estadoCodigo: aggregateEstadoCodigo(remaining), ...stamp(now, user),
  }));
  return { ok: true, writes, newCantidad };
}

/** Reactivar una unidad dada de baja (acción explícita de admin). */
export function buildReactivationWrites({ record, recordId, unit, activeUnits = [], now, user }) {
  if (unit.activo !== false) return { ok: false, error: 'La unidad ya está activa' };
  const newCantidad = (Number(record.cantidad) || 0) + 1;
  const writes = [
    update(`items/${recordId}/unidades/${unit.id}`, {
      activo: true, fechaBaja: null, motivoBaja: null, bajaPor: null, restauradoPor: user ?? null, restauradoEn: now, ...stamp(now, user),
    }),
  ];
  if (unit.codigo) writes.push(update(`codigos/${unit.codigo}`, { activo: true }));
  writes.push(update(`items/${recordId}`, {
    cantidad: newCantidad, totalUnidades: newCantidad,
    estadoCodigo: aggregateEstadoCodigo([...activeUnits, { ...unit, activo: true }]), ...stamp(now, user),
  }));
  return { ok: true, writes, newCantidad };
}

/** Edición de una unidad: sólo campos permitidos (el código y el tipo NO se editan). */
export function buildUnitUpdate({ recordId, unitId: uid, fields, now, user }) {
  const data = {};
  for (const key of Object.keys(fields ?? {})) {
    if (!EDITABLE_UNIT_FIELDS.includes(key)) return { ok: false, error: `Campo no editable: ${key}` };
    data[key] = fields[key];
  }
  if ('estado' in data && !ESTADOS.includes(data.estado)) return { ok: false, error: `Estado inválido: ${data.estado}` };
  if (!Object.keys(data).length) return { ok: false, error: 'Nada que actualizar' };
  return { ok: true, writes: [update(`items/${recordId}/unidades/${uid}`, { ...data, ...stamp(now, user) })] };
}

// ---------------------------------------------------------------------------------------------
// Cambio de tipo (§4.3)
// ---------------------------------------------------------------------------------------------

/**
 * Análisis previo (sin escribir). -> { ok:false, error, code } | { ok:true, kind, from, to, cantidad, ... }
 * kind: 'ins-to-units' | 'units-to-units' | 'units-to-ins'
 */
export function planTypeChange({ record, activeUnits = [], newTipo, override = false }) {
  const from = prefixForTipo(record.tipo);
  const to = prefixForTipo(newTipo);
  if (!from) return { ok: false, code: 'tipo-actual-invalido', error: 'El tipo actual del registro no es válido; corríjalo primero' };
  if (!to) return { ok: false, code: 'tipo-nuevo-invalido', error: 'Tipo nuevo no reconocido' };
  if (from === to) return { ok: false, code: 'mismo-tipo', error: 'El registro ya es de ese tipo' };
  if (record.activo === false) return { ok: false, code: 'en-baja', error: 'El registro está dado de baja' };
  if (!usesUnits(from) && usesUnits(to)) {
    const v = validateRecordData(record);
    if (!v.ok) return { ok: false, code: 'cantidad-invalida', error: `Cantidad inválida: ${v.motivo}` };
    if (v.cantidad < 1) return { ok: false, code: 'cantidad-invalida', error: 'La cantidad debe ser al menos 1 para crear unidades' };
    return { ok: true, kind: 'ins-to-units', from, to, cantidad: v.cantidad, oldCode: record.codigo ?? null };
  }
  if (usesUnits(from) && usesUnits(to)) {
    return { ok: true, kind: 'units-to-units', from, to, unidades: activeUnits.length };
  }
  // units -> INS (destructivo)
  const conDatos = activeUnits.filter((u) => String(u.numeroSerie ?? '').trim() || String(u.codigoFundaempresa ?? '').trim());
  if (conDatos.length && !override) {
    return {
      ok: false, code: 'bloqueado-datos-por-unidad',
      error: `${conDatos.length} unidad(es) tienen serie o código Fundaempresa; se perderían. Requiere confirmación explícita (override).`,
      unidadesConDatos: conDatos.length,
    };
  }
  return { ok: true, kind: 'units-to-ins', from, to, unidades: activeUnits.length, unidadesConDatos: conDatos.length };
}

/** INS -> unidades, fase 1: cambia tipo, retira el código INS y deja el registro listo para generar unidades. */
export function buildInsToUnitsPhase1({ record, recordId, newTipo, now, user }) {
  const tipo = canonicalTipo(newTipo);
  const writes = [
    update(`items/${recordId}`, {
      tipo, tipoAnterior: record.tipo ?? null,
      codigoAnterior: record.codigo ?? null, codigo: null,
      estadoCodigo: 'sinCodigo', unidadesGeneradas: 0, totalUnidades: Number(record.cantidad) || 0,
      cambioTipoEnCurso: true, pendienteValidar: false, ...stamp(now, user),
    }),
  ];
  if (record.codigo) {
    writes.push(update(`codigos/${record.codigo}`, { reemplazado: true, reemplazadoPor: null, motivo: 'cambio de tipo' }));
  }
  return { writes };
}

/** unidad -> unidad (EQU/MOB/HER), un chunk de unidades activas. */
export function buildUnitsToUnitsChunk({ record, recordId, units, newTipo, counters = {}, isFirst, isLast, now, user }) {
  const to = prefixForTipo(newTipo);
  const tipo = canonicalTipo(newTipo);
  const state = { counters: { ...counters }, touched: new Set() };
  const codes = takeCodes(state, to, units.length);
  const writes = [];
  units.forEach((u, i) => {
    const code = codes[i];
    writes.push(update(`items/${recordId}/unidades/${u.id}`, {
      codigo: code, codigoAnterior: u.codigo ?? null, tipo, estadoCodigo: 'pendienteImprimir',
      codigoGeneradoEn: now, codigoImpresoEn: null, ...stamp(now, user),
    }));
    if (u.codigo) writes.push(update(`codigos/${u.codigo}`, { reemplazado: true, reemplazadoPor: code }));
    writes.push(set(`codigos/${code}`, codigoDoc({ registroId: recordId, unidadId: u.id, labId: record.idLab ?? null, tipo, now })));
  });
  const recUpdate = {};
  if (isFirst) Object.assign(recUpdate, { tipo, tipoAnterior: record.tipo ?? null, cambioTipoEnCurso: true });
  if (isLast) Object.assign(recUpdate, { estadoCodigo: 'pendienteImprimir', cambioTipoEnCurso: false });
  if (Object.keys(recUpdate).length) writes.push(update(`items/${recordId}`, { ...recUpdate, ...stamp(now, user) }));
  writes.push(...counterWrites(state));
  return { writes, nextCounters: state.counters };
}

/** Unidades que todavía no migraron al tipo nuevo (para reanudar). */
export function unitsPendingTypeChange(units, newTipo) {
  const tipo = canonicalTipo(newTipo);
  return units.filter((u) => u.activo !== false && u.tipo !== tipo);
}

/** unidades -> INS (destructivo), un chunk de bajas; el último chunk asigna el código INS al registro. */
export function buildUnitsToInsChunk({ record, recordId, units, counters = {}, isFirst, isLast, now, user }) {
  const state = { counters: { ...counters }, touched: new Set() };
  const writes = [];
  for (const u of units) {
    writes.push(update(`items/${recordId}/unidades/${u.id}`, {
      activo: false, fechaBaja: now, motivoBaja: 'cambio de tipo', bajaPor: user ?? null, ...stamp(now, user),
    }));
    if (u.codigo) writes.push(update(`codigos/${u.codigo}`, { activo: false, reemplazado: true, reemplazadoPor: null }));
  }
  const recUpdate = {};
  if (isFirst) Object.assign(recUpdate, { cambioTipoEnCurso: true });
  if (isLast) {
    const [code] = takeCodes(state, 'INS', 1);
    Object.assign(recUpdate, {
      tipoAnterior: record.tipo ?? null, tipo: canonicalTipo('INS'), codigoAnterior: null, codigo: code,
      estadoCodigo: 'pendienteImprimir', codigoGeneradoEn: now, cambioTipoEnCurso: false,
      totalUnidades: 0, unidadesReportadas: 0,
    });
    writes.push(set(`codigos/${code}`, codigoDoc({ registroId: recordId, labId: record.idLab ?? null, tipo: canonicalTipo('INS'), now })));
  }
  if (Object.keys(recUpdate).length) writes.push(update(`items/${recordId}`, { ...recUpdate, ...stamp(now, user) }));
  writes.push(...counterWrites(state));
  return { writes, nextCounters: state.counters };
}

/** Marca como impresas unidades/registros (sólo las escrituras de las unidades; el agregado va aparte). */
export function buildMarkPrintedWrites({ targets, now }) {
  const writes = [];
  for (const t of targets) {
    if (t.unidadId) {
      writes.push(update(`items/${t.recordId}/unidades/${t.unidadId}`, { estadoCodigo: 'impreso', codigoImpresoEn: now }));
    } else {
      writes.push(update(`items/${t.recordId}`, { estadoCodigo: 'impreso', codigoImpresoEn: now }));
    }
  }
  return writes;
}

export { allocateRanges };

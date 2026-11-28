// Aplicación de la importación: plan de escrituras puro + orquestación con dependencias inyectadas.
// Sin imports de Firebase: la capa fina `createFirestoreDeps` recibe las funciones del SDK por parámetro.
import { PREFIJOS, canonicalTipo, isInsumo, normCode } from './columns.js';
import { DB_KEY } from './diff.js';

export const BATCH_SIZE = 500;

// Marcadores que la capa Firestore traduce a serverTimestamp()/deleteField()/Timestamp.
export const SERVER_TS = Object.freeze({ __op: 'serverTimestamp' });
export const DELETE = Object.freeze({ __op: 'delete' });
export const dateOp = (ymd) => ({ __op: 'date', value: ymd });

// Documento del índice codigos/{codigo} (misma forma que lib/codes/builders.js#codigoDoc).
const codigoIndexDoc = ({ registroId, unidadId = null, labId, tipo }) => ({
  registroId, unidadId, labId, tipo, activo: true, eliminado: false, reemplazado: false, reemplazadoPor: null, creado: SERVER_TS,
});

const isActive = (x) => x?.activo !== false;

export function formatCode(prefix, n) {
  return `${prefix}-${String(n).padStart(6, '0')}`;
}

/** Cuántos códigos nuevos hay que reservar por prefijo. */
export function countCodeNeeds(report) {
  const needs = {};
  for (const c of report.plan.creates) {
    const canon = canonicalTipo(c.data.tipo);
    const prefix = PREFIJOS[canon];
    if (!prefix) continue;
    const n = isInsumo(canon) ? 1 : c.data.unidades;
    if (n > 0) needs[prefix] = (needs[prefix] || 0) + n;
  }
  return needs;
}

/** Asigna códigos consecutivos en el orden de `plan.creates`. `starts` = primer número reservado por prefijo. */
export function assignCodes(report, starts) {
  const cursor = { ...starts };
  const out = new Map();
  for (const c of report.plan.creates) {
    const canon = canonicalTipo(c.data.tipo);
    const prefix = PREFIJOS[canon];
    if (!prefix) continue;
    if (isInsumo(canon)) {
      out.set(c.rowKey, { registro: formatCode(prefix, cursor[prefix]++), unidades: [] });
    } else {
      const unidades = [];
      for (let i = 0; i < c.data.unidades; i++) unidades.push(formatCode(prefix, cursor[prefix]++));
      out.set(c.rowKey, { registro: null, unidades });
    }
  }
  return out;
}

function toDbFields(kind, fields) {
  const map = DB_KEY[kind === 'registro' ? 'registros' : 'unidades'];
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    const dbKey = map[k];
    if (!dbKey) continue;
    out[dbKey] = k === 'fechaVencimiento' ? (v ? dateOp(v) : null) : v;
  }
  return out;
}

class OpMap {
  constructor() {
    this.map = new Map();
  }
  add(op, path, data) {
    const key = path.join('/');
    const prev = this.map.get(key);
    if (prev) prev.data = { ...prev.data, ...data };
    else this.map.set(key, { op, path, data: { ...data } });
  }
  list() {
    return [...this.map.values()];
  }
}

/**
 * Convierte el informe validado en una lista ordenada de operaciones (idempotentes: ids deterministas).
 * @returns {Array<{op:'set'|'update', path:string[], data:object}>}
 */
export function buildOps({ report, current, importId, author, codes }) {
  const ops = new OpMap();
  const stamp = { ultimaModificacion: SERVER_TS, ultimaModificacionPor: author };
  const motivo = `Baja por importación de Excel (${importId})`;
  const itemsById = new Map(current.items.map((i) => [i.id, i]));
  const unitsByItem = new Map();
  for (const u of current.unidades) {
    if (!unitsByItem.has(u.itemId)) unitsByItem.set(u.itemId, []);
    unitsByItem.get(u.itemId).push(u);
  }
  // Por registro + ID: los IDs de unidad (u0001…) se repiten en cada registro.
  const unitById = new Map(current.unidades.map((u) => [`${u.itemId}/${u.id}`, u]));

  // 1) Altas (registro primero y luego sus unidades)
  report.plan.creates.forEach((c, idx) => {
    const d = c.data;
    const canon = canonicalTipo(d.tipo);
    const ins = isInsumo(canon);
    const assigned = codes.get(c.rowKey) || { registro: null, unidades: [] };
    const itemId = `${importId}_r${idx}`;
    const item = {
      equipo: d.nombre,
      marca: d.marca,
      modelo: d.modelo,
      ubicacion: d.ubicacion,
      columnadelocalizacion: d.columna,
      tipo: d.tipo,
      cantidad: d.cantidad,
      imgurl: '',
      imgname: '',
      observaciones: d.observaciones,
      idLab: d.idLab,
      tieneVencimiento: d.tieneVencimiento,
      fechaVencimiento: d.fechaVencimiento ? dateOp(d.fechaVencimiento) : null,
      activo: true,
      estadoCodigo: 'pendienteImprimir',
      pendienteValidar: false,
      requiereValidacion: false,
      creadoPorImportacion: importId,
      ...stamp,
    };
    if (ins) {
      Object.assign(item, {
        codigo: assigned.registro,
        codigoGeneradoEn: SERVER_TS,
        numeroSerie: d.serie || '',
        codigoFundaempresa: d.fundaempresa || '',
        estado: d.estado || 'bueno',
      });
    } else {
      Object.assign(item, { totalUnidades: d.unidades, unidadesGeneradas: d.unidades, unidadesReportadas: 0 });
    }
    ops.add('set', ['items', itemId], item);
    if (ins && assigned.registro) {
      ops.add('set', ['codigos', assigned.registro], codigoIndexDoc({ registroId: itemId, labId: d.idLab, tipo: canon }));
    }
    assigned.unidades.forEach((code, k) => {
      const uid = `${itemId}_u${k}`;
      ops.add('set', ['items', itemId, 'unidades', uid], {
        itemId,
        codigo: code,
        estadoCodigo: 'pendienteImprimir',
        codigoGeneradoEn: SERVER_TS,
        numeroSerie: '',
        codigoFundaempresa: '',
        estado: 'bueno',
        observaciones: '',
        idLab: d.idLab,
        tipo: d.tipo,
        activo: true,
        creadoPorImportacion: importId,
        ...stamp,
      });
      ops.add('set', ['codigos', code], codigoIndexDoc({ registroId: itemId, unidadId: uid, labId: d.idLab, tipo: canon }));
    });
  });

  // 2) Modificaciones de campos
  for (const u of report.plan.updates) {
    const fields = toDbFields(u.kind, u.fields);
    if (Object.keys(fields).length === 0) continue;
    const path = u.kind === 'registro' ? ['items', u.id] : ['items', u.itemId, 'unidades', u.id];
    ops.add('update', path, { ...fields, ...stamp });
  }

  // 3) Bajas lógicas (nunca deleteDoc). La baja de un registro arrastra sus unidades activas.
  const bajaItems = new Set(report.plan.bajas.filter((b) => b.kind === 'registro').map((b) => b.id));
  const unitDelta = new Map(); // itemId -> delta de unidades activas
  const bajaUnit = (unitId, itemId, codigo) => {
    ops.add('update', ['items', itemId, 'unidades', unitId], {
      activo: false, fechaBaja: SERVER_TS, motivoBaja: motivo, bajaPor: author, ...stamp,
    });
    if (codigo) ops.add('set', ['codigos', codigo], { activo: false });
  };
  for (const b of report.plan.bajas) {
    if (b.kind === 'registro') {
      ops.add('update', ['items', b.id], { activo: false, fechaBaja: SERVER_TS, motivoBaja: motivo, bajaPor: author, ...stamp });
      if (b.codigo) ops.add('set', ['codigos', b.codigo], { activo: false });
      for (const u of unitsByItem.get(b.id) || []) {
        if (isActive(u)) bajaUnit(u.id, b.id, normCode(u.codigo));
      }
    } else if (!bajaItems.has(b.itemId)) {
      bajaUnit(b.id, b.itemId, b.codigo);
      unitDelta.set(b.itemId, (unitDelta.get(b.itemId) || 0) - 1);
    }
  }

  // 4) Restauraciones
  for (const r of report.plan.restores) {
    const cleaned = { activo: true, fechaBaja: DELETE, motivoBaja: DELETE, bajaPor: DELETE, ...stamp };
    if (r.kind === 'registro') {
      const cur = itemsById.get(r.id);
      ops.add('update', ['items', r.id], cleaned);
      if (cur?.codigo) ops.add('set', ['codigos', normCode(cur.codigo)], { activo: true });
    } else {
      const cur = unitById.get(`${r.itemId}/${r.id}`);
      ops.add('update', ['items', r.itemId, 'unidades', r.id], cleaned);
      if (cur?.codigo) ops.add('set', ['codigos', normCode(cur.codigo)], { activo: true });
      unitDelta.set(r.itemId, (unitDelta.get(r.itemId) || 0) + 1);
    }
  }

  // 5) Contadores derivados del registro (no-INS): valores absolutos (idempotentes), no incrementos.
  for (const [itemId, delta] of unitDelta) {
    if (bajaItems.has(itemId)) continue;
    const activas = (unitsByItem.get(itemId) || []).filter(isActive).length;
    const total = Math.max(0, activas + delta);
    ops.add('update', ['items', itemId], { cantidad: total, totalUnidades: total, ...stamp });
  }

  // Orden estable: altas primero (padre antes que hijos), luego updates/sets.
  const rank = (o) => (o.path[0] === 'items' && o.op === 'set' ? 0 : 1);
  return ops.list().sort((a, b) => rank(a) - rank(b) || a.path.length - b.path.length);
}

export function chunk(arr, size = BATCH_SIZE) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function newImportId(now = new Date()) {
  const p = (n, l = 2) => String(n).padStart(l, '0');
  const stamp = `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}T${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}`;
  return `imp_${stamp}`;
}

/**
 * Orquesta la escritura. `deps`:
 *  - getImportRecord(id) -> Promise<object|null>
 *  - saveImportRecord(id, data) -> Promise  (merge)
 *  - reserveCodes(prefix, n) -> Promise<number>  primer número reservado (transacción sobre counters/{prefix})
 *  - commitOps(ops) -> Promise  (un lote atómico ≤ batchSize)
 * Es reanudable: si falla a medias, volver a llamar con el MISMO importId continúa desde el último lote.
 */
export async function applyImport({ report, current, deps, importId, author, fileName = '', onProgress = () => {}, batchSize = BATCH_SIZE }) {
  if (!report.canApply) throw new Error('El informe tiene errores o no hay cambios: no se puede aplicar.');

  const existing = await deps.getImportRecord(importId);
  if (existing?.estado === 'completo') return { importId, alreadyApplied: true, record: existing };

  let starts = existing?.asignaciones;
  if (!starts) {
    starts = {};
    const needs = countCodeNeeds(report);
    for (const [prefix, n] of Object.entries(needs)) starts[prefix] = await deps.reserveCodes(prefix, n);
  }
  const codes = assignCodes(report, starts);
  const ops = buildOps({ report, current, importId, author, codes });
  const batches = chunk(ops, batchSize);

  const resumen = { ...report.summary, ops: ops.length, lotes: batches.length };
  await deps.saveImportRecord(importId, {
    estado: 'en_curso',
    archivo: fileName,
    autor: author,
    resumen,
    asignaciones: starts,
    lotesTotal: batches.length,
    lotesAplicados: existing?.lotesAplicados || 0,
    inicio: existing?.inicio || { __op: 'serverTimestamp' },
  });

  let done = existing?.lotesAplicados || 0;
  try {
    for (let i = done; i < batches.length; i++) {
      await deps.commitOps(batches[i]);
      done = i + 1;
      await deps.saveImportRecord(importId, { lotesAplicados: done });
      onProgress({ done, total: batches.length });
    }
  } catch (e) {
    await deps.saveImportRecord(importId, { estado: 'error', error: String(e?.message || e), lotesAplicados: done }).catch(() => {});
    const wrapped = new Error(`Falló el lote ${done + 1} de ${batches.length}. Se aplicaron ${done} lotes; puede reintentar y continuará desde ahí. (${e?.message || e})`);
    wrapped.cause = e;
    wrapped.importId = importId;
    wrapped.lotesAplicados = done;
    throw wrapped;
  }
  await deps.saveImportRecord(importId, { estado: 'completo', fin: { __op: 'serverTimestamp' } });
  return { importId, alreadyApplied: false, ops: ops.length, lotes: batches.length, asignaciones: starts };
}

// ---------------------------------------------------------------------------------------------
// Capa fina sobre Firestore (solo se usa en el navegador; recibe el SDK por parámetro para no importarlo aquí)
// ---------------------------------------------------------------------------------------------
export function createFirestoreDeps({ firestore, fb }) {
  const { doc, getDoc, setDoc, writeBatch, runTransaction, serverTimestamp, deleteField, Timestamp } = fb;

  const resolve = (v) => {
    if (v && typeof v === 'object' && v.__op) {
      if (v.__op === 'serverTimestamp') return serverTimestamp();
      if (v.__op === 'delete') return deleteField();
      if (v.__op === 'date') {
        const [y, m, d] = v.value.split('-').map(Number);
        return Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0)); // mediodía local: evita corrimientos de día por zona horaria
      }
    }
    if (Array.isArray(v)) return v.map(resolve);
    if (v && typeof v === 'object' && !(v instanceof Date)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x)]));
    return v;
  };

  return {
    async getImportRecord(id) {
      const snap = await getDoc(doc(firestore, 'importaciones', id));
      return snap.exists() ? snap.data() : null;
    },
    async saveImportRecord(id, data) {
      await setDoc(doc(firestore, 'importaciones', id), resolve(data), { merge: true });
    },
    async reserveCodes(prefix, n) {
      const ref = doc(firestore, 'counters', prefix);
      return runTransaction(firestore, async (tx) => {
        const snap = await tx.get(ref);
        const next = snap.exists() ? Number(snap.data().next) || 1 : 1;
        tx.set(ref, { next: next + n }, { merge: true });
        return next;
      });
    },
    async commitOps(ops) {
      const batch = writeBatch(firestore);
      for (const o of ops) {
        const ref = doc(firestore, ...o.path);
        const data = resolve(o.data);
        if (o.op === 'update') batch.update(ref, data);
        else batch.set(ref, data, { merge: true });
      }
      await batch.commit();
    },
  };
}

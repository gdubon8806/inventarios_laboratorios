// MODO DEMO: sustituto en memoria de `firebase/firestore` (solo se usa con NEXT_PUBLIC_DEMO=1, ver next.config.js).
// Implementa la parte de la API que usa la app. Los datos viven en el navegador (localStorage) y se pueden
// restablecer con `window.__demoReset()`. Simula la regla principal de seguridad: un invitado solo puede crear reportes.
import { currentDemoRole } from './auth';
import { buildSeed } from './seed';

const STORAGE_KEY = 'inventarios-demo-db-v3';

// ---------- Tipos especiales ----------
export class Timestamp {
  constructor(seconds, nanoseconds = 0) { this.seconds = seconds; this.nanoseconds = nanoseconds; }
  static now() { return Timestamp.fromMillis(Date.now()); }
  static fromDate(d) { return Timestamp.fromMillis(d.getTime()); }
  static fromMillis(ms) { return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6); }
  toDate() { return new Date(this.toMillis()); }
  toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }
  isEqual(o) { return o instanceof Timestamp && o.seconds === this.seconds; }
}
const SERVER_TS = { __sentinel: 'serverTimestamp' };
const DELETE_FIELD = { __sentinel: 'deleteField' };
export const serverTimestamp = () => SERVER_TS;
export const deleteField = () => DELETE_FIELD;
export const documentId = () => '__name__';

// ---------- Almacén ----------
let store = null; // Map path -> data

function serialize(v) {
  return JSON.stringify(v, (k, val) => (val instanceof Timestamp ? { __ts: val.toMillis() } : val));
}
function revive(v) {
  if (v && typeof v === 'object') {
    if ('__ts' in v && Object.keys(v).length === 1) return Timestamp.fromMillis(v.__ts);
    for (const k of Object.keys(v)) v[k] = revive(v[k]);
  }
  return v;
}
function persist() {
  try { window.localStorage.setItem(STORAGE_KEY, serialize([...store.entries()])); } catch { /* sin almacenamiento */ }
}
function load() {
  if (store) return store;
  store = new Map();
  let ok = false;
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (raw) { for (const [k, v] of revive(JSON.parse(raw))) store.set(k, v); ok = store.size > 0; }
  } catch { /* se re-siembra */ }
  if (!ok) { for (const [k, v] of buildSeed(Timestamp)) store.set(k, v); persist(); }
  if (typeof window !== 'undefined') {
    window.__demoReset = () => { window.localStorage.removeItem(STORAGE_KEY); window.location.reload(); };
  }
  return store;
}

const clone = (v) => {
  if (v instanceof Timestamp) return new Timestamp(v.seconds, v.nanoseconds);
  if (Array.isArray(v)) return v.map(clone);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = clone(v[k]); return o; }
  return v;
};

function resolveValue(v) {
  if (v === SERVER_TS) return Timestamp.now();
  if (v instanceof Timestamp) return v;
  if (Array.isArray(v)) return v.map(resolveValue);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = resolveValue(v[k]); return o; }
  return v;
}

// ---------- Referencias ----------
const flat = (segs) => segs.flatMap((s) => String(s).split('/')).filter(Boolean);
let autoId = 0;
const newId = () => `demo${Date.now().toString(36)}${(autoId++).toString(36)}`;

export function collection(base, ...segs) {
  const parts = base && base.type === 'document' ? [base.path, ...flat(segs)] : flat(segs);
  const path = parts.join('/');
  return { type: 'collection', path, id: path.split('/').pop() };
}
export function doc(base, ...segs) {
  let path;
  if (base && base.type === 'collection') path = [base.path, ...(segs.length ? flat(segs) : [newId()])].join('/');
  else if (base && base.type === 'document') path = [base.path, ...flat(segs)].join('/');
  else path = flat(segs).join('/');
  return { type: 'document', path, id: path.split('/').pop() };
}
export const where = (field, op, value) => ({ kind: 'where', field, op, value });
export const orderBy = (field, dir = 'asc') => ({ kind: 'orderBy', field, dir });
export const limit = (n) => ({ kind: 'limit', n });
export const query = (coll, ...constraints) => ({ type: 'query', path: coll.path, constraints });

// ---------- Lecturas ----------
function makeSnap(path, data) {
  const ref = { type: 'document', path, id: path.split('/').pop() };
  return { id: ref.id, ref, exists: () => data !== undefined, data: () => (data === undefined ? undefined : clone(data)) };
}
const getField = (data, field, id) => (field === '__name__' ? id : field.split('.').reduce((o, k) => (o == null ? undefined : o[k]), data));
const cmpVal = (v) => (v instanceof Timestamp ? v.toMillis() : v);

function matches(data, id, c) {
  const a = cmpVal(getField(data, c.field, id));
  const b = Array.isArray(c.value) ? c.value.map(cmpVal) : cmpVal(c.value);
  switch (c.op) {
    case '==': return a === b;
    case '!=': return a !== undefined && a !== b;
    case '<': return a !== undefined && a < b;
    case '<=': return a !== undefined && a <= b;
    case '>': return a !== undefined && a > b;
    case '>=': return a !== undefined && a >= b;
    case 'in': return b.includes(a);
    case 'not-in': return !b.includes(a);
    case 'array-contains': return Array.isArray(a) && a.includes(b);
    default: return false;
  }
}

function runQuery(q) {
  const s = load();
  const prefix = `${q.path}/`;
  let rows = [];
  for (const [path, data] of s.entries()) {
    if (path.startsWith(prefix) && !path.slice(prefix.length).includes('/')) rows.push([path, data]);
  }
  const constraints = q.constraints || [];
  for (const c of constraints.filter((x) => x.kind === 'where')) {
    rows = rows.filter(([path, data]) => matches(data, path.split('/').pop(), c));
  }
  const orders = constraints.filter((x) => x.kind === 'orderBy');
  if (orders.length) {
    rows.sort(([pa, a], [pb, b]) => {
      for (const o of orders) {
        const x = cmpVal(getField(a, o.field, pa.split('/').pop()));
        const y = cmpVal(getField(b, o.field, pb.split('/').pop()));
        if (x === y) continue;
        return (x > y ? 1 : -1) * (o.dir === 'desc' ? -1 : 1);
      }
      return 0;
    });
  } else {
    rows.sort(([pa], [pb]) => (pa > pb ? 1 : -1));
  }
  const lim = constraints.find((x) => x.kind === 'limit');
  if (lim) rows = rows.slice(0, lim.n);
  return rows;
}

const delay = (v) => new Promise((r) => setTimeout(() => r(v), 60)); // latencia mínima para ver estados de carga

export async function getDocs(q) {
  const docs = runQuery(q.type === 'collection' ? { path: q.path, constraints: [] } : q).map(([p, d]) => makeSnap(p, d));
  return delay({ docs, size: docs.length, empty: docs.length === 0, forEach: (fn) => docs.forEach(fn) });
}
export async function getDoc(ref) {
  checkRead(ref.path);
  return delay(makeSnap(ref.path, load().get(ref.path)));
}
export async function getCountFromServer(q) {
  const n = runQuery(q.type === 'collection' ? { path: q.path, constraints: [] } : q).length;
  return delay({ data: () => ({ count: n }) });
}

// ---------- Escrituras ----------
function permError(msg = 'Missing or insufficient permissions.') {
  const e = new Error(msg); e.code = 'permission-denied'; return e;
}
function checkRead(path) {
  if (/^reportes\/[^/]+\/privado\//.test(path) && currentDemoRole() !== 'admin') throw permError();
}
function checkWrite(path, kind) {
  if (currentDemoRole() === 'admin') return;
  if (kind === 'create' && /^reportes\/[^/]+$/.test(path)) return; // el invitado solo puede crear reportes
  throw permError();
}

function setAtPath(obj, dotted, value) {
  const keys = dotted.split('.');
  let o = obj;
  keys.slice(0, -1).forEach((k) => { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k]; });
  const last = keys[keys.length - 1];
  if (value === DELETE_FIELD) delete o[last]; else o[last] = value;
}

function applySet(path, data, opts) {
  const s = load();
  const kind = s.has(path) ? 'update' : 'create';
  checkWrite(path, kind);
  const resolved = resolveValue(data);
  if (opts && opts.merge && s.has(path)) {
    const cur = clone(s.get(path));
    for (const [k, v] of Object.entries(resolved)) setAtPath(cur, k, v);
    s.set(path, cur);
  } else {
    const o = {};
    for (const [k, v] of Object.entries(resolved)) if (v !== DELETE_FIELD) o[k] = v;
    s.set(path, o);
  }
}
function applyUpdate(path, data) {
  const s = load();
  if (!s.has(path)) { const e = new Error(`No document to update: ${path}`); e.code = 'not-found'; throw e; }
  checkWrite(path, 'update');
  const cur = clone(s.get(path));
  for (const [k, v] of Object.entries(resolveValue(data))) setAtPath(cur, k, v);
  s.set(path, cur);
}
function applyDelete(path) {
  checkWrite(path, 'delete');
  load().delete(path);
}

export async function addDoc(coll, data) {
  const ref = doc(coll);
  applySet(ref.path, data);
  persist();
  return delay(ref);
}
export async function setDoc(ref, data, opts) { applySet(ref.path, data, opts); persist(); return delay(); }
export async function updateDoc(ref, data) { applyUpdate(ref.path, data); persist(); return delay(); }
export async function deleteDoc(ref) { applyDelete(ref.path); persist(); return delay(); }

// Aplica una lista de operaciones de forma atómica: si una falla se revierte por completo.
function applyAtomic(ops) {
  const s = load();
  const backup = new Map([...s.entries()].map(([k, v]) => [k, clone(v)]));
  try {
    for (const op of ops) {
      if (op.kind === 'set') applySet(op.ref.path, op.data, op.opts);
      else if (op.kind === 'update') applyUpdate(op.ref.path, op.data);
      else applyDelete(op.ref.path);
    }
    persist();
  } catch (e) {
    store = backup;
    throw e;
  }
}
function opsApi(ops) {
  return {
    set(ref, data, opts) { ops.push({ kind: 'set', ref, data, opts }); return this; },
    update(ref, data) { ops.push({ kind: 'update', ref, data }); return this; },
    delete(ref) { ops.push({ kind: 'delete', ref }); return this; },
  };
}
export function writeBatch() {
  const ops = [];
  return { ...opsApi(ops), commit: async () => { applyAtomic(ops); return delay(); } };
}
export async function runTransaction(_db, fn) {
  const ops = [];
  const tx = { ...opsApi(ops), get: async (ref) => makeSnap(ref.path, load().get(ref.path)) };
  const result = await fn(tx);
  applyAtomic(ops);
  return delay(result);
}

// ---------- Compatibilidad con el módulo real ----------
export const getFirestore = () => ({ demo: true });
export const initializeFirestore = getFirestore;

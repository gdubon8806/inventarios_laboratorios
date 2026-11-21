import test from 'node:test';
import assert from 'node:assert/strict';
import { BATCH_SIZE, applyImport, assignCodes, buildOps, chunk, countCodeNeeds, createFirestoreDeps, formatCode } from './apply.js';
import { addRow, exportModel, makeCurrent, removeRow, run, setCell } from './fixtures.mjs';

const AUTHOR = { uid: 'u-admin', email: 'admin@x.test' };

function reportFor(mutate) {
  const current = makeCurrent();
  const model = exportModel(current);
  mutate(model);
  const { report } = run(model, current);
  assert.equal(report.summary.errorRows, 0, JSON.stringify(report.rows.filter((r) => r.status === 'error').map((r) => r.issues)));
  return { report, current };
}
const byPath = (ops, p) => ops.find((o) => o.path.join('/') === p);

test('códigos: se reservan por prefijo y se asignan consecutivos (insumo 1, resto uno por unidad)', () => {
  const { report } = reportFor((m) => {
    addRow(m, 'registros', 'L1', { nombre: 'Cinta', tipo: 'Suministro', cantidad: 10 });
    addRow(m, 'registros', 'L1', { nombre: 'Switch', tipo: 'Equipo', cantidad: 3 });
    addRow(m, 'registros', 'L2', { nombre: 'Mesa', tipo: 'Mobiliario', cantidad: 2 });
    addRow(m, 'registros', 'L2', { nombre: 'Llave', tipo: 'Herramienta', cantidad: 1 });
  });
  assert.deepEqual(countCodeNeeds(report), { INS: 1, EQU: 3, MOB: 2, HER: 1 });
  const codes = assignCodes(report, { INS: 10, EQU: 100, MOB: 7, HER: 5 });
  const all = [...codes.values()];
  assert.equal(all[0].registro, 'INS-000010');
  assert.deepEqual(all[1].unidades, ['EQU-000100', 'EQU-000101', 'EQU-000102']);
  assert.deepEqual(all[2].unidades, ['MOB-000007', 'MOB-000008']);
  assert.deepEqual(all[3].unidades, ['HER-000005']);
  assert.equal(formatCode('EQU', 7), 'EQU-000007');
});

test('altas: insumo -> 1 doc + índice codigos/; equipo -> registro + N unidades con código y pendienteImprimir', () => {
  const { report, current } = reportFor((m) => {
    addRow(m, 'registros', 'L1', { nombre: 'Cinta', tipo: 'Suministro', cantidad: 10 });
    addRow(m, 'registros', 'L1', { nombre: 'Switch', tipo: 'Equipo', cantidad: 2 });
  });
  const codes = assignCodes(report, { INS: 2, EQU: 4 });
  const ops = buildOps({ report, current, importId: 'imp_T', author: AUTHOR, codes });
  const ins = byPath(ops, 'items/imp_T_r0');
  assert.equal(ins.data.codigo, 'INS-000002');
  assert.equal(ins.data.estadoCodigo, 'pendienteImprimir');
  assert.equal(ins.data.activo, true);
  assert.equal(ins.data.idLab, 'L1');
  assert.equal(byPath(ops, 'codigos/INS-000002').data.registroId, 'imp_T_r0');
  const eq = byPath(ops, 'items/imp_T_r1');
  assert.equal(eq.data.codigo, undefined); // el registro no-insumo no lleva código
  assert.equal(eq.data.totalUnidades, 2);
  assert.equal(byPath(ops, 'items/imp_T_r1/unidades/imp_T_r1_u0').data.codigo, 'EQU-000004');
  assert.equal(byPath(ops, 'items/imp_T_r1/unidades/imp_T_r1_u1').data.codigo, 'EQU-000005');
  assert.equal(byPath(ops, 'codigos/EQU-000005').data.unidadId, 'imp_T_r1_u1');
  // el padre se escribe antes que sus unidades
  assert.ok(ops.indexOf(eq) < ops.indexOf(byPath(ops, 'items/imp_T_r1/unidades/imp_T_r1_u0')));
});

test('modificaciones: solo los campos cambiados, con claves de BD y sello de modificación', () => {
  const { report, current } = reportFor((m) => {
    setCell(m, 'registros', 'i1', 'nombre', 'Router Cisco');
    setCell(m, 'registros', 'i1', 'columna', 'C9');
    setCell(m, 'registros', 'i2', 'tieneVencimiento', 'No');
    setCell(m, 'unidades', 'u2', 'serie', 'SN2-B');
  });
  const ops = buildOps({ report, current, importId: 'imp_T', author: AUTHOR, codes: new Map() });
  const i1 = byPath(ops, 'items/i1');
  assert.equal(i1.op, 'update');
  assert.equal(i1.data.equipo, 'Router Cisco');
  assert.equal(i1.data.columnadelocalizacion, 'C9');
  assert.equal(i1.data.marca, undefined);
  assert.equal(i1.data.ultimaModificacionPor.uid, 'u-admin');
  assert.deepEqual(byPath(ops, 'items/i2').data.fechaVencimiento, null);
  assert.equal(byPath(ops, 'items/i2').data.tieneVencimiento, false);
  assert.equal(byPath(ops, 'items/i1/unidades/u2').data.numeroSerie, 'SN2-B');
});

test('bajas: nunca deleteDoc; baja de registro arrastra unidades y marca códigos; baja de unidad actualiza el contador absoluto', () => {
  const { report, current } = reportFor((m) => {
    removeRow(m, 'registros', 'i5'); // registro ausente (Herramienta con 2 unidades)
    setCell(m, 'unidades', 'u3', 'activo', 'No'); // 1 unidad del registro i1
    removeRow(m, 'unidades', 'u4'); // sus unidades también ausentes: se cubre en cascada
    removeRow(m, 'unidades', 'u5');
  });
  const ops = buildOps({ report, current, importId: 'imp_T', author: AUTHOR, codes: new Map() });
  assert.ok(ops.every((o) => o.op === 'set' || o.op === 'update'), 'solo set/update, nunca delete');
  assert.equal(byPath(ops, 'items/i5').data.activo, false);
  assert.match(byPath(ops, 'items/i5').data.motivoBaja, /imp_T/);
  assert.equal(byPath(ops, 'items/i5/unidades/u4').data.activo, false);
  assert.equal(byPath(ops, 'items/i5/unidades/u5').data.activo, false);
  assert.equal(byPath(ops, 'codigos/HER-000001').data.activo, false);
  assert.equal(byPath(ops, 'items/i1/unidades/u3').data.activo, false);
  assert.equal(byPath(ops, 'codigos/EQU-000003').data.activo, false);
  const parent = byPath(ops, 'items/i1').data;
  assert.equal(parent.cantidad, 2); // 3 activas - 1
  assert.equal(parent.totalUnidades, 2);
  assert.equal(byPath(ops, 'items/i5').data.cantidad, undefined); // el padre dado de baja no recalcula
});

test('restauración: activo=true, limpia campos de baja y reactiva el código', () => {
  const current = makeCurrent();
  current.unidades[1].activo = false;
  const model = exportModel(current, { incluirBajas: true });
  setCell(model, 'unidades', 'u2', 'activo', 'Sí');
  const { report } = run(model, current);
  const ops = buildOps({ report, current, importId: 'imp_T', author: AUTHOR, codes: new Map() });
  const u = byPath(ops, 'items/i1/unidades/u2').data;
  assert.equal(u.activo, true);
  assert.equal(u.motivoBaja.__op, 'delete');
  assert.equal(byPath(ops, 'codigos/EQU-000002').data.activo, true);
  assert.equal(byPath(ops, 'items/i1').data.cantidad, 3); // 2 activas (u1,u3) + 1... u2 estaba inactiva
});

function fakeDeps({ failOnCommit = null, record = null } = {}) {
  const log = { reserved: [], commits: [], saved: [] };
  let rec = record;
  return {
    log,
    async getImportRecord() { return rec; },
    async saveImportRecord(id, data) { rec = { ...(rec || {}), ...data }; log.saved.push(data); },
    async reserveCodes(prefix, n) { log.reserved.push([prefix, n]); return 50; },
    async commitOps(ops) {
      if (failOnCommit !== null && log.commits.length === failOnCommit) { failOnCommit = null; throw new Error('red caída'); }
      log.commits.push(ops.length);
    },
    get record() { return rec; },
  };
}

test('applyImport: reserva rangos una vez, escribe en lotes de 500 y registra la importación', async () => {
  const { report, current } = reportFor((m) => {
    addRow(m, 'registros', 'L1', { nombre: 'Banca', tipo: 'Mobiliario', cantidad: 20 });
    for (let i = 0; i < 30; i++) addRow(m, 'registros', 'L1', { nombre: `Insumo ${i}`, tipo: 'Suministro', cantidad: 5 });
  });
  const deps = fakeDeps();
  const res = await applyImport({ report, current, deps, importId: 'imp_A', author: AUTHOR, fileName: 'x.xlsx' });
  assert.deepEqual(deps.log.reserved.sort(), [['INS', 30], ['MOB', 20]].sort());
  assert.ok(deps.log.commits.every((n) => n <= BATCH_SIZE));
  assert.equal(deps.log.commits.reduce((a, b) => a + b, 0), res.ops);
  assert.equal(deps.record.estado, 'completo');
  assert.equal(deps.record.archivo, 'x.xlsx');
  assert.equal(deps.record.resumen.new, 31);
});

test('applyImport: lote grande se parte en varios batches de ≤500 operaciones', async () => {
  const { report, current } = reportFor((m) => {
    addRow(m, 'registros', 'L1', { nombre: 'Muchas', tipo: 'Mobiliario', cantidad: 20 });
  });
  // 1 registro + 20 unidades + 20 índices de código = 41 operaciones; con tamaño de lote 10 -> 5 lotes
  const deps = fakeDeps();
  const res = await applyImport({ report, current, deps, importId: 'imp_B', author: AUTHOR, batchSize: 10 });
  assert.equal(res.ops, 41);
  assert.deepEqual(deps.log.commits, [10, 10, 10, 10, 1]);
  assert.equal(chunk(Array.from({ length: 1201 }), 500).length, 3);
});

test('applyImport: si falla un lote, reintentar con el mismo id continúa sin repetir ni reservar de nuevo', async () => {
  const { report, current } = reportFor((m) => {
    addRow(m, 'registros', 'L1', { nombre: 'Banca', tipo: 'Mobiliario', cantidad: 20 });
  });
  const deps = fakeDeps({ failOnCommit: 2 });
  await assert.rejects(() => applyImport({ report, current, deps, importId: 'imp_C', author: AUTHOR, batchSize: 10 }), /Falló el lote 3 de 5/);
  assert.equal(deps.record.estado, 'error');
  assert.equal(deps.record.lotesAplicados, 2);
  const reservedBefore = deps.log.reserved.length;
  const res = await applyImport({ report, current, deps, importId: 'imp_C', author: AUTHOR, batchSize: 10 });
  assert.equal(deps.log.reserved.length, reservedBefore, 'no vuelve a reservar códigos');
  assert.deepEqual(deps.log.commits, [10, 10, 10, 10, 1]); // 2 previos + 3 restantes, sin duplicados
  assert.equal(deps.record.estado, 'completo');
  assert.equal(res.alreadyApplied, false);
});

test('applyImport: una importación completa no se vuelve a aplicar (idempotente)', async () => {
  const { report, current } = reportFor((m) => addRow(m, 'registros', 'L1', { nombre: 'Cinta', tipo: 'Suministro', cantidad: 1 }));
  const deps = fakeDeps({ record: { estado: 'completo' } });
  const res = await applyImport({ report, current, deps, importId: 'imp_D', author: AUTHOR });
  assert.equal(res.alreadyApplied, true);
  assert.equal(deps.log.commits.length, 0);
  assert.equal(deps.log.reserved.length, 0);
});

test('applyImport: rechaza informes con errores', async () => {
  const current = makeCurrent();
  const model = exportModel(current);
  setCell(model, 'unidades', 'u1', 'codigo', 'EQU-000999');
  const { report } = run(model, current);
  await assert.rejects(() => applyImport({ report, current, deps: fakeDeps(), importId: 'imp_E', author: AUTHOR }), /no se puede aplicar/);
});

test('capa Firestore: traduce marcadores a serverTimestamp/deleteField/Timestamp y usa set/update/batch', async () => {
  const calls = [];
  const fb = {
    doc: (_db, ...path) => ({ path: path.join('/') }),
    getDoc: async () => ({ exists: () => false }),
    setDoc: async (ref, data, opts) => calls.push(['setDoc', ref.path, data, opts]),
    writeBatch: () => ({
      set: (ref, data, opts) => calls.push(['set', ref.path, data, opts]),
      update: (ref, data) => calls.push(['update', ref.path, data]),
      commit: async () => calls.push(['commit']),
    }),
    runTransaction: async (_db, fn) => fn({ get: async () => ({ exists: () => true, data: () => ({ next: 7 }) }), set: (ref, data) => calls.push(['txset', ref.path, data]) }),
    serverTimestamp: () => 'TS',
    deleteField: () => 'DEL',
    Timestamp: { fromDate: (d) => ({ date: d.toISOString().slice(0, 10) }) },
  };
  const deps = createFirestoreDeps({ firestore: {}, fb });
  assert.equal(await deps.reserveCodes('EQU', 3), 7);
  assert.deepEqual(calls.at(-1), ['txset', 'counters/EQU', { next: 10 }]);
  await deps.commitOps([
    { op: 'update', path: ['items', 'a'], data: { x: { __op: 'serverTimestamp' }, f: { __op: 'delete' }, d: { __op: 'date', value: '2027-01-31' } } },
    { op: 'set', path: ['codigos', 'EQU-1'], data: { activo: false } },
  ]);
  const upd = calls.find((c) => c[0] === 'update');
  assert.equal(upd[2].x, 'TS');
  assert.equal(upd[2].f, 'DEL');
  assert.deepEqual(upd[2].d, { date: '2027-01-31' });
  assert.deepEqual(calls.find((c) => c[0] === 'set')[3], { merge: true });
  assert.equal(calls.at(-1)[0], 'commit');
});

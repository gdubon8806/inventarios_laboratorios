import test from 'node:test';
import assert from 'node:assert/strict';

import {
  chunk, allocateRanges, aggregateEstadoCodigo, needsGeneration, planGeneration,
  splitJobsIntoBatches, validationFlagUpdates, jobCost, MAX_BATCH_WRITES, COUNTER_WRITES_RESERVED,
} from './planning.js';
import {
  buildGenerationWrites, buildDeactivationWrites, buildReactivationWrites, buildUnitUpdate,
  planTypeChange, buildInsToUnitsPhase1, buildUnitsToUnitsChunk, buildUnitsToInsChunk,
  unitsPendingTypeChange, buildMarkPrintedWrites,
} from './builders.js';

const NOW = 'NOW';
const USER = { uid: 'u1', email: 'a@b.c' };

test('chunk', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 3), []);
  assert.throws(() => chunk([1], 0));
});

test('allocateRanges: rangos consecutivos por prefijo y contador ausente = 1', () => {
  const { ranges, nextCounters } = allocateRanges(
    [{ prefix: 'EQU', count: 3 }, { prefix: 'INS', count: 2 }, { prefix: 'EQU', count: 2 }],
    { INS: 10 },
  );
  assert.deepEqual(ranges.EQU, { start: 1, count: 5 });
  assert.deepEqual(ranges.INS, { start: 10, count: 2 });
  assert.deepEqual(nextCounters, { EQU: 6, INS: 12 });
});

test('aggregateEstadoCodigo', () => {
  assert.equal(aggregateEstadoCodigo([]), 'sinCodigo');
  assert.equal(aggregateEstadoCodigo([{ codigo: 'a', estadoCodigo: 'impreso' }, { codigo: 'b', estadoCodigo: 'impreso' }]), 'impreso');
  assert.equal(aggregateEstadoCodigo([{ codigo: 'a', estadoCodigo: 'impreso' }, { codigo: 'b', estadoCodigo: 'pendienteImprimir' }]), 'pendienteImprimir');
  // las unidades en baja no cuentan
  assert.equal(aggregateEstadoCodigo([{ codigo: 'a', estadoCodigo: 'impreso' }, { codigo: 'b', estadoCodigo: 'pendienteImprimir', activo: false }]), 'impreso');
});

test('needsGeneration', () => {
  assert.equal(needsGeneration({ tipo: 'Suministro', cantidad: '5' }), true);
  assert.equal(needsGeneration({ tipo: 'Suministro', cantidad: '5', codigo: 'INS-000001' }), false);
  assert.equal(needsGeneration({ tipo: 'Equipo', cantidad: '5' }), true);
  assert.equal(needsGeneration({ tipo: 'Equipo', cantidad: '5', unidadesGeneradas: 5 }), false);
  assert.equal(needsGeneration({ tipo: 'Equipo', cantidad: '5', unidadesGeneradas: 3 }), true); // reanuda
  assert.equal(needsGeneration({ tipo: 'Equipo', cantidad: '8', unidadesGeneradas: 10 }), false); // hubo bajas
  assert.equal(needsGeneration({ tipo: 'Equipo', cantidad: '5', activo: false }), false);
  assert.equal(needsGeneration({ tipo: '', cantidad: '5' }), false);
});

test('validationFlagUpdates marca y limpia', () => {
  const ups = validationFlagUpdates([
    { id: 'a', tipo: '', cantidad: 3 },
    { id: 'b', tipo: 'Equipo', cantidad: '5 pzas' },
    { id: 'c', tipo: 'Equipo', cantidad: 3, requiereValidacion: true, motivoValidacion: 'sin tipo' },
    { id: 'd', tipo: 'Equipo', cantidad: 3 },
    { id: 'e', tipo: '', cantidad: 3, requiereValidacion: true, motivoValidacion: 'sin tipo' }, // ya marcado igual
    { id: 'f', tipo: '', cantidad: 3, activo: false },
  ]);
  assert.deepEqual(ups.map((u) => u.id), ['a', 'b', 'c']);
  assert.equal(ups[0].set.motivoValidacion, 'sin tipo');
  assert.equal(ups[2].clear, true);
});

test('planGeneration: separa jobs, validación D11, omitidos e incongruentes', () => {
  const records = [
    { id: 'ins1', tipo: 'Suministro', cantidad: '50', equipo: 'Guantes' },
    { id: 'ins2', tipo: 'Suministro', cantidad: '250', equipo: 'Tornillos' },
    { id: 'equ1', tipo: 'Equipo', cantidad: '10', equipo: 'PC' },
    { id: 'equ2', tipo: 'Equipo', cantidad: '14', equipo: 'Laptop' },
    { id: 'her1', tipo: 'Herramienta', cantidad: '11', equipo: 'Taladro' },
    { id: 'mob1', tipo: 'Mobiliario', cantidad: '20', equipo: 'Silla' },
    { id: 'mob2', tipo: 'Mobiliario', cantidad: '21', equipo: 'Mesa' },
    { id: 'bad1', tipo: '', cantidad: '3', equipo: 'X' },
    { id: 'bad2', tipo: 'Equipo', cantidad: '5 pzas', equipo: 'Y' },
    { id: 'done', tipo: 'Suministro', cantidad: '3', codigo: 'INS-000009' },
    { id: 'baja', tipo: 'Equipo', cantidad: '3', activo: false },
    { id: 'vacio', tipo: 'Equipo', cantidad: '0' },
  ];
  const plan = planGeneration(records, { equ2: 'crear', her1: 'omitir' });
  assert.deepEqual(plan.jobs.map((j) => [j.recordId, j.kind, j.units]), [
    ['ins1', 'ins', 0], ['equ1', 'units', 10], ['equ2', 'units', 14], ['mob1', 'units', 20],
  ]);
  assert.deepEqual(plan.needValidation.map((n) => [n.id, n.action]), [['ins2', 'confirmar'], ['mob2', 'validar-uno-a-uno']]);
  assert.deepEqual(plan.omitted, ['her1']);
  assert.deepEqual(plan.incongruentes.map((i) => i.id), ['bad1', 'bad2']);
  assert.deepEqual(plan.done, ['done', 'vacio']);
});

test('planGeneration: reanudar un registro con progreso no vuelve a pedir validación', () => {
  const plan = planGeneration([{ id: 'x', tipo: 'Equipo', cantidad: '30', unidadesGeneradas: 12 }]);
  assert.equal(plan.needValidation.length, 0);
  assert.deepEqual(plan.jobs, [{ recordId: 'x', kind: 'units', units: 18 }]);
});

test('splitJobsIntoBatches: nunca excede el tope y la suma de unidades se conserva', () => {
  const jobs = [
    { recordId: 'a', kind: 'ins', units: 0 },
    { recordId: 'b', kind: 'units', units: 300 }, // 601 escrituras -> se parte
    { recordId: 'c', kind: 'units', units: 5 },
    { recordId: 'd', kind: 'ins', units: 0 },
  ];
  const batches = splitJobsIntoBatches(jobs);
  const cap = MAX_BATCH_WRITES - COUNTER_WRITES_RESERVED;
  for (const b of batches) {
    const cost = b.reduce((s, p) => s + jobCost({ kind: p.kind, units: p.unitsToCreate }), 0);
    assert.ok(cost <= cap, `lote con ${cost} > ${cap}`);
  }
  const unitsOfB = batches.flat().filter((p) => p.recordId === 'b');
  assert.equal(unitsOfB.reduce((s, p) => s + p.unitsToCreate, 0), 300);
  assert.equal(unitsOfB.filter((p) => p.final).length, 1);
  assert.equal(unitsOfB[unitsOfB.length - 1].final, true);
  assert.equal(batches.flat().filter((p) => p.recordId === 'c')[0].unitsToCreate, 5);
  // un registro no aparece dos veces en el mismo lote
  for (const b of batches) {
    const ids = b.map((p) => p.recordId);
    assert.equal(new Set(ids).size, ids.length);
  }
});

test('splitJobsIntoBatches: muchos insumos se reparten en lotes', () => {
  const jobs = Array.from({ length: 500 }, (_, i) => ({ recordId: `r${i}`, kind: 'ins', units: 0 }));
  const batches = splitJobsIntoBatches(jobs);
  assert.equal(batches.length, 3); // 223 por lote (446/2)
  assert.equal(batches.flat().length, 500);
});

// ---------------------------------------------------------------------------------------------

test('buildGenerationWrites: INS recibe código; contador avanza; escribe índice codigos', () => {
  const { writes, nextCounters, results } = buildGenerationWrites({
    jobs: [{ recordId: 'r1', kind: 'ins', unitsToCreate: 0, final: true }],
    records: { r1: { tipo: 'Suministro', cantidad: '4', idLab: 'L1' } },
    counters: { INS: 7 }, now: NOW, user: USER,
  });
  assert.deepEqual(nextCounters, { INS: 8 });
  const rec = writes.find((w) => w.path === 'items/r1');
  assert.equal(rec.data.codigo, 'INS-000007');
  assert.equal(rec.data.estadoCodigo, 'pendienteImprimir');
  const idx = writes.find((w) => w.path === 'codigos/INS-000007');
  assert.equal(idx.data.registroId, 'r1');
  assert.equal(idx.data.unidadId, null);
  assert.deepEqual(writes.find((w) => w.path === 'counters/INS').data, { next: 8 });
  assert.equal(results[0].created, 1);
});

test('buildGenerationWrites: EQU crea N unidades con códigos consecutivos y ids deterministas', () => {
  const { writes, nextCounters } = buildGenerationWrites({
    jobs: [{ recordId: 'r1', kind: 'units', unitsToCreate: 3, final: true }],
    records: { r1: { tipo: 'Equipo', cantidad: '3', idLab: 'L1' } },
    counters: {}, now: NOW, user: USER,
  });
  assert.deepEqual(nextCounters, { EQU: 4 });
  const units = writes.filter((w) => w.path.startsWith('items/r1/unidades/'));
  assert.deepEqual(units.map((u) => u.path), ['items/r1/unidades/u0001', 'items/r1/unidades/u0002', 'items/r1/unidades/u0003']);
  assert.deepEqual(units.map((u) => u.data.codigo), ['EQU-000001', 'EQU-000002', 'EQU-000003']);
  assert.ok(units.every((u) => u.data.estado === 'bueno' && u.data.activo === true && u.data.numeroSerie === ''));
  assert.equal(writes.filter((w) => w.path.startsWith('codigos/')).length, 3);
  const rec = writes.find((w) => w.path === 'items/r1');
  assert.equal(rec.data.estadoCodigo, 'pendienteImprimir');
  assert.equal(rec.data.unidadesGeneradas, 3);
});

test('buildGenerationWrites: parte no final conserva sinCodigo y continúa numeración de unidades', () => {
  const first = buildGenerationWrites({
    jobs: [{ recordId: 'r1', kind: 'units', unitsToCreate: 2, final: false }],
    records: { r1: { tipo: 'Equipo', cantidad: '5', idLab: 'L1' } },
    counters: {}, now: NOW,
  });
  const recW = first.writes.find((w) => w.path === 'items/r1');
  assert.equal(recW.data.estadoCodigo, undefined);
  assert.equal(recW.data.unidadesGeneradas, 2);
  const second = buildGenerationWrites({
    jobs: [{ recordId: 'r1', kind: 'units', unitsToCreate: 3, final: true }],
    records: { r1: { tipo: 'Equipo', cantidad: '5', idLab: 'L1', unidadesGeneradas: 2 } },
    counters: first.nextCounters, now: NOW,
  });
  assert.deepEqual(
    second.writes.filter((w) => w.path.includes('/unidades/')).map((w) => w.path),
    ['items/r1/unidades/u0003', 'items/r1/unidades/u0004', 'items/r1/unidades/u0005'],
  );
  assert.deepEqual(second.writes.filter((w) => w.path.includes('/unidades/')).map((w) => w.data.codigo), ['EQU-000003', 'EQU-000004', 'EQU-000005']);
  assert.equal(second.writes.find((w) => w.path === 'items/r1').data.estadoCodigo, 'pendienteImprimir');
});

test('buildGenerationWrites: idempotente (no pasa de cantidad ni repite INS)', () => {
  const dup = buildGenerationWrites({
    jobs: [{ recordId: 'r1', kind: 'units', unitsToCreate: 3, final: true }],
    records: { r1: { tipo: 'Equipo', cantidad: '3', idLab: 'L1', unidadesGeneradas: 3 } },
    counters: { EQU: 4 }, now: NOW,
  });
  assert.equal(dup.results[0].skipped, true);
  assert.equal(dup.writes.filter((w) => w.path.includes('/unidades/')).length, 0);
  const ins = buildGenerationWrites({
    jobs: [{ recordId: 'r2', kind: 'ins', unitsToCreate: 0, final: true }],
    records: { r2: { tipo: 'Suministro', cantidad: '3', codigo: 'INS-000001' } },
    counters: { INS: 2 }, now: NOW,
  });
  assert.equal(ins.results[0].skipped, true);
});

test('buildGenerationWrites: omite incongruentes, en baja o inexistentes', () => {
  const { results, writes } = buildGenerationWrites({
    jobs: [
      { recordId: 'a', kind: 'ins', unitsToCreate: 0, final: true },
      { recordId: 'b', kind: 'ins', unitsToCreate: 0, final: true },
      { recordId: 'c', kind: 'ins', unitsToCreate: 0, final: true },
    ],
    records: { a: { tipo: '', cantidad: '1' }, b: { tipo: 'Suministro', cantidad: '1', activo: false } },
    counters: {}, now: NOW,
  });
  assert.ok(results.every((r) => r.skipped));
  assert.equal(writes.length, 0); // sin escrituras ni contadores
});

test('buildGenerationWrites: varios prefijos en un lote usan contadores independientes', () => {
  const { nextCounters, writes } = buildGenerationWrites({
    jobs: [
      { recordId: 'a', kind: 'units', unitsToCreate: 2, final: true },
      { recordId: 'b', kind: 'ins', unitsToCreate: 0, final: true },
      { recordId: 'c', kind: 'units', unitsToCreate: 1, final: true },
    ],
    records: {
      a: { tipo: 'Equipo', cantidad: '2' }, b: { tipo: 'Suministro', cantidad: '9' }, c: { tipo: 'Mobiliario', cantidad: '1' },
    },
    counters: { EQU: 100 }, now: NOW,
  });
  assert.deepEqual(nextCounters, { EQU: 102, INS: 2, MOB: 2 });
  assert.equal(writes.filter((w) => w.path.startsWith('counters/')).length, 3);
  const codes = writes.filter((w) => w.path.startsWith('codigos/')).map((w) => w.path.slice(8));
  assert.equal(new Set(codes).size, codes.length); // sin duplicados
});

test('buildGenerationWrites modo increase: sube cantidad y marca pendiente', () => {
  const { writes } = buildGenerationWrites({
    jobs: [{ recordId: 'r1', kind: 'units', unitsToCreate: 7, final: true, mode: 'increase' }],
    records: { r1: { tipo: 'Equipo', cantidad: 3, idLab: 'L1', unidadesGeneradas: 3 } },
    counters: { EQU: 4 }, now: NOW,
  });
  const rec = writes.find((w) => w.path === 'items/r1');
  assert.equal(rec.data.cantidad, 10);
  assert.equal(rec.data.unidadesGeneradas, 10);
  assert.equal(rec.data.estadoCodigo, 'pendienteImprimir');
  assert.equal(rec.data.cantidadObjetivo, null);
  assert.equal(writes.filter((w) => w.path.includes('/unidades/')).length, 7);
  assert.equal(writes.find((w) => w.path === 'items/r1/unidades/u0004').data.codigo, 'EQU-000004');
});

// ---------------------------------------------------------------------------------------------

const active = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({ id: unit(i + 1), codigo: `EQU-${String(i + 1).padStart(6, '0')}`, estadoCodigo: 'impreso', activo: true, ...extra }));
const unit = (i) => `u${String(i).padStart(4, '0')}`;

test('buildDeactivationWrites: baja lógica con motivo, nunca borra, recalcula cantidad', () => {
  const units = active(10);
  const r = buildDeactivationWrites({
    record: { cantidad: 10 }, recordId: 'r1', units: [units[8], units[9]], activeUnits: units, motivo: 'Dañadas', now: NOW, user: USER,
  });
  assert.equal(r.ok, true);
  assert.equal(r.newCantidad, 8);
  assert.ok(r.writes.every((w) => w.op === 'update')); // jamás delete
  assert.equal(r.writes.find((w) => w.path === 'codigos/EQU-000010').data.activo, false);
  assert.equal(r.writes.find((w) => w.path === 'items/r1').data.cantidad, 8);
  assert.equal(r.writes.find((w) => w.path === 'items/r1').data.estadoCodigo, 'impreso');
  assert.equal(r.writes.find((w) => w.path === 'items/r1/unidades/u0009').data.motivoBaja, 'Dañadas');
});

test('buildDeactivationWrites: valida motivo, selección y estado', () => {
  const units = active(3);
  const base = { record: { cantidad: 3 }, recordId: 'r1', activeUnits: units, now: NOW };
  assert.equal(buildDeactivationWrites({ ...base, units: [units[0]], motivo: 'x' }).ok, false);
  assert.equal(buildDeactivationWrites({ ...base, units: [], motivo: 'motivo largo' }).ok, false);
  assert.equal(buildDeactivationWrites({ ...base, units: [units[0], units[0]], motivo: 'motivo largo' }).ok, false);
  assert.equal(buildDeactivationWrites({ ...base, units: [{ ...units[0], activo: false }], motivo: 'motivo largo' }).ok, false);
});

test('buildReactivationWrites', () => {
  const u = { id: 'u0003', codigo: 'EQU-000003', activo: false, estadoCodigo: 'impreso' };
  const r = buildReactivationWrites({ record: { cantidad: 2 }, recordId: 'r1', unit: u, activeUnits: active(2), now: NOW, user: USER });
  assert.equal(r.ok, true);
  assert.equal(r.newCantidad, 3);
  assert.equal(r.writes.find((w) => w.path === 'codigos/EQU-000003').data.activo, true);
  assert.equal(buildReactivationWrites({ record: { cantidad: 2 }, recordId: 'r1', unit: { id: 'x', activo: true }, now: NOW }).ok, false);
});

test('buildUnitUpdate: sólo campos permitidos; código y tipo no se editan', () => {
  assert.equal(buildUnitUpdate({ recordId: 'r', unitId: 'u0001', fields: { codigo: 'EQU-9' }, now: NOW }).ok, false);
  assert.equal(buildUnitUpdate({ recordId: 'r', unitId: 'u0001', fields: { tipo: 'Mobiliario' }, now: NOW }).ok, false);
  assert.equal(buildUnitUpdate({ recordId: 'r', unitId: 'u0001', fields: { estado: 'roto' }, now: NOW }).ok, false);
  const ok = buildUnitUpdate({ recordId: 'r', unitId: 'u0001', fields: { numeroSerie: 'SN1', estado: 'malo' }, now: NOW, user: USER });
  assert.equal(ok.ok, true);
  assert.equal(ok.writes[0].data.numeroSerie, 'SN1');
  assert.equal(ok.writes[0].data.ultimaModificacion, NOW);
});

// ---------------------------------------------------------------------------------------------

test('planTypeChange: casos del §4.3', () => {
  const ins = { tipo: 'Suministro', cantidad: '4', codigo: 'INS-000001' };
  assert.equal(planTypeChange({ record: ins, newTipo: 'Suministro' }).code, 'mismo-tipo');
  assert.equal(planTypeChange({ record: ins, newTipo: 'Cosa' }).code, 'tipo-nuevo-invalido');
  assert.equal(planTypeChange({ record: { tipo: '' }, newTipo: 'Equipo' }).code, 'tipo-actual-invalido');
  assert.equal(planTypeChange({ record: ins, newTipo: 'Equipo' }).kind, 'ins-to-units');
  assert.equal(planTypeChange({ record: { ...ins, cantidad: '0' }, newTipo: 'Equipo' }).code, 'cantidad-invalida');
  assert.equal(planTypeChange({ record: { ...ins, cantidad: 'x' }, newTipo: 'Equipo' }).code, 'cantidad-invalida');
  assert.equal(planTypeChange({ record: { tipo: 'Equipo' }, activeUnits: active(2), newTipo: 'Mobiliario' }).kind, 'units-to-units');
  // unidades -> INS bloqueado si hay serie/fundaempresa
  const withData = [{ ...active(1)[0], numeroSerie: 'SN1' }, ...active(2).slice(1)];
  const blocked = planTypeChange({ record: { tipo: 'Equipo' }, activeUnits: withData, newTipo: 'Suministro' });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, 'bloqueado-datos-por-unidad');
  assert.equal(blocked.unidadesConDatos, 1);
  assert.equal(planTypeChange({ record: { tipo: 'Equipo' }, activeUnits: withData, newTipo: 'Suministro', override: true }).ok, true);
  assert.equal(planTypeChange({ record: { tipo: 'Equipo' }, activeUnits: active(2), newTipo: 'Suministro' }).kind, 'units-to-ins');
  assert.equal(planTypeChange({ record: { tipo: 'Equipo', activo: false }, activeUnits: [], newTipo: 'Mobiliario' }).code, 'en-baja');
});

test('buildInsToUnitsPhase1 + generación: INS -> EQU conserva codigoAnterior y crea unidades', () => {
  const rec = { tipo: 'Suministro', cantidad: '3', codigo: 'INS-000045', idLab: 'L1' };
  const p1 = buildInsToUnitsPhase1({ record: rec, recordId: 'r1', newTipo: 'Equipo', now: NOW, user: USER });
  const recW = p1.writes.find((w) => w.path === 'items/r1').data;
  assert.equal(recW.tipo, 'Equipo');
  assert.equal(recW.codigoAnterior, 'INS-000045');
  assert.equal(recW.codigo, null);
  assert.equal(recW.estadoCodigo, 'sinCodigo');
  assert.equal(recW.cambioTipoEnCurso, true);
  assert.equal(p1.writes.find((w) => w.path === 'codigos/INS-000045').data.reemplazado, true);
  // fase 2: el registro ya con el estado de la fase 1
  const after = { ...rec, ...recW };
  assert.equal(needsGeneration(after), true);
  const gen = buildGenerationWrites({
    jobs: [{ recordId: 'r1', kind: 'units', unitsToCreate: 3, final: true }], records: { r1: after }, counters: { EQU: 50 }, now: NOW,
  });
  assert.equal(gen.writes.find((w) => w.path === 'items/r1').data.cambioTipoEnCurso, false);
  assert.equal(gen.writes.find((w) => w.path === 'items/r1').data.estadoCodigo, 'pendienteImprimir');
  assert.deepEqual(gen.writes.filter((w) => w.path.includes('/unidades/')).map((w) => w.data.codigo), ['EQU-000050', 'EQU-000051', 'EQU-000052']);
});

test('buildUnitsToUnitsChunk: EQU -> MOB asigna códigos nuevos, guarda anterior y redirige el viejo', () => {
  const units = active(3);
  const r = buildUnitsToUnitsChunk({
    record: { tipo: 'Equipo', idLab: 'L1' }, recordId: 'r1', units, newTipo: 'Mobiliario', counters: { MOB: 9 },
    isFirst: true, isLast: true, now: NOW, user: USER,
  });
  const u1 = r.writes.find((w) => w.path === 'items/r1/unidades/u0001').data;
  assert.equal(u1.codigo, 'MOB-000009');
  assert.equal(u1.codigoAnterior, 'EQU-000001');
  assert.equal(u1.tipo, 'Mobiliario');
  assert.equal(u1.estadoCodigo, 'pendienteImprimir');
  const old = r.writes.find((w) => w.path === 'codigos/EQU-000001').data;
  assert.equal(old.reemplazadoPor, 'MOB-000009');
  assert.equal(r.writes.find((w) => w.path === 'codigos/MOB-000011').data.unidadId, 'u0003');
  const rec = r.writes.find((w) => w.path === 'items/r1').data;
  assert.equal(rec.tipo, 'Mobiliario');
  assert.equal(rec.estadoCodigo, 'pendienteImprimir');
  assert.equal(rec.cambioTipoEnCurso, false);
  assert.deepEqual(r.nextCounters, { MOB: 12 });
  assert.ok(r.writes.every((w) => w.op !== 'delete'));
});

test('buildUnitsToUnitsChunk: chunk intermedio no toca el registro; reanudación con unitsPendingTypeChange', () => {
  const units = active(4);
  const mid = buildUnitsToUnitsChunk({ record: { tipo: 'Equipo' }, recordId: 'r1', units: units.slice(0, 2), newTipo: 'Herramienta', isFirst: false, isLast: false, now: NOW });
  assert.equal(mid.writes.some((w) => w.path === 'items/r1'), false);
  const migrated = units.map((u, i) => (i < 2 ? { ...u, tipo: 'Herramienta' } : { ...u, tipo: 'Equipo' }));
  assert.deepEqual(unitsPendingTypeChange(migrated, 'Herramienta').map((u) => u.id), ['u0003', 'u0004']);
});

test('buildUnitsToInsChunk: unidades -> INS da de baja las unidades y asigna código INS al final', () => {
  const units = active(3);
  const r = buildUnitsToInsChunk({ record: { tipo: 'Equipo', idLab: 'L1', cantidad: 3 }, recordId: 'r1', units, counters: { INS: 5 }, isFirst: true, isLast: true, now: NOW, user: USER });
  assert.ok(r.writes.filter((w) => w.path.includes('/unidades/')).every((w) => w.data.activo === false && w.data.motivoBaja === 'cambio de tipo'));
  const rec = r.writes.find((w) => w.path === 'items/r1').data;
  assert.equal(rec.tipo, 'Suministro');
  assert.equal(rec.codigo, 'INS-000005');
  assert.equal(rec.estadoCodigo, 'pendienteImprimir');
  assert.equal(r.writes.find((w) => w.path === 'codigos/INS-000005').data.unidadId, null);
  assert.equal(r.writes.find((w) => w.path === 'codigos/EQU-000001').data.activo, false);
  assert.ok(r.writes.every((w) => w.op !== 'delete'));
});

test('buildMarkPrintedWrites', () => {
  const w = buildMarkPrintedWrites({ targets: [{ recordId: 'r1', unidadId: 'u0001' }, { recordId: 'r2' }], now: NOW });
  assert.deepEqual(w.map((x) => x.path), ['items/r1/unidades/u0001', 'items/r2']);
  assert.ok(w.every((x) => x.data.estadoCodigo === 'impreso'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { groupOpenReports, computeLabStats, codeStripeColor, reportedLabel, filterRecords } from './stats.js';
import { validarVencimiento, fechaInputADate, valorAFechaInput, diasParaVencer } from '../validation/vencimiento.js';
import { normalizeText } from '../codes/normalize.js';

const hoy = new Date(2026, 10, 21);

test('groupOpenReports cuenta unidades distintas y 1 para reportes sin unidad; ignora resueltos', () => {
  const g = groupOpenReports([
    { registroId: 'a', unidadId: 'u0001', estadoReporte: 'abierto' },
    { registroId: 'a', unidadId: 'u0001', estadoReporte: 'abierto' },
    { registroId: 'a', unidadId: 'u0002', estadoReporte: 'abierto' },
    { registroId: 'a', unidadId: 'u0003', estadoReporte: 'resuelto' },
    { registroId: 'b', unidadId: null, estadoReporte: 'abierto' },
  ]);
  assert.equal(g.get('a').count, 2);
  assert.equal(g.get('b').count, 1);
  assert.equal(g.has('c'), false);
});

test('computeLabStats: registros, total por cantidad, reportadas y pendientes (solo activos)', () => {
  const items = [
    { id: '1', tipo: 'Equipo', cantidad: 10, estadoCodigo: 'pendienteImprimir' },
    { id: '2', tipo: 'Suministro', cantidad: '5', estadoCodigo: 'impreso' },
    { id: '3', tipo: 'Mobiliario', cantidad: 3, estadoCodigo: 'sinCodigo' },
    { id: '4', tipo: '', cantidad: 'varios', requiereValidacion: true },
    { id: '5', tipo: 'Equipo', cantidad: 9, activo: false },
    { id: '6', tipo: 'Herramienta', cantidad: 2, pendienteValidar: true, estadoCodigo: 'sinCodigo' },
  ];
  const reports = [
    { registroId: '1', unidadId: 'u0001', estadoReporte: 'abierto' },
    { registroId: '1', unidadId: 'u0002', estadoReporte: 'abierto' },
    { registroId: '2', unidadId: null, estadoReporte: 'abierto' },
    { registroId: '5', unidadId: 'u0001', estadoReporte: 'abierto' }, // registro de baja: no cuenta
  ];
  const s = computeLabStats(items, reports);
  assert.equal(s.registros, 5);
  assert.equal(s.totalCantidad, 10 + 5 + 3 + 2);
  assert.equal(s.reportadas, 3);
  assert.equal(s.pendientesImpresion, 1);
  assert.equal(s.pendientesCodigo, 1);
  assert.equal(s.incongruentes, 1);
  assert.equal(s.porValidar, 1);
});

test('reportadas nunca supera la cantidad del registro', () => {
  const s = computeLabStats(
    [{ id: '1', tipo: 'Equipo', cantidad: 1 }],
    [{ registroId: '1', unidadId: 'u1', estadoReporte: 'abierto' }, { registroId: '1', unidadId: 'u2', estadoReporte: 'abierto' }],
  );
  assert.equal(s.reportadas, 1);
});

test('franja de color según estadoCodigo', () => {
  assert.equal(codeStripeColor('sinCodigo'), '#ff9800');
  assert.equal(codeStripeColor(undefined), '#ff9800');
  assert.equal(codeStripeColor('pendienteImprimir'), '#d32f2f');
  assert.equal(codeStripeColor('impreso'), null);
});

test('texto del chip Reportado', () => {
  assert.equal(reportedLabel({ tipo: 'Equipo', cantidad: 10 }, 2), '2 de 10 unidades reportadas');
  assert.equal(reportedLabel({ tipo: 'Suministro', cantidad: 10 }, 1), 'Reportado');
  assert.equal(reportedLabel({ tipo: 'Equipo', cantidad: 10 }, 0), null);
});

test('filterRecords ignora tildes, mayúsculas y espacios; no muta los items', () => {
  const items = [{ equipo: ' Termómetro ', tipo: 'Equipo' }, { equipo: 'Martillo', tipo: 'Herramienta' }];
  const copia = JSON.stringify(items);
  assert.equal(filterRecords(items, { text: '  TERMOMETRO' }, normalizeText).length, 1);
  assert.equal(filterRecords(items, { tipos: ['Herramienta'] }, normalizeText)[0].equipo, 'Martillo');
  assert.equal(JSON.stringify(items), copia);
});

test('vencimiento: sin activar -> fecha null; activado exige fecha válida', () => {
  assert.deepEqual(validarVencimiento({ tieneVencimiento: false, fecha: '2030-01-01' }, hoy), { ok: true, fecha: null });
  assert.equal(validarVencimiento({ tieneVencimiento: true, fecha: '' }, hoy).ok, false);
  assert.equal(validarVencimiento({ tieneVencimiento: true, fecha: '2026-02-30' }, hoy).ok, false);
  assert.equal(validarVencimiento({ tieneVencimiento: true, fecha: '1999-01-01' }, hoy).ok, false);
  assert.equal(validarVencimiento({ tieneVencimiento: true, fecha: '2101-01-01' }, hoy).ok, false);
  const pasada = validarVencimiento({ tieneVencimiento: true, fecha: '2026-01-01' }, hoy);
  assert.equal(pasada.ok, true);
  assert.equal(pasada.vencido, true);
  assert.equal(validarVencimiento({ tieneVencimiento: true, fecha: '2027-01-01' }, hoy).vencido, false);
});

test('vencimiento: conversiones de fecha', () => {
  const d = fechaInputADate('2027-03-05');
  assert.equal(d.getHours(), 12);
  assert.equal(valorAFechaInput(d), '2027-03-05');
  assert.equal(valorAFechaInput({ toDate: () => d }), '2027-03-05');
  assert.equal(valorAFechaInput(null), '');
  assert.equal(diasParaVencer(fechaInputADate('2026-11-25'), hoy), 4);
  assert.equal(diasParaVencer(fechaInputADate('2026-11-20'), hoy), -1);
  assert.equal(diasParaVencer(null, hoy), null);
});

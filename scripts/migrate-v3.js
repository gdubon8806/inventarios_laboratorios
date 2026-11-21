#!/usr/bin/env node
/* eslint-disable no-console */
// Migración v3 (PLAN_FUNCIONALIDADES_V2.md §11).
//
//   node scripts/migrate-v3.js            -> DRY-RUN: solo muestra el informe, no escribe nada
//   node scripts/migrate-v3.js --apply    -> guarda un respaldo JSON en backups/ y aplica los cambios
//
// Requiere firebase-admin y credenciales de una cuenta de servicio:
//   set GOOGLE_APPLICATION_CREDENTIALS=ruta\a\serviceAccountKey.json
//
// Qué hace (idempotente: volver a correrlo no cambia nada que ya esté migrado):
//   - items y laboratorios sin campo `activo`  -> activo: true
//   - items sin código y sin `estadoCodigo`     -> estadoCodigo: 'sinCodigo'
//   - cantidad "12" (texto) -> 12 (número). Si no es un entero >= 0 NO se toca el valor: se marca.
//   - observaciones [] -> "" ; observaciones con texto en arreglo -> texto unido por saltos de línea
//   - registros sin tipo / tipo no reconocido / cantidad inválida -> requiereValidacion: true + motivoValidacion
//   - migradoV3: true en cada documento que se modifica
// Qué NO hace: no corrige tipo ni cantidad por su cuenta, no genera códigos, no borra nada.
// Los datos viejos (observaciones, serie, etc.) se conservan.

const fs = require('fs');
const path = require('path');

// ---- Lógica pura (se mantiene en sincronía con lib/validation/registro.js y lib/constants/tipos.js) ----
const TIPOS = ['Herramienta', 'Suministro', 'Equipo', 'Mobiliario'];
const BORRAR = Symbol('borrar-campo'); // se reemplaza por FieldValue.delete() al aplicar
const CANTIDAD_ALTA = 500;

function parseCantidad(raw) {
  if (typeof raw === 'number') {
    if (Number.isInteger(raw) && raw >= 0) return { ok: true, value: raw };
    return { ok: false, motivo: `cantidad inválida (${raw})` };
  }
  if (raw === undefined || raw === null) return { ok: false, motivo: 'cantidad vacía' };
  const texto = String(raw).trim();
  if (texto === '') return { ok: false, motivo: 'cantidad vacía' };
  const n = Number(texto.replace(',', '.'));
  if (!Number.isFinite(n) || !/^-?\d+([.,]\d+)?$/.test(texto)) {
    return { ok: false, motivo: `cantidad no numérica ("${texto}")` };
  }
  if (!Number.isInteger(n) || n < 0) return { ok: false, motivo: `cantidad inválida ("${texto}")` };
  return { ok: true, value: n };
}

function motivosIncongruencia({ tipo, cantidad }) {
  const motivos = [];
  if (typeof tipo !== 'string' || tipo.trim() === '') motivos.push('sin tipo');
  else if (!TIPOS.includes(tipo)) motivos.push(`tipo no reconocido ("${tipo}")`);
  const c = parseCantidad(cantidad);
  if (!c.ok) motivos.push(c.motivo);
  return motivos;
}

// Cambios que hay que hacerle a un documento de `items` ({} = nada que hacer).
function planItemPatch(d) {
  const patch = {};

  if (d.activo === undefined) patch.activo = true;

  const tieneCodigo = typeof d.codigo === 'string' && d.codigo.trim() !== '';
  if (d.estadoCodigo === undefined && !tieneCodigo) patch.estadoCodigo = 'sinCodigo';

  const c = parseCantidad(d.cantidad);
  if (c.ok && d.cantidad !== c.value) patch.cantidad = c.value;

  if (Array.isArray(d.observaciones)) {
    patch.observaciones = d.observaciones.map((o) => String(o)).filter((o) => o.trim() !== '').join('\n');
  }

  const motivos = motivosIncongruencia(d);
  if (motivos.length > 0) {
    const texto = motivos.join('; ');
    if (d.requiereValidacion !== true) patch.requiereValidacion = true;
    if (d.motivoValidacion !== texto) patch.motivoValidacion = texto;
  } else if (d.requiereValidacion === true) {
    // Marca vieja que ya no aplica (el registro hoy es válido)
    patch.requiereValidacion = BORRAR;
    patch.motivoValidacion = BORRAR;
  }

  if (Object.keys(patch).length > 0 && d.migradoV3 !== true) patch.migradoV3 = true;
  return patch;
}

function planLabPatch(d) {
  const patch = {};
  if (d.activo === undefined) patch.activo = true;
  if (Object.keys(patch).length > 0 && d.migradoV3 !== true) patch.migradoV3 = true;
  return patch;
}

// Informe a partir de los documentos (sin tocar Firestore). items/labs: [{ id, data }]
function buildReport(labs, items) {
  const nombreLab = {};
  labs.forEach((l) => { nombreLab[l.id] = l.data.name || l.id; });

  const itemPatches = [];
  const labPatches = [];
  const incongruentes = []; // { id, idLab, equipo, motivos }
  const incongruentesPorLab = {};
  const cantidadesAltas = [];
  const resumen = {
    items: items.length,
    labs: labs.length,
    itemsConCambios: 0,
    labsConCambios: 0,
    cantidadATexto: 0,
    observacionesArreglo: 0,
    conCodigoYSinEstado: 0,
  };

  for (const { id, data } of items) {
    const patch = planItemPatch(data);
    if (Object.keys(patch).length > 0) {
      itemPatches.push({ id, patch });
      resumen.itemsConCambios++;
      if ('cantidad' in patch) resumen.cantidadATexto++;
      if ('observaciones' in patch) resumen.observacionesArreglo++;
    }
    const tieneCodigo = typeof data.codigo === 'string' && data.codigo.trim() !== '';
    if (tieneCodigo && data.estadoCodigo === undefined) resumen.conCodigoYSinEstado++;

    const motivos = motivosIncongruencia(data);
    if (motivos.length > 0 && data.activo !== false) {
      incongruentes.push({ id, idLab: data.idLab, equipo: data.equipo, motivos });
      incongruentesPorLab[data.idLab] = (incongruentesPorLab[data.idLab] || 0) + 1;
    }
    const cant = parseCantidad(data.cantidad);
    if (cant.ok && cant.value > CANTIDAD_ALTA) {
      cantidadesAltas.push({ id, idLab: data.idLab, equipo: data.equipo, tipo: data.tipo, cantidad: cant.value });
    }
  }
  for (const { id, data } of labs) {
    const patch = planLabPatch(data);
    if (Object.keys(patch).length > 0) {
      labPatches.push({ id, patch });
      resumen.labsConCambios++;
    }
  }

  const porLab = Object.entries(incongruentesPorLab)
    .map(([idLab, n]) => ({ idLab, laboratorio: nombreLab[idLab] || '(laboratorio inexistente)', incongruentes: n }))
    .sort((a, b) => b.incongruentes - a.incongruentes);

  return { resumen, itemPatches, labPatches, incongruentes, incongruentesPorLab: porLab, cantidadesAltas };
}

// ---- Ejecución ---------------------------------------------------------------
function serializar(valor) {
  // Timestamps de firebase-admin tienen toJSON; el resto es JSON plano
  return JSON.stringify(valor, null, 2);
}

function reemplazarSentinel(patch, FieldValue) {
  const out = {};
  for (const [k, v] of Object.entries(patch)) out[k] = v === BORRAR ? FieldValue.delete() : v;
  return out;
}

async function main() {
  const apply = process.argv.includes('--apply');
  let admin;
  try {
    admin = require('firebase-admin');
  } catch (e) {
    console.error('No se encontró firebase-admin. Ejecuta `npm install` primero.');
    process.exit(1);
  }
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Falta GOOGLE_APPLICATION_CREDENTIALS (ruta al JSON de la cuenta de servicio).');
    process.exit(1);
  }
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  const db = admin.firestore();
  const { FieldValue } = admin.firestore;

  console.log(`Modo: ${apply ? 'APLICAR CAMBIOS' : 'DRY-RUN (no se escribe nada)'}`);
  const [labsSnap, itemsSnap] = await Promise.all([db.collection('laboratorios').get(), db.collection('items').get()]);
  const labs = labsSnap.docs.map((d) => ({ id: d.id, data: d.data() }));
  const items = itemsSnap.docs.map((d) => ({ id: d.id, data: d.data() }));
  const report = buildReport(labs, items);

  console.log('\n== Resumen ==');
  console.table(report.resumen);
  console.log(`\n== Registros incongruentes (${report.incongruentes.length}) por laboratorio ==`);
  console.table(report.incongruentesPorLab);
  if (report.incongruentes.length > 0) {
    console.log('\nDetalle (primeros 50):');
    console.table(report.incongruentes.slice(0, 50).map((i) => ({ id: i.id, equipo: i.equipo, motivos: i.motivos.join('; ') })));
  }
  if (report.cantidadesAltas.length > 0) {
    console.log(`\n== Cantidades > ${CANTIDAD_ALTA} (solo aviso; se validarán al generar códigos) ==`);
    console.table(report.cantidadesAltas);
  }
  if (report.resumen.conCodigoYSinEstado > 0) {
    console.log(`\nAviso: ${report.resumen.conCodigoYSinEstado} registro(s) ya tienen código pero no estadoCodigo; no se tocan.`);
  }

  if (!apply) {
    console.log('\nDRY-RUN terminado. Para aplicar: node scripts/migrate-v3.js --apply');
    return;
  }

  // Respaldo previo (solo los documentos que se van a modificar, con su estado ANTERIOR)
  const dir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const archivo = path.join(dir, `migrate-v3-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const idsItems = new Set(report.itemPatches.map((p) => p.id));
  const idsLabs = new Set(report.labPatches.map((p) => p.id));
  fs.writeFileSync(archivo, serializar({
    generado: new Date().toISOString(),
    laboratorios: labs.filter((l) => idsLabs.has(l.id)),
    items: items.filter((i) => idsItems.has(i.id)),
  }));
  console.log(`\nRespaldo guardado en ${archivo}`);

  const operaciones = [
    ...report.labPatches.map((p) => ({ ref: db.collection('laboratorios').doc(p.id), patch: p.patch })),
    ...report.itemPatches.map((p) => ({ ref: db.collection('items').doc(p.id), patch: p.patch })),
  ];
  const TAM = 400;
  let hechos = 0;
  for (let i = 0; i < operaciones.length; i += TAM) {
    const batch = db.batch();
    operaciones.slice(i, i + TAM).forEach((op) => batch.update(op.ref, reemplazarSentinel(op.patch, FieldValue)));
    await batch.commit();
    hechos += Math.min(TAM, operaciones.length - i);
    console.log(`  ${hechos}/${operaciones.length} documentos actualizados`);
  }
  console.log('\nMigración aplicada. Puedes volver a correr el script: no debería haber más cambios.');
}

module.exports = { parseCantidad, motivosIncongruencia, planItemPatch, planLabPatch, buildReport, BORRAR };

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

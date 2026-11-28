// Validador PURO de la importación Excel (PLAN_FUNCIONALIDADES_V2.md §10).
// No toca Firebase ni SheetJS: recibe lo parseado (parse.js) y un snapshot de la BD, y devuelve un informe.
import {
  CODE_REGEX,
  THRESHOLDS,
  canonicalTipo,
  isInsumo,
  normCode,
  normText,
  prefixOfCode,
  prefixOfTipo,
} from './columns.js';
import {
  EDIT_FIELDS_REG,
  EDIT_FIELDS_UNI,
  comparableFromCurrentRegistro,
  comparableFromCurrentUnidad,
  comparableFromRowRegistro,
  comparableFromRowUnidad,
  displayValue,
  fieldLabel,
  isFilled,
  sameValue,
} from './diff.js';

export const Level = { ERROR: 'error', WARNING: 'warning' };
/** Clave única de una unidad: su ID solo es único dentro de su registro (items/{itemId}/unidades/{id}). */
export const unitKey = (itemId, id) => `${normText(itemId)}/${normText(id)}`;
const isActive = (x) => x?.activo !== false;

export function toMillis(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime();
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  const t = Date.parse(String(v));
  return Number.isNaN(t) ? null : t;
}

function newRowResult(kind, row) {
  return {
    kind,
    status: 'unchanged', // unchanged | modified | new | removed | restored | error
    ref: { sheet: row._sheet, row: row._row },
    id: normText(row.id),
    codigo: normCode(row.codigo),
    nombre: normText(row.nombre ?? row.registro),
    idLab: row._idLab,
    changes: [], // { field, label, old, new, severity }
    issues: [], // { level, code, field?, message }
    needsRowConfirm: false, // supera umbral D11
    data: null, // datos de la fila nueva
  };
}

const err = (res, code, message, field) => res.issues.push({ level: Level.ERROR, code, field, message });
const warn = (res, code, message, field) => res.issues.push({ level: Level.WARNING, code, field, message });

function addChange(res, kind, key, oldV, newV) {
  res.changes.push({
    field: key,
    label: fieldLabel(kind, key),
    old: displayValue(key, oldV),
    new: displayValue(key, newV),
    oldRaw: oldV ?? null,
    newRaw: newV ?? null,
    severity: Level.WARNING,
  });
}

function checkCode(res, row, curCode, tipoCanon) {
  const code = normCode(row.codigo);
  if (code !== curCode) {
    if (curCode === '' && code !== '') err(res, 'E_CODE_INVENTED', `El código "${code}" no existe: los códigos los asigna el sistema, no se escriben en Excel.`, 'codigo');
    else if (curCode !== '' && code === '') err(res, 'E_CODE_MISSING', `Falta el código (era ${curCode}). El código no se puede borrar.`, 'codigo');
    else err(res, 'E_CODE_CHANGED', `El código no se puede editar (era ${curCode}, ahora ${code}).`, 'codigo');
  }
  if (code !== '') {
    if (!CODE_REGEX.test(code)) err(res, 'E_CODE_FORMAT', `Código "${code}" con formato no válido (esperado p. ej. EQU-000123).`, 'codigo');
    else if (tipoCanon && prefixOfCode(code) !== prefixOfTipo(tipoCanon)) {
      err(res, 'E_PREFIX_TYPE', `El prefijo del código ${code} no corresponde al tipo "${tipoCanon}" (${prefixOfTipo(tipoCanon)}).`, 'codigo');
    }
  }
}

function thresholdFor(tipoCanon) {
  return tipoCanon ? THRESHOLDS[tipoCanon] : undefined;
}

function finalizeStatus(res) {
  if (res.issues.some((i) => i.level === Level.ERROR)) {
    res.status = 'error';
    return;
  }
  const baja = res.changes.find((c) => c.field === 'activo' && c.newRaw === false);
  const restore = res.changes.find((c) => c.field === 'activo' && c.newRaw === true);
  if (baja) res.status = 'removed';
  else if (restore) res.status = 'restored';
  else if (res.status === 'new') res.status = 'new';
  else if (res.changes.length > 0) res.status = 'modified';
  else res.status = 'unchanged';
}

/**
 * @param {object} args
 * @param {{meta, registros, unidades, fileErrors}} args.parsed  salida de parseWorkbook
 * @param {{items: any[], unidades: any[], labs: any[]}} args.current  snapshot de la BD (incluye inactivos)
 */
export function validateImport({ parsed, current }) {
  const report = {
    fileErrors: parsed.fileErrors || [],
    rows: [],
    removedRows: [],
    ignoredNewer: [],
    summary: { unchanged: 0, modified: 0, new: 0, removed: 0, restored: 0, errorRows: 0, errors: 0, warningRows: 0, thresholdRows: 0, ignoredNewer: 0 },
    needsConfirm: { warnings: 0, bajas: 0, thresholdRowKeys: [] },
    plan: { updates: [], creates: [], bajas: [], restores: [] },
    canApply: false,
  };
  if (report.fileErrors.length > 0) return report;

  const exportMs = toMillis(parsed.meta.exportadoEn);
  const itemsById = new Map(current.items.map((i) => [i.id, i]));
  // Las unidades se identifican por registro + ID: los IDs (u0001, u0002…) se repiten en cada registro.
  const unitsById = new Map(current.unidades.map((u) => [unitKey(u.itemId, u.id), u]));
  const labsById = new Map((current.labs || []).map((l) => [l.id, l]));
  const codeOwners = new Map(); // código -> {tipo:'registro'|'unidad', id}
  for (const i of current.items) if (normCode(i.codigo)) codeOwners.set(normCode(i.codigo), { kind: 'registro', id: i.id });
  for (const u of current.unidades) if (normCode(u.codigo)) codeOwners.set(normCode(u.codigo), { kind: 'unidad', id: u.id });
  const activeUnitsByItem = new Map();
  for (const u of current.unidades) {
    if (!isActive(u)) continue;
    activeUnitsByItem.set(u.itemId, (activeUnitsByItem.get(u.itemId) || 0) + 1);
  }

  const modifiedAfterExport = (rec) => {
    const m = toMillis(rec.ultimaModificacion);
    return exportMs !== null && m !== null && m > exportMs;
  };

  // --- pre-pase: duplicados dentro del archivo -------------------------------------------------
  const seenIds = new Map();
  const codeCount = new Map();
  for (const r of [...parsed.registros, ...parsed.unidades]) {
    const c = normCode(r.codigo);
    if (c) codeCount.set(c, (codeCount.get(c) || 0) + 1);
  }
  const dupIdCheck = (kind, id) => {
    if (!id) return false;
    const key = `${kind}:${id}`;
    const dup = seenIds.has(key);
    seenIds.set(key, true);
    return dup;
  };

  const seenRegistroIds = new Set();
  const seenUnitIds = new Set();
  const labsWithUnitSheet = new Set(parsed.meta.sheets.filter((s) => s.kind === 'unidades').map((s) => s.idLab));
  const labsInScope = new Set(parsed.meta.sheets.filter((s) => s.kind === 'registros').map((s) => s.idLab));

  // ---------------------------------------------------------------------------------------------
  // REGISTROS
  // ---------------------------------------------------------------------------------------------
  for (const row of parsed.registros) {
    const res = newRowResult('registro', row);
    const id = res.id;
    const curForLegacy = id ? itemsById.get(id) : null;
    const legacyQty = curForLegacy ? comparableFromCurrentRegistro(curForLegacy).cantidad : undefined;
    const cmp = comparableFromRowRegistro(
      id ? row : { ...row, activo: normText(row.activo) === '' ? 'Sí' : row.activo },
      { cantidad: typeof legacyQty === 'string' && legacyQty !== '' ? legacyQty : undefined },
    );
    res.issues.push(...cmp.issues);
    const { vals, invalid } = cmp;
    const newCanon = canonicalTipo(row.tipo);
    const code = normCode(row.codigo);
    if (code && codeCount.get(code) > 1) err(res, 'E_CODE_DUP_FILE', `El código ${code} aparece más de una vez en el archivo.`, 'codigo');

    if (id) {
      if (dupIdCheck('r', id)) err(res, 'E_ID_DUP', 'Fila duplicada: este ID aparece más de una vez.', 'id');
      seenRegistroIds.add(id);
      const cur = itemsById.get(id);
      if (!cur) {
        err(res, 'E_ID_UNKNOWN', 'El ID de esta fila no existe en la base de datos (¿fila copiada o registro eliminado?).', 'id');
        res.codigo = code;
        finalizeStatus(res);
        report.rows.push(res);
        continue;
      }
      if (cur.idLab !== row._idLab) err(res, 'E_LAB_CHANGED', 'No se puede mover un registro a otro laboratorio desde Excel.', 'idLab');
      const curCmp = comparableFromCurrentRegistro(cur);
      const curCanon = canonicalTipo(cur.tipo);
      const curCode = normCode(cur.codigo);
      const effCanon = curCanon || newCanon;
      const ins = isInsumo(effCanon);
      res.idLab = cur.idLab;

      checkCode(res, row, curCode, effCanon);

      // tipo
      if (vals.tipoRaw === '') {
        if (curCmp.tipo !== '') err(res, 'E_EMPTIED', `${fieldLabel('registros', 'tipo')} estaba lleno ("${curCmp.tipo}") y quedó vacío.`, 'tipo');
      } else if (!newCanon) {
        if (vals.tipoRaw !== curCmp.tipo) err(res, 'E_TYPE_INVALID', `Tipo "${vals.tipoRaw}" fuera del catálogo (Mobiliario, Equipo, Herramienta, Suministro).`, 'tipo');
        else warn(res, 'W_TYPE_LEGACY', `Tipo "${vals.tipoRaw}" no es del catálogo: el registro sigue marcado como dato incongruente.`, 'tipo');
      } else if (newCanon !== curCanon) {
        if (curCanon || curCode) {
          err(res, 'E_TYPE_CHANGED', `El tipo no se cambia por Excel (de ${curCanon || curCmp.tipo || 'vacío'} a ${newCanon}). Use el flujo "Cambiar tipo…" de la app.`, 'tipo');
        } else addChange(res, 'registros', 'tipo', curCmp.tipo, newCanon); // reparar dato incongruente sin código
      } else if (curCmp.tipo !== newCanon && !curCode) {
        addChange(res, 'registros', 'tipo', curCmp.tipo, newCanon); // normaliza grafía (p. ej. "equipo" -> "Equipo")
      }

      const effTv = vals.tieneVencimiento === null || vals.tieneVencimiento === undefined ? false : vals.tieneVencimiento;

      for (const key of EDIT_FIELDS_REG) {
        if (key === 'tipo' || invalid.has(key)) continue;
        const oldV = curCmp[key];
        const newV = vals[key];
        const perUnit = !ins && (key === 'serie' || key === 'fundaempresa' || key === 'estado');

        if (key === 'estado') {
          if (!ins) {
            if (!vals.estadoEmpty && vals.estado !== curCmp.estado) err(res, 'E_PER_UNIT', 'El estado de las unidades se edita en la hoja "Unidades" (o en la app).', 'estado');
            continue;
          }
          if (vals.estadoEmpty) {
            if (oldV !== 'bueno') err(res, 'E_EMPTIED', `${fieldLabel('registros', 'estado')} estaba lleno ("${displayValue('estado', oldV)}") y quedó vacío.`, 'estado');
            continue;
          }
        }
        if (key === 'tieneVencimiento') {
          if (newV === null && oldV === true) {
            err(res, 'E_EMPTIED', `${fieldLabel('registros', key)} estaba en Sí y quedó vacío.`, key);
            continue;
          }
          if (effTv !== oldV) addChange(res, 'registros', key, oldV, effTv);
          continue;
        }
        if (key === 'fechaVencimiento') {
          if (effTv && !newV) {
            err(res, 'E_VENC_REQUIRED', 'Con "Tiene vencimiento = Sí" la fecha de vencimiento es obligatoria.', key);
            continue;
          }
          if (!effTv) {
            if (newV) warn(res, 'W_VENC_IGNORED', 'Tiene vencimiento = No: la fecha escrita se ignorará y se dejará vacía.', key);
            if (oldV) addChange(res, 'registros', key, oldV, null);
            continue;
          }
          if (!sameValue(oldV, newV)) addChange(res, 'registros', key, oldV, newV);
          continue;
        }
        if (key === 'activo') {
          if (newV !== oldV && newV !== null && newV !== undefined) addChange(res, 'registros', key, oldV, newV);
          continue;
        }
        if (key === 'cantidad') {
          if (newV === null) {
            if (isFilled(key, oldV)) err(res, 'E_EMPTIED', `${fieldLabel('registros', key)} estaba llena y quedó vacía.`, key);
            continue;
          }
          if (!sameValue(oldV, newV)) {
            if (!ins && (activeUnitsByItem.get(id) || 0) > 0) {
              err(res, 'E_QTY_CHANGED_UNITS', `La cantidad de un registro con unidades no se cambia por Excel (${oldV} → ${newV}): use la app para crear o dar de baja unidades.`, key);
            } else {
              addChange(res, 'registros', key, oldV, newV);
              const th = thresholdFor(effCanon);
              if (th !== undefined && typeof newV === 'number' && newV > th && (typeof oldV !== 'number' || newV > oldV)) {
                res.needsRowConfirm = true;
                warn(res, 'W_THRESHOLD', `Cantidad ${newV} supera ${th} (${effCanon}): requiere validación individual.`, key);
              }
            }
          }
          continue;
        }
        // campos de texto
        if (perUnit) {
          if (!sameValue(oldV, newV)) err(res, 'E_PER_UNIT', `${fieldLabel('registros', key)} se maneja por unidad: edítelo en la hoja "Unidades" o en la app.`, key);
          continue;
        }
        if (!isFilled(key, newV)) {
          if (isFilled(key, oldV)) err(res, 'E_EMPTIED', `${fieldLabel('registros', key)} estaba lleno ("${oldV}") y quedó vacío.`, key);
          continue;
        }
        if (!sameValue(oldV, newV)) addChange(res, 'registros', key, oldV, newV);
      }

      if (res.changes.length > 0 && modifiedAfterExport(cur)) {
        err(res, 'E_CONCURRENT', 'Este registro se modificó en la app después de exportar el Excel. Vuelva a exportar para no pisar esos cambios.', 'ultimaModificacion');
      }
      finalizeStatus(res);
      if (res.status === 'modified' || res.status === 'restored') {
        report.plan.updates.push({ kind: 'registro', id, idLab: cur.idLab, codigo: curCode, ref: res.ref, fields: Object.fromEntries(res.changes.filter((c) => c.field !== 'activo').map((c) => [c.field, c.newRaw])) });
        if (res.status === 'restored') report.plan.restores.push({ kind: 'registro', id, ref: res.ref });
      } else if (res.status === 'removed') {
        report.plan.bajas.push({ kind: 'registro', id, codigo: curCode, origin: 'activo', ref: res.ref });
        const other = res.changes.filter((c) => c.field !== 'activo');
        if (other.length > 0) report.plan.updates.push({ kind: 'registro', id, idLab: cur.idLab, codigo: curCode, ref: res.ref, fields: Object.fromEntries(other.map((c) => [c.field, c.newRaw])) });
      }
    } else {
      // ----- fila nueva (sin ID) -----
      res.status = 'new';
      if (code) {
        const owner = codeOwners.get(code);
        if (owner) err(res, 'E_CODE_ON_NEW', `El código ${code} ya pertenece a otro ${owner.kind}: una fila nueva no puede traer código.`, 'codigo');
        else err(res, 'E_CODE_INVENTED', `El código "${code}" no existe: los códigos los asigna el sistema al subir.`, 'codigo');
      }
      const lab = labsById.get(row._idLab);
      if (!lab || lab.activo === false) err(res, 'E_LAB_UNKNOWN', 'El laboratorio de esta hoja no existe o está dado de baja.', 'idLab');
      if (vals.nombre === '') err(res, 'E_REQUIRED_NEW', 'Fila nueva: el Nombre es obligatorio.', 'nombre');
      if (vals.tipoRaw === '') err(res, 'E_REQUIRED_NEW', 'Fila nueva: el Tipo es obligatorio.', 'tipo');
      else if (!newCanon) err(res, 'E_TYPE_INVALID', `Tipo "${vals.tipoRaw}" fuera del catálogo (Mobiliario, Equipo, Herramienta, Suministro).`, 'tipo');
      if (!invalid.has('cantidad') && vals.cantidad === null) err(res, 'E_REQUIRED_NEW', 'Fila nueva: la Cantidad es obligatoria.', 'cantidad');
      const ins = isInsumo(newCanon);

      if (!ins && newCanon) {
        if (isFilled('serie', vals.serie) || isFilled('fundaempresa', vals.fundaempresa) || (!vals.estadoEmpty && vals.estado)) {
          err(res, 'E_PER_UNIT', 'Número de serie, Fundaempresa y Estado de un equipo/mobiliario/herramienta nuevo se llenan por unidad (hoja "Unidades" o app) una vez creadas.', 'serie');
        }
      }
      if (vals.activo === false) err(res, 'E_NEW_INACTIVE', 'Una fila nueva no puede crearse con Activo = No.', 'activo');

      const effTv = vals.tieneVencimiento === null || vals.tieneVencimiento === undefined ? false : vals.tieneVencimiento;
      if (effTv && !vals.fechaVencimiento && !invalid.has('fechaVencimiento')) err(res, 'E_VENC_REQUIRED', 'Con "Tiene vencimiento = Sí" la fecha de vencimiento es obligatoria.', 'fechaVencimiento');
      if (!effTv && vals.fechaVencimiento) warn(res, 'W_VENC_IGNORED', 'Tiene vencimiento = No: la fecha escrita se ignorará.', 'fechaVencimiento');

      const th = thresholdFor(newCanon);
      if (th !== undefined && typeof vals.cantidad === 'number' && vals.cantidad > th) {
        res.needsRowConfirm = true;
        warn(res, 'W_THRESHOLD', `Cantidad ${vals.cantidad} supera ${th} (${newCanon}): requiere validación individual${ins ? '' : ' (se crearían ' + vals.cantidad + ' unidades y etiquetas)'}.`, 'cantidad');
      }
      res.data = {
        idLab: row._idLab,
        nombre: vals.nombre,
        tipo: newCanon || vals.tipoRaw,
        marca: vals.marca,
        modelo: vals.modelo,
        cantidad: vals.cantidad,
        ubicacion: vals.ubicacion,
        columna: vals.columna,
        observaciones: vals.observaciones,
        tieneVencimiento: effTv,
        fechaVencimiento: effTv ? vals.fechaVencimiento : null,
        ...(ins ? { serie: vals.serie, fundaempresa: vals.fundaempresa, estado: vals.estadoEmpty ? 'bueno' : vals.estado } : {}),
        unidades: ins ? 0 : vals.cantidad || 0,
      };
      finalizeStatus(res);
      if (res.status === 'new') report.plan.creates.push({ kind: 'registro', ref: res.ref, data: res.data, rowKey: `${row._sheet}!${row._row}` });
    }
    report.rows.push(res);
  }

  // ---------------------------------------------------------------------------------------------
  // UNIDADES
  // ---------------------------------------------------------------------------------------------
  for (const row of parsed.unidades) {
    const res = newRowResult('unidad', row);
    const id = res.id;
    const cmp = comparableFromRowUnidad(row);
    res.issues.push(...cmp.issues);
    const { vals, invalid } = cmp;
    const code = normCode(row.codigo);
    if (code && codeCount.get(code) > 1) err(res, 'E_CODE_DUP_FILE', `El código ${code} aparece más de una vez en el archivo.`, 'codigo');

    if (!id) {
      err(res, 'E_UNIT_NEW_NOT_ALLOWED', 'No se pueden agregar unidades desde Excel: la cantidad se deriva de las unidades. Créelas desde la app (subir la cantidad del registro).', 'id');
      finalizeStatus(res);
      report.rows.push(res);
      continue;
    }
    const key = unitKey(row.registroId, id);
    if (dupIdCheck('u', key)) err(res, 'E_ID_DUP', 'Fila duplicada: esta unidad aparece más de una vez.', 'id');
    seenUnitIds.add(key);
    const cur = unitsById.get(key);
    if (!cur) {
      err(res, 'E_ID_UNKNOWN', 'Esta unidad no existe en la base de datos (¿se cambiaron las columnas ocultas ID / ID registro?).', 'id');
      finalizeStatus(res);
      report.rows.push(res);
      continue;
    }
    const parent = itemsById.get(cur.itemId);
    if (normText(row.registroId) !== cur.itemId) err(res, 'E_PARENT_CHANGED', 'No se puede cambiar el registro al que pertenece una unidad.', 'registroId');
    if (parent && parent.idLab !== row._idLab) err(res, 'E_LAB_CHANGED', 'No se puede mover una unidad a otro laboratorio desde Excel.', 'idLab');
    res.idLab = parent?.idLab ?? row._idLab;
    const curCmp = comparableFromCurrentUnidad(cur);
    const curCode = normCode(cur.codigo);
    checkCode(res, row, curCode, parent ? canonicalTipo(parent.tipo) : null);

    for (const key of EDIT_FIELDS_UNI) {
      if (invalid.has(key)) continue;
      const oldV = curCmp[key];
      const newV = vals[key];
      if (key === 'estado') {
        if (vals.estadoEmpty) {
          if (oldV !== 'bueno') err(res, 'E_EMPTIED', `${fieldLabel('unidades', 'estado')} estaba lleno ("${displayValue('estado', oldV)}") y quedó vacío.`, 'estado');
          continue;
        }
        if (!sameValue(oldV, newV)) addChange(res, 'unidades', key, oldV, newV);
        continue;
      }
      if (key === 'activo') {
        if (newV !== oldV && newV !== null && newV !== undefined) addChange(res, 'unidades', key, oldV, newV);
        continue;
      }
      if (!isFilled(key, newV)) {
        if (isFilled(key, oldV)) err(res, 'E_EMPTIED', `${fieldLabel('unidades', key)} estaba lleno ("${oldV}") y quedó vacío.`, key);
        continue;
      }
      if (!sameValue(oldV, newV)) addChange(res, 'unidades', key, oldV, newV);
    }
    if (res.changes.length > 0 && modifiedAfterExport(cur)) {
      err(res, 'E_CONCURRENT', 'Esta unidad se modificó en la app después de exportar el Excel. Vuelva a exportar para no pisar esos cambios.', 'ultimaModificacion');
    }
    finalizeStatus(res);
    if (res.status === 'modified' || res.status === 'restored') {
      report.plan.updates.push({ kind: 'unidad', id, itemId: cur.itemId, idLab: res.idLab, codigo: curCode, ref: res.ref, fields: Object.fromEntries(res.changes.filter((c) => c.field !== 'activo').map((c) => [c.field, c.newRaw])) });
      if (res.status === 'restored') report.plan.restores.push({ kind: 'unidad', id, itemId: cur.itemId, ref: res.ref });
    } else if (res.status === 'removed') {
      report.plan.bajas.push({ kind: 'unidad', id, itemId: cur.itemId, codigo: curCode, origin: 'activo', ref: res.ref });
      const other = res.changes.filter((c) => c.field !== 'activo');
      if (other.length > 0) report.plan.updates.push({ kind: 'unidad', id, itemId: cur.itemId, idLab: res.idLab, codigo: curCode, ref: res.ref, fields: Object.fromEntries(other.map((c) => [c.field, c.newRaw])) });
    }
    report.rows.push(res);
  }

  // ---------------------------------------------------------------------------------------------
  // AUSENTES (baja lógica con confirmación; nunca se borra)
  // ---------------------------------------------------------------------------------------------
  const bajadosItems = new Set(report.plan.bajas.filter((b) => b.kind === 'registro').map((b) => b.id));
  for (const it of current.items) {
    if (!isActive(it) || seenRegistroIds.has(it.id) || !labsInScope.has(it.idLab)) continue;
    const item = { kind: 'registro', id: it.id, codigo: normCode(it.codigo), nombre: normText(it.equipo), idLab: it.idLab };
    if (modifiedAfterExport(it)) {
      report.ignoredNewer.push({ ...item, reason: 'Creado/modificado en la app después de exportar: no se toca.' });
      continue;
    }
    report.removedRows.push({ ...item, status: 'removed', origin: 'ausente' });
    report.plan.bajas.push({ kind: 'registro', id: it.id, codigo: item.codigo, origin: 'ausente' });
    bajadosItems.add(it.id);
  }
  for (const u of current.unidades) {
    if (!isActive(u) || seenUnitIds.has(unitKey(u.itemId, u.id))) continue;
    const parent = itemsById.get(u.itemId);
    if (!parent || !isActive(parent) || bajadosItems.has(u.itemId)) continue; // se cubre en cascada
    if (!labsInScope.has(parent.idLab) || !labsWithUnitSheet.has(parent.idLab)) continue;
    if (!seenRegistroIds.has(u.itemId)) continue;
    const item = { kind: 'unidad', id: u.id, itemId: u.itemId, codigo: normCode(u.codigo), nombre: normText(parent.equipo), idLab: parent.idLab };
    if (modifiedAfterExport(u)) {
      report.ignoredNewer.push({ ...item, reason: 'Creada/modificada en la app después de exportar: no se toca.' });
      continue;
    }
    report.removedRows.push({ ...item, status: 'removed', origin: 'ausente' });
    report.plan.bajas.push({ kind: 'unidad', id: u.id, itemId: u.itemId, codigo: item.codigo, origin: 'ausente' });
  }

  // ---------------------------------------------------------------------------------------------
  // Resumen
  // ---------------------------------------------------------------------------------------------
  const s = report.summary;
  for (const r of report.rows) {
    if (r.status === 'error') {
      s.errorRows++;
      s.errors += r.issues.filter((i) => i.level === Level.ERROR).length;
    } else if (r.status === 'unchanged') s.unchanged++;
    else if (r.status === 'modified') s.modified++;
    else if (r.status === 'new') s.new++;
    else if (r.status === 'removed') s.removed++;
    else if (r.status === 'restored') s.restored++;
    if (r.status !== 'error' && r.status !== 'unchanged' && (r.changes.length > 0 || r.status === 'new')) s.warningRows++;
    if (r.needsRowConfirm && r.status !== 'error') {
      s.thresholdRows++;
      report.needsConfirm.thresholdRowKeys.push(`${r.ref.sheet}!${r.ref.row}`);
    }
  }
  s.removed += report.removedRows.length;
  s.ignoredNewer = report.ignoredNewer.length;
  report.needsConfirm.warnings = s.modified + s.new + s.restored;
  report.needsConfirm.bajas = s.removed;

  const hasWork = report.plan.updates.length + report.plan.creates.length + report.plan.bajas.length + report.plan.restores.length > 0;
  report.canApply = s.errorRows === 0 && hasWork;
  return report;
}

/** ¿Las confirmaciones del usuario cubren lo que exige el informe? */
export function confirmationsSatisfied(report, { warnings = false, bajas = false, thresholdKeys = [] } = {}) {
  if (!report.canApply) return false;
  if (report.needsConfirm.warnings > 0 && !warnings) return false;
  if (report.needsConfirm.bajas > 0 && !bajas) return false;
  const given = new Set(thresholdKeys);
  return report.needsConfirm.thresholdRowKeys.every((k) => given.has(k));
}

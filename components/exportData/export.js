// Exportación a Excel v2 (PLAN_FUNCIONALIDADES_V2.md §10).
// Por laboratorio: hoja "Registros" + hoja "Unidades" (solo no-insumos) y una hoja oculta "_meta".
// Ese mismo archivo se puede editar y volver a subir en /importar (validado).
import XLSX from '../../vendor/xlsx';
import { buildExportModel, buildWorkbook } from '../../lib/import/workbook';
import { sanitizeSheetName } from '../../lib/import/columns';
import { groupSnapshot, loadSnapshot } from './snapshot';
import { busy } from '../ui/GlobalBusy';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function download(buf, fileName) {
  const blob = new Blob([buf], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

/** Arma el .xlsx (ArrayBuffer) a partir de un snapshot ya leído. */
export function buildExportBuffer(snapshot, { labIds = null, incluirBajas = false } = {}) {
  const { itemsByLab, unitsByItem } = groupSnapshot(snapshot);
  const labs = labIds ? snapshot.labs.filter((l) => labIds.includes(l.id)) : snapshot.labs;
  const model = buildExportModel({ labs, itemsByLab, unitsByItem, incluirBajas, exportadoEn: snapshot.readAt });
  const wb = buildWorkbook(XLSX, model);
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

/** Exporta UN laboratorio (botón de /inventory). */
export default async function exportToXLSX(idLab) {
  busy.show('Preparando el Excel del laboratorio… (puede tardar unos segundos)');
  try {
    const snapshot = await loadSnapshot();
    const lab = snapshot.labs.find((l) => l.id === idLab);
    if (!lab) throw new Error('No se encontró el laboratorio a exportar.');
    const buf = buildExportBuffer(snapshot, { labIds: [idLab] });
    download(buf, `Inventario - ${sanitizeSheetName(lab.name, 'Laboratorio')} (${stamp()}).xlsx`);
  } catch (e) {
    console.error(e);
    alert(`Error al exportar: ${e.message}`);
  } finally {
    busy.hide();
  }
}

/** Exporta TODOS los laboratorios en un solo libro (botón de la pantalla principal). */
export async function exportAllToXLSX({ incluirBajas = false, fileName } = {}) {
  busy.show('Preparando el Excel de todos los laboratorios… (puede tardar un poco)');
  try {
    const snapshot = await loadSnapshot();
    const buf = buildExportBuffer(snapshot, { incluirBajas });
    download(buf, fileName || `Laboratorios (${stamp()}).xlsx`);
  } catch (e) {
    console.error(e);
    alert(`Error al exportar: ${e.message}`);
  } finally {
    busy.hide();
  }
}

/** Respaldo previo a una importación: todo, incluidos los dados de baja. Lanza si falla (no hay alert). */
export async function downloadBackup(snapshot) {
  const snap = snapshot || (await loadSnapshot());
  const buf = buildExportBuffer(snap, { incluirBajas: true });
  download(buf, `Respaldo antes de importar (${stamp()}).xlsx`);
}

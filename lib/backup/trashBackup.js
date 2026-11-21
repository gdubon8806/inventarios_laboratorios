// Respaldo en Excel de lo que está en la papelera (se descarga ANTES de vaciarla).
// Se usa SheetJS directamente: exportAllToXLSX (components/exportData/export.js) solo exporta
// laboratorios/ítems ACTIVOS, así que no contendría lo que se va a eliminar.
import XLSX from '../../vendor/xlsx';

function fechaTexto(f) {
  if (!f) return '';
  if (typeof f.toDate === 'function') return f.toDate().toISOString();
  if (typeof f.seconds === 'number') return new Date(f.seconds * 1000).toISOString();
  return String(f);
}

function quien(p) {
  return p && (p.email || p.uid) ? p.email || p.uid : '';
}

export function buildTrashWorkbook({ items = [], labs = [], nombresLab = {} }) {
  const wb = XLSX.utils.book_new();

  const filasItems = items.map((i) => ({
    ID: i.id,
    Código: i.codigo || '',
    Nombre: i.equipo || '',
    Tipo: i.tipo || '',
    Marca: i.marca || '',
    Modelo: i.modelo || '',
    Cantidad: i.cantidad ?? '',
    Laboratorio: nombresLab[i.idLab] || i.idLab || '',
    'Ubicación': i.ubicacion || '',
    'Columna de localización': i.columnadelocalizacion || '',
    Observaciones: Array.isArray(i.observaciones) ? i.observaciones.join('\n') : i.observaciones || '',
    'Fecha de baja': fechaTexto(i.fechaBaja),
    'Motivo de baja': i.motivoBaja || '',
    'Dado de baja por': quien(i.bajaPor),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasItems), 'Artículos en baja');

  const filasLabs = labs.map((l) => ({
    ID: l.id,
    Nombre: l.name || '',
    'Descripción': l.description || '',
    'Fecha de baja': fechaTexto(l.fechaBaja),
    'Motivo de baja': l.motivoBaja || '',
    'Dado de baja por': quien(l.bajaPor),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasLabs), 'Laboratorios en baja');
  return wb;
}

// Descarga el respaldo en el navegador. Devuelve el nombre del archivo.
export function downloadTrashBackup(datos) {
  const wb = buildTrashWorkbook(datos);
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const nombre = `respaldo-papelera-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return nombre;
}

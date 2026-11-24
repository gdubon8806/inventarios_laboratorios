// MODO DEMO: datos ficticios que imitan la estructura real de Firestore (laboratorios, items, unidades,
// codigos, counters, reportes, itemComentarios). No contiene datos reales.
import { formatCode, unitId } from '../lib/codes/prefixes';

const svg = (label, bg, fg = '#fff') => `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="280"><rect width="100%" height="100%" fill="${bg}"/>` +
  `<text x="50%" y="54%" text-anchor="middle" font-family="Arial,sans-serif" font-size="30" font-weight="bold" fill="${fg}">${label}</text></svg>`
)}`;

const LABS = [
  { id: 'lab-quimica', name: 'Laboratorio de Química', description: 'Reactivos, cristalería y equipos de análisis', ubicacion: 'Edificio A, piso 2', color: '#1976d2' },
  { id: 'lab-electronica', name: 'Laboratorio de Electrónica', description: 'Instrumentos de medición y estaciones de soldadura', ubicacion: 'Edificio B, piso 1', color: '#00897b' },
  { id: 'lab-fisica', name: 'Laboratorio de Física', description: 'Mecánica, óptica y termodinámica', ubicacion: 'Edificio A, piso 1', color: '#6a1b9a' },
  { id: 'lab-computo', name: 'Laboratorio de Cómputo 1', description: 'Equipos de cómputo y mobiliario de aula', ubicacion: 'Edificio C, piso 3', color: '#ef6c00' },
  { id: 'lab-mecanica', name: 'Taller de Mecánica', description: 'Herramientas manuales y máquinas', ubicacion: 'Nave industrial', color: '#455a64' },
  { id: 'lab-biologia', name: 'Laboratorio de Biología', description: 'Microscopía y cultivo', ubicacion: 'Edificio A, piso 3', color: '#2e7d32' },
  { id: 'lab-redes', name: 'Laboratorio de Redes', description: 'Laboratorio nuevo, sin registros todavía', ubicacion: 'Edificio C, piso 1', color: '#c62828' },
  { id: 'lab-industrial', name: 'Laboratorio de Ingeniería Industrial y Seguridad Ocupacional', description: 'Nombre largo para probar el diseño de las tarjetas', ubicacion: 'Edificio D, piso 2, ala norte', color: '#ad1457' },
];

// [equipo, tipo, cantidad, marca, modelo, ubicacion, columna, observaciones, estado, extras]
// estado: impreso | pend | sin | bad
const ITEMS = {
  'lab-quimica': [
    ['Balanza analítica', 'Equipo', 3, 'Ohaus', 'PX224', 'Mesa 1', 'A1', 'Calibrar cada 6 meses', 'impreso', { key: 'balanza' }],
    ['Agitador magnético', 'Equipo', 6, 'IKA', 'C-MAG HS7', 'Mesa 2', 'A2', '', 'impreso'],
    ['Campana de extracción', 'Mobiliario', 2, 'Labconco', 'XL', 'Pared norte', 'B1', 'Filtros nuevos en 2026', 'pend'],
    ['Vaso de precipitado 250 ml', 'Suministro', 40, 'Pyrex', '', 'Gabinete 3', 'C2', 'Cristalería', 'impreso'],
    ['Ácido clorhídrico 1 L', 'Suministro', 12, 'Merck', '', 'Gabinete seguridad', 'D1', 'Vence pronto', 'pend', { vence: 20 }],
    ['Pinzas de laboratorio', 'Herramienta', 8, '', '', 'Cajón 4', 'E3', '', 'sin'],
    ['Espectrofotómetro', 'Equipo', 1, 'Thermo', 'Genesys 30', 'Mesa 5', 'A5', '', 'sin'],
    ['Mortero de porcelana', 'Herramienta', 'doce', '', '', 'Cajón 1', 'E1', 'Cantidad escrita con letras', 'bad'],
  ],
  'lab-electronica': [
    ['Osciloscopio digital', 'Equipo', 8, 'Rigol', 'DS1054Z', 'Banco 1-4', 'A1', '', 'impreso', { key: 'osciloscopio' }],
    ['Fuente de poder DC', 'Equipo', 8, 'Rigol', 'DP832', 'Banco 1-4', 'A2', '', 'impreso'],
    ['Multímetro', 'Herramienta', 15, 'Fluke', '117', 'Cajón 2', 'B1', 'Algunos con puntas dañadas', 'impreso', { key: 'multimetro' }],
    ['Estación de soldadura', 'Equipo', 6, 'Hakko', 'FX-888D', 'Banco 5', 'C1', '', 'pend'],
    ['Resistencias 1/4 W (kit)', 'Suministro', 30, 'Genérica', '', 'Gaveta 7', 'D4', '', 'sin'],
    ['Silla ergonómica', 'Mobiliario', 24, 'Steelcase', 'Series 1', 'Todo el laboratorio', '-', '', 'impreso'],
  ],
  'lab-fisica': [
    ['Banco óptico', 'Equipo', 4, 'PASCO', 'OS-8515', 'Mesa 3', 'A3', '', 'impreso'],
    ['Cronómetro digital', 'Herramienta', 10, 'Casio', 'HS-3', 'Cajón 1', 'B2', '', 'sin'],
    ['Calorímetro', 'Equipo', 5, 'PASCO', 'TD-8557A', 'Mesa 6', 'A6', '', 'pend'],
  ],
  'lab-computo': [
    ['Computadora de escritorio', 'Equipo', 30, 'Dell', 'OptiPlex 7090', 'Filas 1-5', 'A1', 'Windows 11', 'impreso', { key: 'pc' }],
    ['Monitor 24"', 'Equipo', 30, 'Dell', 'P2422H', 'Filas 1-5', 'A1', '', 'impreso'],
    ['Escritorio', 'Mobiliario', 32, '', '', 'Filas 1-5', '-', '', 'pend'],
    ['Proyector', 'Equipo', 2, 'Epson', 'PowerLite X49', 'Techo', '-', 'Control remoto en coordinación', 'sin'],
    ['Cable HDMI 3 m', 'Suministro', 14, 'Genérico', '', 'Armario', 'C1', '', 'impreso'],
  ],
  'lab-mecanica': [
    ['Torno paralelo', 'Equipo', 2, 'Jet', 'GH-1440', 'Zona A', 'A1', '', 'impreso'],
    ['Juego de llaves combinadas', 'Herramienta', 12, 'Truper', '', 'Panel 2', 'B1', '', 'impreso'],
    ['Taladro de columna', 'Equipo', 3, 'Bosch', 'PBD 40', 'Zona B', 'A3', '', 'sin'],
    ['Lubricante en aerosol', 'Suministro', 25, 'WD-40', '', 'Estante 1', 'C1', '', 'sin'],
    ['Banco de trabajo', 'Mobiliario', 6, '', '', 'Zona A', 'A2', '', 'pend'],
  ],
  'lab-biologia': [
    ['Microscopio binocular', 'Equipo', 12, 'Olympus', 'CX23', 'Mesas 1-6', 'A1', '', 'impreso', { key: 'microscopio' }],
    ['Autoclave', 'Equipo', 1, 'Tuttnauer', '2540EK', 'Cuarto estéril', 'S1', '', 'impreso'],
    ['Placas de Petri (caja)', 'Suministro', 60, 'Kimble', '', 'Refrigerador 2', 'D2', '', 'pend', { vence: -5 }],
    ['Guantes de nitrilo (caja)', 'Suministro', 18, '', '', 'Gabinete 1', 'D1', '', 'sin'],
  ],
  'lab-redes': [],
  'lab-industrial': [
    ['Casco de seguridad', 'Herramienta', 20, '3M', 'H-700', 'Armario EPP', 'A1', '', 'sin'],
    ['Cronómetro de tiempos', 'Herramienta', 6, 'Casio', 'HS-80', 'Cajón 3', 'B2', '', 'sin'],
    ['Mesa de trabajo', 'Mobiliario', 10, '', '', 'Zona de ensamble', '-', '', 'pend'],
  ],
};

const REPORTS = [
  { key: 'osciloscopio', unit: 3, comentario: 'La pantalla parpadea después de unos minutos de uso y se apaga el canal 2.', estado: 'abierto', dias: 2 },
  { key: 'multimetro', unit: 5, comentario: 'Las puntas de prueba están rotas, no mide continuidad.', estado: 'abierto', dias: 5 },
  { key: 'multimetro', unit: 9, comentario: 'No enciende aunque se cambie la batería.', estado: 'abierto', dias: 1 },
  { key: 'pc', unit: 12, comentario: 'La computadora se reinicia sola cuando se abre más de un programa.', estado: 'abierto', dias: 9 },
  { key: 'balanza', unit: 2, comentario: 'La lectura no se estabiliza, parece descalibrada.', estado: 'resuelto', dias: 30, solucion: 'Se recalibró con pesas patrón.', nuevoEstado: 'bueno' },
  { key: 'microscopio', unit: null, comentario: 'Varios microscopios tienen los lentes sucios.', estado: 'abierto', dias: 3 },
];

export function buildSeed(Timestamp) {
  const out = [];
  const put = (path, data) => out.push([path, data]);
  const day = 86400000;
  const ts = (daysAgo) => Timestamp.fromMillis(Date.now() - daysAgo * day);
  const adminRef = { uid: 'demo-admin', email: 'admin@demo.local' };
  const counters = {};
  const take = (prefix) => { counters[prefix] = (counters[prefix] || 0) + 1; return formatCode(prefix, counters[prefix]); };
  const keyed = {};

  LABS.forEach((l, i) => {
    put(`laboratorios/${l.id}`, {
      name: l.name, description: l.description, ubicacion: l.ubicacion, imgurl: svg(l.name.split(' ').slice(0, 3).join(' '), l.color),
      imgname: `${l.id}.svg`, activo: true, ultimaModificacion: ts(20 - i), ultimaModificacionPor: adminRef,
    });
  });
  // Laboratorio dado de baja (para la papelera)
  put('laboratorios/lab-viejo', {
    name: 'Laboratorio de Prototipos (antiguo)', description: 'Cerrado en 2025', ubicacion: 'Bodega 2', imgurl: svg('Prototipos', '#78909c'), imgname: 'x.svg',
    activo: false, fechaBaja: ts(40), motivoBaja: 'Cierre del laboratorio', bajaPor: adminRef,
  });

  const PREF = { Equipo: 'EQU', Mobiliario: 'MOB', Herramienta: 'HER', Suministro: 'INS' };
  const COLORS = { Equipo: '#1565c0', Mobiliario: '#6d4c41', Herramienta: '#ef6c00', Suministro: '#2e7d32' };

  for (const lab of LABS) {
    (ITEMS[lab.id] || []).forEach((spec, n) => {
      const [equipo, tipo, cantidad, marca, modelo, ubicacion, columna, obs, estado, extras = {}] = spec;
      const id = `it-${lab.id.replace('lab-', '')}-${n + 1}`;
      const base = {
        equipo, tipo, cantidad, marca, modelo, ubicacion, columnadelocalizacion: columna, observaciones: obs,
        idLab: lab.id, imgurl: svg(equipo.slice(0, 22), COLORS[tipo] || '#546e7a'), imgname: `${id}.svg`,
        activo: true, ultimaModificacion: ts(10 - (n % 8)), ultimaModificacionPor: adminRef,
      };
      if (extras.vence !== undefined) { base.tieneVencimiento = true; base.fechaVencimiento = Timestamp.fromMillis(Date.now() + extras.vence * day); }

      if (estado === 'bad') {
        put(`items/${id}`, { ...base, estadoCodigo: 'sinCodigo', requiereValidacion: true, motivoValidacion: `cantidad no numérica ("${cantidad}")` });
        return;
      }
      if (estado === 'sin') { put(`items/${id}`, { ...base, estadoCodigo: 'sinCodigo' }); return; }

      const prefix = PREF[tipo];
      const estadoCodigo = estado === 'impreso' ? 'impreso' : 'pendienteImprimir';
      const codeBase = { activo: true, eliminado: false, reemplazado: false, reemplazadoPor: null, creado: ts(15), tipo, labId: lab.id };

      if (tipo === 'Suministro') {
        const code = take(prefix);
        put(`items/${id}`, { ...base, codigo: code, estadoCodigo, codigoGeneradoEn: ts(15) });
        put(`codigos/${code}`, { ...codeBase, registroId: id, unidadId: null });
        return;
      }
      const units = [];
      for (let u = 1; u <= cantidad; u++) {
        const uid = unitId(u);
        const code = take(prefix);
        const estadoUnidad = u % 7 === 0 ? 'malo' : u % 11 === 0 ? 'reparacion' : 'bueno';
        put(`items/${id}/unidades/${uid}`, {
          registroId: id, codigo: code, estadoCodigo, codigoGeneradoEn: ts(15), codigoImpresoEn: estado === 'impreso' ? ts(14) : null,
          numeroSerie: u % 3 === 0 ? '' : `SN-${String(n + 1).padStart(2, '0')}${String(u).padStart(3, '0')}`,
          codigoFundaempresa: u % 4 === 0 ? `FUN-${1000 + n * 40 + u}` : '',
          observaciones: u % 5 === 0 ? 'Rayón en la carcasa' : '', estado: estadoUnidad, idLab: lab.id, tipo, activo: true, codigoAnterior: null,
          ultimaModificacion: ts(10), ultimaModificacionPor: adminRef,
        });
        put(`codigos/${code}`, { ...codeBase, registroId: id, unidadId: uid });
        units.push({ uid, code });
      }
      put(`items/${id}`, { ...base, estadoCodigo, unidadesGeneradas: cantidad, totalUnidades: cantidad, codigoGeneradoEn: ts(15) });
      if (extras.key) keyed[extras.key] = { id, units, labId: lab.id, tipo };
    });
  }

  // Registro antiguo sin campos nuevos (compatibilidad con datos viejos) y con observaciones en arreglo
  put('items/it-legado-1', {
    equipo: 'Lámpara de escritorio (registro antiguo)', tipo: 'Mobiliario', cantidad: '4', marca: 'Genérica', modelo: '', ubicacion: 'Estante 2',
    columnadelocalizacion: 'F1', observaciones: ['Sin tapa', 'Revisar cable'], idLab: 'lab-fisica', imgurl: svg('Registro antiguo', '#8d6e63'), imgname: 'legacy.svg',
  });
  // Caso de prueba del diagnóstico: registros del Laboratorio de Redes que apuntan a un id de laboratorio viejo
  // (el laboratorio "lab-redes" aparece en 0 aunque estos registros siguen en la base).
  [['Switch 24 puertos', 'Equipo', 4, 'Cisco', 'SG350-28'], ['Router', 'Equipo', 3, 'MikroTik', 'RB4011'], ['Cable UTP Cat6 (rollo)', 'Suministro', 5, 'Belden', '']].forEach(([equipo, tipo, cantidad, marca, modelo], n) => {
    put(`items/it-redes-viejo-${n + 1}`, {
      equipo, tipo, cantidad, marca, modelo, ubicacion: 'Rack 1', columnadelocalizacion: `R${n + 1}`, observaciones: '', idLab: 'lab-redes-anterior',
      imgurl: svg(equipo, '#c62828'), imgname: 'r.svg', activo: true, estadoCodigo: 'sinCodigo',
    });
  });
  // Registro dado de baja (papelera)
  put('items/it-baja-1', {
    equipo: 'Microscopio monocular (obsoleto)', tipo: 'Equipo', cantidad: 2, marca: 'Olympus', modelo: 'CH20', ubicacion: 'Bodega', columnadelocalizacion: 'Z1',
    observaciones: '', idLab: 'lab-biologia', imgurl: svg('Microscopio', '#9e9e9e'), imgname: 'b.svg', activo: false, estadoCodigo: 'sinCodigo',
    fechaBaja: ts(12), motivoBaja: 'Equipo obsoleto, se envió a descarte', bajaPor: adminRef,
  });

  // Reportes + soluciones
  REPORTS.forEach((r, i) => {
    const k = keyed[r.key];
    if (!k) return;
    const u = r.unit ? k.units[r.unit - 1] : null;
    const id = `rep-${i + 1}`;
    put(`reportes/${id}`, {
      registroId: k.id, unidadId: u ? u.uid : null, idLab: k.labId, codigo: u ? u.code : null, comentario: r.comentario,
      reportadoPor: { uid: 'demo-guest', email: 'invitado@demo.local' }, fecha: ts(r.dias), estadoReporte: r.estado,
      ...(r.estado === 'resuelto' ? { resueltoPor: adminRef, fechaResolucion: ts(r.dias - 1) } : {}),
    });
    if (r.estado === 'resuelto') put(`reportes/${id}/privado/solucion`, { solucion: r.solucion, nuevoEstado: r.nuevoEstado, resueltoPor: adminRef, fecha: ts(r.dias - 1) });
  });

  // Comentarios internos (solo admin)
  if (keyed.pc) put('itemComentarios/c1', { idItem: keyed.pc.id, title: 'Actualización de Windows', description: 'Pendiente actualizar a la última versión antes del próximo semestre.', time: ts(6) });
  if (keyed.osciloscopio) put('itemComentarios/c2', { idItem: keyed.osciloscopio.id, title: 'Garantía', description: 'Garantía vigente hasta junio, contactar al proveedor.', time: ts(14) });

  for (const [p, next] of Object.entries(counters)) put(`counters/${p}`, { next: next + 1 });
  return out;
}

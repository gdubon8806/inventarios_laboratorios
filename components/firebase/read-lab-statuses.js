import { collection, getDocs } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig';
import { computeLabCodeStatus } from './generate-missing-codes';

// Estado de códigos de TODOS los laboratorios con UNA sola consulta (en vez de una por tarjeta).
// -> { [idLab]: { total, sinCodigo, pendienteImprimir, impreso, incongruentes, porValidar } }
// Los registros dados de baja (activo === false) no cuentan. Ante un error registra y devuelve {}.
// La home guarda el resultado en estado (no se relee en cada render) y solo vuelve a pedir un lab
// concreto (getLabCodeStatus) cuando generas códigos o marcas etiquetas como impresas.
export default async function readAllLabStatuses() {
  try {
    const snap = await getDocs(collection(firestore, 'items'));
    const byLab = {};
    snap.forEach((d) => {
      const data = d.data();
      if (data.activo === false || !data.idLab) return;
      if (!byLab[data.idLab]) byLab[data.idLab] = [];
      byLab[data.idLab].push({ id: d.id, ...data });
    });
    const out = {};
    for (const [labId, records] of Object.entries(byLab)) out[labId] = computeLabCodeStatus(records);
    return out;
  } catch (error) {
    console.error('Error al leer el estado de códigos de los laboratorios: ', error);
    return {};
  }
}

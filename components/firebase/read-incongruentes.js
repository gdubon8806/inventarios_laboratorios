import { collection, getDocs, query, where } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig';

// Cuántos registros ACTIVOS marcados como "datos incongruentes" tiene cada laboratorio.
// Una sola consulta (campo único, sin índice extra). Devuelve un objeto { [idLab]: cantidad }.
// Es la fuente de verdad para marcar el laboratorio "⚠ datos incongruentes — validar (N)".
// Ante un error registra y devuelve {} (la pantalla no se rompe).
export default async function readIncongruentesPorLab() {
  try {
    const snap = await getDocs(query(collection(firestore, 'items'), where('requiereValidacion', '==', true)));
    const porLab = {};
    snap.forEach((d) => {
      const data = d.data();
      if (data.activo === false || !data.idLab) return;
      porLab[data.idLab] = (porLab[data.idLab] || 0) + 1;
    });
    return porLab;
  } catch (error) {
    console.error('Error al contar registros incongruentes: ', error);
    return {};
  }
}

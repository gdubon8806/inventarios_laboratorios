import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig';

// Busca un equipo por su código (campo "codigo"). Solo lectura.
// Devuelve el equipo encontrado o null si no existe o si hay un error.
export default async function findByCode(codigo) {
  const code = (codigo || '').trim().toUpperCase();
  if (!code) return null;
  try {
    const q = query(collection(firestore, 'items'), where('codigo', '==', code), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error('Error al buscar por código: ', error);
    return null;
  }
}

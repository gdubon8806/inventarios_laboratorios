import { useEffect, useState } from 'react';
import { auth } from '../firebaseConfig';

// Hook único para conocer sesión y rol (custom claim `role`).
// Invitado = cualquier usuario con sesión cuyo role !== 'admin'.
// No fuerza refresco del token en cada carga (getIdTokenResult() sin `true`);
// si se cambia el claim de un usuario, debe volver a iniciar sesión.
export default function useRole() {
  const [state, setState] = useState({ user: null, role: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) {
        if (!cancelled) setState({ user: null, role: null, loading: false });
        return;
      }
      let role = null;
      try {
        const tokenResult = await firebaseUser.getIdTokenResult();
        role = tokenResult.claims.role || null;
      } catch (error) {
        console.error('No se pudo leer el rol del usuario:', error);
      }
      // Se publica la sesión recién cuando el rol ya se conoce (evita parpadeo de UI de invitado).
      if (!cancelled) setState({ user: firebaseUser, role, loading: false });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { ...state, isAdmin: state.role === 'admin' };
}

// MODO DEMO: sustituto de `firebase/auth`. Dos cuentas de prueba (ver DEMO_USERS); la sesión se guarda en localStorage.
const KEY = 'inventarios-demo-user-v1';

export const DEMO_USERS = {
  'admin@demo.local': { password: 'admin123', uid: 'demo-admin', role: 'admin' },
  'invitado@demo.local': { password: 'invitado123', uid: 'demo-guest', role: null },
};

const listeners = new Set();
let current;

function readStored() {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null;
    const email = raw ? JSON.parse(raw).email : null;
    return email && DEMO_USERS[email] ? makeUser(email) : null;
  } catch { return null; }
}
function makeUser(email) {
  const u = DEMO_USERS[email];
  return { uid: u.uid, email, role: u.role, getIdTokenResult: async () => ({ claims: u.role ? { role: u.role } : {} }) };
}
function ensure() {
  if (current === undefined) current = readStored();
  return current;
}
function notify() { listeners.forEach((cb) => cb(current)); }

export const auth = {
  get currentUser() { return ensure(); },
  onAuthStateChanged(cb) {
    listeners.add(cb);
    Promise.resolve().then(() => cb(ensure()));
    return () => listeners.delete(cb);
  },
};

export const getAuth = () => auth;
export const currentDemoRole = () => ensure()?.role ?? null;

export async function signInWithEmailAndPassword(_auth, email, password) {
  const u = DEMO_USERS[String(email).trim().toLowerCase()];
  if (!u || u.password !== password) { const e = new Error('auth/invalid-credential'); e.code = 'auth/invalid-credential'; throw e; }
  current = makeUser(String(email).trim().toLowerCase());
  try { window.localStorage.setItem(KEY, JSON.stringify({ email: current.email })); } catch { /* ok */ }
  notify();
  return { user: current };
}
export async function signOut() {
  current = null;
  try { window.localStorage.removeItem(KEY); } catch { /* ok */ }
  notify();
}

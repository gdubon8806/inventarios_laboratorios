// MODO DEMO: sustituto de `firebase/app`.
export const initializeApp = () => ({ demo: true });
export const getApps = () => [];
export const getApp = () => ({ demo: true });

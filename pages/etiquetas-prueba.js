// Página de calibración de etiquetas (ver components/labels/PrintCalibrationPage.js).
// TODO (lead): restringir a admin con el hook useRole cuando exista (Fase 0). Requiere `jsbarcode`.
import dynamic from 'next/dynamic';

// Sin SSR: usa localStorage, iframe e impresión del navegador.
const PrintCalibrationPage = dynamic(() => import('../components/labels/PrintCalibrationPage'), { ssr: false });

export default function EtiquetasPrueba() {
  return <PrintCalibrationPage />;
}

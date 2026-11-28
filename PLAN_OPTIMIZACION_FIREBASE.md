# Plan de optimización de Firebase (lecturas y descargas)

Fecha: 2026-11-28 · Rama: `fix/compresion-imagenes`

## 1. Problema

Después de publicar las versiones v2 (PR #5, 24/11) y de mejoras (PR #6, 28/11), Firebase empezó a cobrar.
El plan gratuito (Spark/Blaze sin pasar del gratis) incluye por día **50 000 lecturas de Firestore**, 20 000
escrituras y **1 GB de descarga de Storage**. Se pasó del límite.

> Confirmar en la consola: **Firebase → Uso y facturación** y **Firestore → Uso**. Ver si el gasto es de
> *lecturas de Firestore* o de *descargas de Storage* y desde qué día subió.

## 2. Causas encontradas en el código

Tamaño aproximado de la base (según el Excel del 26/11): ~1 600 registros y ~2 600+ unidades.

| # | Dónde | Qué hacía | Lecturas aprox. |
|---|---|---|---|
| 1 | Pantalla principal (`pages/index.js` → `readAllActiveItems`) | Leía **toda** la colección `items` cada vez que alguien abría o volvía a la pantalla principal (admin o invitado), para los estados de cada laboratorio y la búsqueda por nombre. | **~1 600 por visita**. 10 personas × 20 visitas/día ≈ 320 000/día |
| 2 | Exportar Excel (`loadSnapshot`) | Leía **todos** los registros y **todas** las unidades (una consulta por registro), aunque se exportara un solo laboratorio. | **~4 200+ por exportación** |
| 3 | Importar Excel (`pages/importar.js`) | Leía la base completa al validar y otra vez al aplicar (2 veces por archivo; se repite cada vez que se sube un archivo corregido). | **~8 400+ por importación** |
| 4 | Subir imágenes (`uploader.tsx`) | Con el cambio de «enfoque» las fotos se subían **originales** (3–8 MB de celular) en vez de comprimidas. Cada tarjeta descarga la foto completa. | Descarga de Storage (GB) |

## 3. Lo que corrige esta rama (`fix/compresion-imagenes`)

### 3.1 Compresión de imágenes (causa 4)
- Vuelve la compresión que tenía la app: `compressorjs`, JPEG calidad 0.8, lado mayor ≤ 1200 px
  (unos cientos de KB). Se aplica al elegir la foto, antes del enfoque. El enfoque no cambia.
- Archivo: `components/uploader/uploader.tsx`.
- **Pendiente manual:** las fotos subidas entre el 28/11 y este arreglo siguen pesadas. Volver a subirlas
  desde «Editar».

### 3.2 Caché de la pantalla principal (causa 1)
- `lib/cache/home-cache.js`: guarda en memoria lo leído (laboratorios, registros activos, incongruentes)
  durante **10 minutos** mientras la pestaña está abierta.
- Al **volver** a la pantalla principal no se relee todo:
  - Si se entró al inventario de un laboratorio, **solo se relee ese laboratorio** (~50–150 lecturas).
  - La papelera (`/bajas`) y una importación aplicada invalidan todo: la próxima visita relee completo.
  - Recargar la página (F5) o abrir la app de nuevo también lee completo.
- Ahorro: las visitas repetidas pasan de ~1 600 lecturas a 0 (o solo el laboratorio tocado).
- **Limitación:** abrir la app desde cero sigue leyendo ~1 600. Ver fase 2 (punto 4.1).

### 3.3 Exportar e importar solo lo necesario (causas 2 y 3)
- `loadSnapshot({ labIds })` lee solo los registros y unidades de los laboratorios indicados.
- Exportar un laboratorio (botón dentro del laboratorio o selector de `/importar`): solo ese laboratorio.
- Importar: solo los laboratorios que trae el archivo (hoja `_meta`), en la validación y al aplicar.
  El respaldo automático usa esa misma lectura (no lee de nuevo).
- «Descargar todos» sigue leyendo todo (es lo esperado).
- Ahorro: exportar/importar un laboratorio pasa de ~4 200 a ~100–400 lecturas.

### 3.4 Verificación
- `npm test`: 140 pruebas (5 nuevas de la caché).
- `next build` compila.
- **No probado en navegador ni contra Firebase real.** Probar en la vista previa de Vercel:
  1. Abrir la pantalla principal, entrar a un laboratorio, volver: debe cargar al instante.
  2. Editar un registro en un laboratorio y volver: el conteo de ese laboratorio se actualiza.
  3. Subir una foto: debe subir rápido y pesar unos cientos de KB (ver en Storage).
  4. Exportar un laboratorio e importarlo sin cambios: «Sin cambios», 0 errores.

## 4. Fase 2 (siguiente, si el gasto sigue alto)

### 4.1 Documento de resumen para la pantalla principal (mayor ahorro restante)
- Guardar en un documento `resumenes/laboratorios` los conteos por laboratorio
  (`total`, `sinCodigo`, `pendienteImprimir`, `impreso`, `incongruentes`, `porValidar`).
- La pantalla principal lee **1 documento** en vez de ~1 600.
- La búsqueda por nombre de toda la app carga los registros **solo cuando alguien escribe** en el buscador.
- Mantener el resumen: recalcular el laboratorio afectado después de cada cambio (ya existe
  `computeLabCodeStatus`), o con una Cloud Function (requiere plan Blaze).
- Requiere: regla de Firestore para `resumenes` (lectura con sesión, escritura admin).

### 4.2 Caché persistente en el navegador
- Guardar la caché de la pantalla principal en `localStorage` (versión reducida de cada registro), para que
  abrir la app de nuevo en el mismo dispositivo no lea todo. Alternativa: caché persistente de Firestore
  (`persistentLocalCache`) con lecturas desde caché cuando sea posible.

### 4.3 Miniaturas de imágenes
- Subir además una miniatura (~400 px, ~30–60 KB) para tarjetas y listas; la imagen de 1200 px solo para
  «Ver completa» y el detalle. Reduce la descarga de Storage varias veces más.
- Opción sin código: extensión de Firebase **Resize Images** (requiere Blaze).
- Agregar `Cache-Control` largo a las imágenes subidas (`uploadBytes(..., { cacheControl: 'public,max-age=31536000' })`)
  para que el navegador no las descargue de nuevo.

### 4.4 Seguridad y abuso
- La contraseña del invitado es pública (va en `NEXT_PUBLIC_GUEST_PASSWORD`). Cualquiera puede entrar y
  generar lecturas. Cambiarla en Firebase y en Vercel (sigue pendiente) y activar **App Check**
  (reCAPTCHA v3) para que solo la app pueda leer Firestore/Storage.
- Revisar que el invitado sea de solo lectura en `firestore.rules` (publicarlas solo después de probarlas en el emulador).

## 5. Controles de costo (hacer ya, sin código)
1. **Alerta de presupuesto**: Google Cloud → Facturación → Presupuestos y alertas (p. ej. US$5, avisos al 50/90/100 %).
2. Revisar el uso diario en **Firestore → Uso** los días siguientes al despliegue de esta rama.
3. Evitar exportar/importar «todos» seguido: usar el selector de laboratorios.
4. No usar «Descargar todos» para revisar un solo laboratorio.

## 6. Resumen de impacto esperado

| Acción | Antes | Con esta rama | Con fase 2 |
|---|---|---|---|
| Abrir la app (pantalla principal) | ~1 600 | ~1 600 | ~1–30 |
| Volver a la pantalla principal | ~1 600 | 0 – ~150 | 0 |
| Exportar 1 laboratorio | ~4 200 | ~100–400 | igual |
| Importar 1 laboratorio | ~8 400 | ~200–800 | igual |
| Subir/ver una foto nueva | 3–8 MB | ~200–400 KB | ~30–60 KB en tarjetas |

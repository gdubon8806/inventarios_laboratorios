# Plan de optimización de Firebase (lecturas y descargas)

Actualizado: 2026-11-28 · Fase 1 publicada en `main` (PR #7) · Fase 2: **pendiente** (sección 5)

> Para quien continúe (persona o agente de IA): lee todo el documento. La sección 5 es la guía de
> implementación de la fase 2, con archivos, funciones y criterios de aceptación. Respeta las reglas de la
> sección 8.

---

## 1. Problema

Desde el despliegue de la v2 de códigos (PR #5, 24/11) las lecturas de Firestore pasaron de casi 0 a
**~500 000 en unas horas** y Firebase empezó a cobrar. El límite gratuito diario es **50 000 lecturas**,
20 000 escrituras y 1 GB de descarga de Storage.

No hay bucles: ningún efecto de React vuelve a leer solo (revisado en todas las páginas y componentes).
El gasto sale del **uso normal multiplicado por lo caro de cada acción**.

## 2. Por qué antes era casi 0

Antes de la v2, la pantalla principal solo leía la colección `laboratorios` (~20 documentos).
La v2 agregó estados de códigos por laboratorio y búsqueda global por nombre, y para eso la pantalla
principal empezó a leer **toda** la colección `items` en cada visita.

## 3. Costo de cada acción

Base aproximada: ~1 600 registros (`items`) y ~2 600+ unidades (`items/{id}/unidades`).
Firestore cobra 1 lectura por documento devuelto (y mínimo 1 por consulta, aunque venga vacía).

| Acción | Antes de la fase 1 | Después de la fase 1 (hoy) | Con la fase 2 |
|---|---|---|---|
| Abrir la app (pantalla principal) | ~1 600 | ~1 600 | **~20** |
| Volver a la pantalla principal (misma pestaña) | ~1 600 | 0 – ~150 | 0 – ~20 |
| Buscar por nombre en la pantalla principal | 0 (ya cargado) | 0 | ~1 600 la 1.ª vez por pestaña |
| Entrar a un laboratorio | ~50–150 | ~50–150 | igual |
| Abrir `/diagnostico` | ~3 200 | ~3 200 | ~1 600 (ver 5.5) |
| Descargar Excel de 1 laboratorio | ~4 200 | ~100–400 | igual |
| Descargar Excel de todos | ~4 200 | ~4 200 | igual |
| Importar Excel de 1 laboratorio | ~8 400 | ~200–800 | igual |
| Subir una foto | 3–8 MB | ~200–400 KB | ~30–60 KB en tarjetas (ver 6.1) |

**Cómo se llega a 500 000:** ~300 aperturas de la pantalla principal (p. ej. 30 personas × 10 visitas),
o una mezcla de ~150 aperturas + ~20 descargas/subidas de Excel + algunas visitas a `/diagnostico`.
Navegar los datos en la **consola de Firebase también cuenta** como lecturas.

**Sesión típica** (abrir la app, entrar a 3 laboratorios y volver cada vez):

| | Lecturas | Ahorro vs. antes |
|---|---|---|
| Antes de la fase 1 | ~6 700 | — |
| Fase 1 (hoy) | ~2 200 | ~65 % |
| Fase 2 | ~300–450 | **~93–95 %** |

Con la fase 2, 300 aperturas costarían ~10 000–15 000 lecturas: dentro del límite gratuito.

## 4. Fase 1 — HECHO (PR #7, en producción)

1. **Compresión de imágenes** (`components/uploader/uploader.tsx`): `compressorjs`, JPEG 0.8, lado mayor
   ≤ 1200 px. Se aplica al elegir la foto, antes del enfoque. *Pendiente manual:* volver a subir desde
   «Editar» las fotos subidas entre el 28/11 y el PR #7 (quedaron de varios MB).
2. **Caché de la pantalla principal** (`lib/cache/home-cache.js`, usada en `pages/index.js`): en memoria,
   10 min, por pestaña. Al volver solo se relee el laboratorio visitado (`markLabDirty` en
   `pages/inventory.js`). `/bajas` y una importación aplicada invalidan todo. **No ayuda al abrir la app
   desde cero** (eso lo resuelve la fase 2).
3. **Exportar/importar por laboratorio**: `loadSnapshot({ labIds })` en
   `components/exportData/snapshot.js`. Exportar 1 laboratorio o los elegidos lee solo esos; importar lee
   solo los laboratorios del archivo (hoja `_meta`).

## 5. Fase 2 — GUÍA DE IMPLEMENTACIÓN (pendiente)

### 5.1 Resumen de conteos dentro de cada laboratorio (el mayor ahorro)

**Idea:** guardar los conteos de cada laboratorio en su propio documento `laboratorios/{id}`, en un campo
`resumen`. La pantalla principal **ya lee** todos los laboratorios (`readLab()`), así que los conteos salen
gratis y deja de hacer falta `readAllActiveItems()` al abrir.

Ventaja de esta opción: **no hace falta una colección ni una regla nueva**. Las reglas actuales ya permiten
leer `laboratorios` con sesión y escribirlo como admin.

**Forma del campo** (en `laboratorios/{id}`):

```js
resumen: {
  total, sinCodigo, pendienteImprimir, impreso, incongruentes, porValidar, // = computeLabCodeStatus(...)
  requiereValidacion,          // nº de registros activos con requiereValidacion === true
  actualizado: serverTimestamp(),
  version: 1,
}
```

**Pasos:**

1. Crear `components/firebase/lab-summary.js`:
   - `computeLabSummary(records)` → `{ ...computeLabCodeStatus(records), requiereValidacion: n }`
     (pura; probarla en `lib/` con `node --test` si se separa la parte pura).
   - `recalcularResumenLab(labId)`: `readLabRecords(labId)` (ya existe en
     `components/firebase/generate-missing-codes.js`) → `computeLabSummary` →
     `updateDoc(doc(firestore, 'laboratorios', labId), { resumen: {...} })`.
     **Sin** `auditFields()` (no es una edición del laboratorio).
     Devuelve el resumen. Si falla (p. ej. el usuario es invitado), registrar y no romper la pantalla.
   - `recalcularTodosLosResumenes()`: una lectura de `items` agrupada por `idLab` y un `writeBatch` con
     todos los laboratorios. Solo admin.
2. **Mantener el resumen al día** — llamar `recalcularResumenLab(labId)` (solo si `isAdmin`) después de
   cualquier escritura que cambie registros de ese laboratorio:
   - `pages/inventory.js`: en `handleRefresh` (se llama tras guardar, crear, dar de baja, cambiar tipo,
     cantidad, unidades, reportes…). Hacerlo una vez por refresco, no por cada componente.
   - `pages/index.js`: en `reloadLabStatus(labId)` (tras generar códigos o marcar impresas).
   - `pages/importar.js`: tras aplicar, para cada `labIdsDe(parsed)`.
   - `pages/bajas.js`: tras restaurar o eliminar, para los laboratorios afectados (o
     `recalcularTodosLosResumenes()`).
   - `components/addItemCard.js` / alta de registros: el laboratorio del registro nuevo.
3. **Pantalla principal** (`pages/index.js`, `fetchLabs`):
   - Leer solo `readLab()`. Estados: `statuses[lab.id] = lab.resumen`; incongruentes:
     `lab.resumen.requiereValidacion`.
   - **Quitar** `readAllActiveItems()` y `readIncongruentesPorLab()` del arranque.
   - **Respaldo:** si un laboratorio no tiene `resumen` (o `version` distinta), y el usuario es admin,
     calcularlo con `recalcularResumenLab` (o `recalcularTodosLosResumenes` si faltan varios). Si es
     invitado, mostrar la tarjeta sin conteos (no fallar).
   - Agregar en `/diagnostico` (o en la pantalla principal para admin) un botón «Recalcular resúmenes»
     que llame `recalcularTodosLosResumenes()`.
4. **Búsqueda por nombre bajo demanda** (`pages/index.js`, `itemResults`):
   - Cargar `readAllActiveItems()` **solo** cuando el texto del buscador tenga ≥ 2 caracteres y no sea un
     código (`isCodeLike`). Mostrar «Buscando…» mientras carga.
   - Guardar el resultado en la caché de la fase 1 (`home-cache`) para no repetirlo en la misma pestaña.
5. **Tarjetas y panel lateral:** `LaboratoryCard` y `SidePanel` reciben `status`/`statuses`; no cambian si
   `statuses` sigue teniendo la misma forma.

**Criterios de aceptación:**
- Abrir la pantalla principal como invitado o admin: ~20 lecturas (una por laboratorio), no ~1 600.
  Verificar en Firestore → Uso, o contando en la pestaña Red del navegador.
- Los conteos de cada tarjeta coinciden con los de antes (comparar con la versión actual en producción).
- Editar un registro y volver: el conteo de ese laboratorio se actualiza.
- Buscar por nombre sigue encontrando registros de todos los laboratorios.
- `npm test` pasa; agregar pruebas de `computeLabSummary`.

### 5.2 Caché persistente (opcional, después de 5.1)

Con 5.1 abrir la app ya cuesta ~20 lecturas, así que esto es opcional. Si hiciera falta: guardar en
`localStorage` la lista de laboratorios con su `resumen` y la hora; reutilizarla si tiene < 10 min.

### 5.3 App Check y usuario invitado (seguridad y abuso)

- La contraseña del invitado es pública (`NEXT_PUBLIC_GUEST_PASSWORD` se ve en el navegador): cualquiera
  puede iniciar sesión y generar lecturas.
- **Cambiarla** en Firebase Authentication y en Vercel (`NEXT_PUBLIC_GUEST_PASSWORD`) + Redeploy.
- **App Check** con reCAPTCHA v3: Firebase → App Check → registrar la app web → `initializeAppCheck` en
  `firebaseConfig.js` con la clave del sitio (variable `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`). Primero en modo
  *monitorear*; cuando las métricas muestren solo tráfico verificado, **aplicar** en Firestore y Storage.
- Confirmar que el invitado es de solo lectura en `firestore.rules` (probar en el emulador antes de publicar).

### 5.4 Imágenes: miniaturas y caché del navegador

- Subir además una miniatura (~400 px, ~30–60 KB) con `compressorjs` y guardar `imgThumbUrl` /
  `imgThumbName` en el registro/laboratorio. Usarla en tarjetas, listas y panel; la de 1200 px solo en
  detalle y «Ver completa». Al borrar la imagen, borrar ambas.
- En `components/firebase/uploadImages.js`, subir con
  `uploadBytes(ref, file, { cacheControl: 'public,max-age=31536000' })` (los nombres ya son únicos), para
  que el navegador no vuelva a descargar la misma foto.

### 5.5 `/diagnostico` más barato

`pages/diagnostico.js` lee todos los `items` y luego vuelve a leer cada laboratorio con `readItem`
(~3 200 lecturas). Calcular «visibles» a partir de la primera lectura (mismo filtro que `readItem`:
`idLab === lab.id && activo !== false`) para quedar en ~1 600. Usarlo solo cuando haga falta.

## 6. Orden recomendado

1. 5.3 sin código: cambiar la contraseña del invitado (hoy).
2. **5.1** resumen + búsqueda bajo demanda (el mayor ahorro).
3. 5.5 diagnóstico.
4. 5.4 miniaturas y `cacheControl`.
5. 5.3 App Check.
6. 5.2 solo si sigue haciendo falta.

## 7. Controles de costo (sin código, hacer ya)

1. **Alerta de presupuesto:** Google Cloud → Facturación → Presupuestos y alertas (p. ej. US$5; avisos al
   50/90/100 %). Firebase no tiene tope duro: la alerta avisa, no corta.
2. Revisar **Firestore → Uso** (gráfica por hora) para ver de dónde vienen los picos: horas de clase =
   pantalla principal; momentos de pruebas = Excel.
3. Mientras no esté la fase 2: no descargar/subir el Excel de «todos» seguido (usar el selector de
   laboratorios), no abrir `/diagnostico` sin necesidad y evitar navegar datos en la consola de Firebase.

## 8. Reglas para quien implemente

- Trabajar en una rama nueva desde `main`; no hacer `--force`, squash ni cambiar autores de commits.
- No publicar `firestore.rules` ni correr `scripts/migrate-v3.js --apply` sin confirmación del dueño.
  (La fase 2.1 está diseñada para no necesitar reglas nuevas.)
- No escribir contraseñas, llaves ni valores de variables de entorno en el repositorio.
- Antes de fusionar: `npm test`, `next build`, y probar en la vista previa de Vercel los criterios de 5.1.

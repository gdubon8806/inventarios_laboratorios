# Plan V2.1 — Panel lateral, reportes, códigos por tipo/unidad, baja lógica, etiquetas e importación Excel

> Fecha: 2026-11-21 · Rama: `docs/plan-codigos-barras` · Estado: **solo análisis y plan, nada implementado.**
> Reemplaza y amplía `ANALISIS_Y_PLAN_CODIGOS_BARRAS.md` (usaba `INV-000001` y código editable; ver §13).
> V2.1 incorpora las decisiones del usuario del 2026-11-21 (código por unidad, baja lógica, estados fijos, etc.).

---

## 0. Estado actual (¿hay avance?)

| Tema | Estado |
|---|---|
| Código de barras en la app | **No hay código implementado.** Solo documentación (commit `4cd0600`). |
| Ramas `administracion-suministros`, `generador-nombres-para-imgs` | Ya contenidas en `main`; nada nuevo. |
| Maqueta (`C:\CEUTEC\datos del inventario- claude\index.html` + `.pptx`) | Solo archivos sueltos (el pptx dice `docs/maqueta-busqueda`, no existe en el repo). Base visual del panel lateral. |
| Impresora (foto `WhatsApp Image ... .jpeg`) | Térmica de escritorio de 4", luces POWER/ERROR y botón FEED. **No se ve marca ni modelo** → ver §8.4. |
| Engram | Configurado y sano. |

---

## 1. Decisiones ya tomadas por el usuario

| # | Decisión |
|---|---|
| D1 | **Código por unidad** para Mobiliario, Equipo y Herramienta. **Insumo = 1 código por registro.** |
| D2 | La tarjeta sigue siendo **una sola con una imagen**; al abrirla sale una **tabla de unidades**. Admin edita unidad por unidad; invitado solo ve cantidad y datos generales. |
| D3 | **Eliminar = baja lógica** (nunca `deleteDoc`). |
| D4 | Dentro del lab: **número de registros** y **total por cantidad**; cada tarjeta muestra su cantidad. |
| D5 | **Fecha de vencimiento:** solo se oculta en pantalla al invitado. Si no se activa: vacía. Si se activa "tiene vencimiento": **fecha obligatoria**. |
| D6 | **Los laboratorios no llevan código.** Desde la tarjeta del lab se pueden imprimir todos los registros, con confirmación "¿seguro de imprimir N etiquetas del laboratorio X?". |
| D7 | **Sin historial:** solo un estado fijo por artículo/unidad. |
| D8 | Datos existentes sin código: **botón "Generar códigos de barra" por lab** (con confirmación), indica cuántos quedan pendientes; colores en la tarjeta según estado del código; los registros **nuevos** nacen con código automático. |
| D9 | Código no editable, autogenerado; tipo inmutable salvo proceso de cambio (tarjeta roja hasta reimprimir). |
| D10 | Invitado: ver + reportar. Admin: agregar, editar, dar de baja, imprimir. |
| D11 | **Umbrales de validación al crear unidades/códigos:** Herramienta y Equipo **> 10** → alerta y validar **uno a uno** (mostrando el nombre); Mobiliario **> 20** → igual; Insumo sin problema, solo si **> 100** pregunta Sí/No. |
| D12 | **Datos viejos se conservan y se siguen mostrando** (observaciones, serie, etc.); no se mueven ni se pierden. |
| D13 | **Datos incongruentes** (sin tipo, tipo raro, cantidad no válida): el **laboratorio se marca "datos incongruentes — validar"** y dentro, cada **registro marcado** para que el admin lo corrija. No reciben código hasta corregirse. |
| D14 | **Papelera** ("archivos de baja") aparte, con opción de **vaciar papelera** (eliminación definitiva, con confirmación). |
| D15 | **Impresora: se retoma después** (modelo/rollo pendientes). La impresión por navegador se deja lista y se prueba cuando esté disponible. |

---

## 2. Modelo de datos final

### 2.1 Colecciones
```
laboratorios/{id}
  name, description, imgurl, imgname
  ubicacion            string (nuevo, opcional)
  activo               bool (default true)  + fechaBaja, motivoBaja, bajaPor   (baja lógica)

items/{id}              ← REGISTRO (una tarjeta, una imagen)
  equipo, marca, modelo, ubicacion, columnadelocalizacion, imgurl, imgname, idLab
  tipo                  'Mobiliario'|'Equipo'|'Herramienta'|'Suministro'  (inmutable salvo proceso §4.3)
  cantidad              NUMBER (hoy es string → migrar)
                        · MOB/EQU/HER: = unidades activas (derivado, no editable a mano)
                        · INS: número editable
  codigo                solo INS (ej. INS-000045)
  estadoCodigo          'sinCodigo' | 'pendienteImprimir' | 'impreso'   (del registro; en no-INS = agregado de sus unidades)
  numeroSerie, codigoFundaempresa   solo INS (en no-INS viven en cada unidad)
  tieneVencimiento bool (false) · fechaVencimiento Timestamp|null
  estado                'bueno'|'malo'|'reparacion'  (solo INS; en no-INS vive en cada unidad)
  totalUnidades, unidadesReportadas  (denormalizados, solo no-INS)
  activo bool (true) · fechaBaja · motivoBaja · bajaPor
  requiereValidacion bool · motivoValidacion string     (datos incongruentes, D13)
  pendienteValidar bool                                 (omitido por umbral, D11)
  observaciones                                         (datos viejos: se conservan y se muestran, D12)
  ultimaModificacion (serverTimestamp) · ultimaModificacionPor {uid,email}

items/{id}/unidades/{uid}      ← solo MOB/EQU/HER
  codigo (EQU-000123), estadoCodigo, codigoGeneradoEn, codigoImpresoEn
  numeroSerie, codigoFundaempresa, observaciones
  estado 'bueno'|'malo'|'reparacion'
  idLab, tipo (duplicados para consultas por lab)
  activo, fechaBaja, motivoBaja, bajaPor
  codigoAnterior, ultimaModificacion, ultimaModificacionPor

reportes/{id}
  registroId, unidadId|null, idLab, codigo, comentario,
  reportadoPor {uid,email}, fecha,
  estadoReporte 'abierto'|'resuelto', resueltoPor, fechaResolucion
  (la `solucion` va en reportes/{id}/privado/solucion → lectura solo admin)

counters/{EQU|MOB|HER|INS}   { next }
codigos/{codigo}             { registroId, unidadId|null, labId, activo, redirigeA? }   (unicidad + búsqueda 1 lectura)
importaciones/{id}           auditoría de cada carga Excel
```

### 2.2 Por qué este modelo
- **Registro padre + subcolección `unidades`** (modelo A; descartados: colección plana y array embebido). La vista del lab cuesta lo mismo que hoy; la tabla de unidades se carga solo al abrir la tarjeta; el array embebido choca con límite de 1 MiB, conflictos entre admins y no permite buscar por código.
- **`codigos/{codigo}`** hace que escanear = 1 lectura directa, sin índice collection-group, y conserva los códigos viejos tras un cambio de tipo o una baja.
- **`estado` ≠ reporte:** `reportado` **no es un estado guardado**, es una marca derivada de que exista un reporte abierto. Evita que el invitado tenga que escribir en `items` y que se desincronice.

### 2.3 Estados (recomendación única, sin historial)
`bueno` · `malo` · `reparacion` (default `bueno`; ausente = bueno). Solo admin los cambia. "Reparación" cubre "malo pero ya se atiende". Baja = `activo:false`, no un estado. Al resolver un reporte, el admin elige el nuevo estado en el mismo diálogo.

### 2.4 Confidencialidad (decisión D5 + lo demás)
- `fechaVencimiento`, `ultimaModificacion*`: **solo se ocultan en la UI** (decisión tomada). El dato igual viaja al navegador del invitado; es aceptable.
- Lo que **sí** debe protegerse con reglas: que el invitado no pueda escribir, y que la `solucion` del reporte sea solo admin (doc `privado`). Si luego quieren ocultar de verdad el vencimiento/serie, se mueven a docs `*_privado`.

---

## 3. Códigos autogenerables

- **Formato:** `PREFIJO-######` (Code 128). `MOB` Mobiliario · `HER` Herramienta · `INS` Insumo (hoy "Suministro") · `EQU` Equipo.
- **Contador por tipo** (`counters/EQU`…) en `runTransaction`; los números **nunca se reutilizan** (ni tras baja ni tras cambio de tipo).
- **Nada manual:** el admin ve el código solo lectura. Se elimina el campo editable/"Generar" del plan anterior.
- **Buscador:** regex `^(MOB|HER|INS|EQU)-?\d+$` (sin importar mayúsculas/espacios; acepta sin guion por si el escáner lo cambia). Exacto → `getDoc(codigos/X)`; parcial → rango por prefijo. Si no calza → búsqueda por nombre como hoy. Código viejo → aviso "código reemplazado". Código de baja → solo admin ve la ficha con aviso "DADO DE BAJA el X, motivo…"; invitado: "no encontrado".
- **Registros nuevos** nacen con código en la misma transacción (`estadoCodigo:'pendienteImprimir'`); los de MOB/EQU/HER crean N unidades con códigos.

---

## 4. Unidades (D1/D2)

### 4.1 Pantalla
- **Tarjeta del lab:** imagen, nombre, chips de tipo, **cantidad** del registro, marcas (§6).
- **Al abrir (admin):** tabla de unidades — `Código | Serie | Cód. Fundaempresa | Estado | Observaciones | Reportes | Acciones` — editable fila por fila, imprimir etiqueta por unidad, reportar, dar de baja.
- **Al abrir (invitado):** datos generales + cantidad (y unidades reportadas "2 de 10"); sin edición. Puede reportar una unidad (elige de la lista o escanea su código).
- **Insumo:** no tiene tabla; un código, cantidad numérica.

### 4.2 Cambios de cantidad (no-INS)
- **Subir 3→10:** la UI dice "se crearán 7 unidades"; una transacción reserva 7 números del contador, crea 7 unidades + 7 docs en `codigos/`, actualiza `cantidad` y deja `pendienteImprimir`. (>~200 unidades: lotes con rango reservado y bandera `creacionEnCurso` para reanudar; límite Firestore 500 escrituras por transacción.)
- **Bajar 10→8:** **nunca** baja silenciosa. La UI abre la tabla en modo "dar de baja 2": el admin marca exactamente 2, motivo obligatorio (dañada, perdida, traslado, …) y confirma. Códigos nunca se reutilizan.
- **Reactivar** una unidad = acción explícita de admin.
- **Umbrales de cantidad (D11)** — aplican al crear/subir cantidad, a la generación masiva (§8.1) y a la migración:
  | Tipo | Umbral | Qué pasa al superarlo |
  |---|---|---|
  | Herramienta, Equipo | **> 10** | Alerta + validación **uno a uno**: diálogo con el **nombre del registro**, tipo y cantidad ("Taladro Bosch — 14 unidades"); el admin elige *Crear unidades* / *Omitir (queda pendiente de validar)* / *Cambiar a Insumo* (si es consumible). |
  | Mobiliario | **> 20** | Igual. |
  | Insumo | **> 100** | Pregunta simple Sí/No ("¿Confirmas 250 unidades?"). Hasta 100, sin preguntas. |
  El umbral va en una constante configurable (`lib/codes/thresholds.js`). Los registros omitidos quedan en `estadoCodigo:'sinCodigo'` con marca `pendienteValidar` (se cuentan en el lab: "N por validar"). Interpretación de "validar uno a uno y ver cuáles son para decidir si se imprime o no": la lista muestra nombres y el admin decide por cada uno antes de que se creen las unidades/etiquetas.

### 4.3 Cambio de tipo (proceso, no un select)
Botón "Cambiar tipo…" solo admin + escribir `CAMBIAR` para confirmar; el select de `tipo` queda `disabled` en `optionsItemCard.js`.
| Cambio | Qué pasa |
|---|---|
| INS → EQU/MOB/HER | El código INS pasa a `codigoAnterior`/`redirigeA`; se crean `cantidad` unidades con códigos nuevos (serie/Fundaempresa vacíos) y **tarjeta roja "pendiente imprimir"** (N etiquetas). |
| EQU↔MOB↔HER | Cada unidad recibe código nuevo del prefijo nuevo; el viejo en `codigoAnterior`; tarjeta roja. |
| EQU/MOB/HER → INS | **Destructivo** (pierde datos por unidad): muestra cuántas unidades tienen serie/Fundaempresa, exige respaldo; unidades pasan a `activo:false` ("cambio de tipo"); un único código INS. **Recomendado: bloquear** si alguna unidad tiene serie o Fundaempresa, salvo override explícito. |
El Excel **no** puede cambiar el tipo (error).

---

## 5. Baja lógica (D3)

- **Items y unidades:** `activo:false`, `fechaBaja`, `motivoBaja` (obligatorio, mín. 5 caracteres), `bajaPor`. `deleteItem` → `deactivateItem` (`updateDoc`). Borrado físico solo como botón admin "Eliminar definitivamente" dentro de la vista de bajas (escribir `ELIMINAR`) y **prohibido por reglas** por defecto.
- **Laboratorios:** también baja lógica (hoy `deleteDoc` deja items huérfanos y rompe `readLabById`). Dar de baja un lab **no** propaga a cada item (cientos de escrituras): los items se ocultan porque el lab no se lista; al restaurar el lab vuelve todo.
- **Códigos de baja:** jamás se reutilizan; el item conserva su código.
- **Imágenes en Storage:** no se borran en la baja, solo en eliminación definitiva (verificar que el nombre no se comparta).
- **Reportes abiertos:** al dar de baja avisa "tiene N reportes abiertos"; el admin elige resolverlos con solución "Baja: motivo" para no inflar el contador.
- **Lecturas:** Firestore **no** devuelve docs sin el campo en `where('activo','==',true)`. Estrategia: **filtrar en cliente `activo !== false`** (cero migración obligatoria, cero índices; volumen pequeño por lab) + migración de limpieza opcional que escribe `activo:true`. La vista de bajas sí usa `where('activo','==',false)`.
- **Papelera / archivos de baja (D14) — `/bajas`, solo admin:** pestañas Artículos / Unidades / Laboratorios; código, nombre, lab, fecha, motivo, quién. Acciones: **Restaurar** (si el lab está inactivo, pide restaurarlo primero), **Eliminar definitivamente** (uno) y **Vaciar papelera**.
  - *Vaciar papelera* = eliminación **irreversible** de todo lo que esté en baja. Protecciones: diálogo con el **conteo exacto** ("se eliminarán 37 registros, 112 unidades, 5 imágenes"), escribir `VACIAR`, **respaldo xlsx automático** antes, y opción de vaciar solo lo anterior a N días / solo una pestaña.
  - Al eliminar definitivamente: se borra el registro **y su subcolección `unidades`** (Firestore no borra en cascada), las **imágenes** de Storage (solo si ninguna otra tarjeta usa el mismo archivo) y los reportes asociados; en `codigos/{codigo}` se deja una **lápida** (`eliminado:true`) y el contador solo avanza, así **ningún código se reutiliza jamás**, ni tras vaciar la papelera. Una búsqueda de ese código responde "código eliminado".
  - La eliminación definitiva es la **única** excepción a "nunca `deleteDoc`" y solo se permite sobre docs con `activo:false` (regla Firestore).
- **Cuadros, exports e import:** solo activos (export con casilla "incluir bajas"). Filas ausentes en el Excel = "marcar baja" con confirmación.

---

## 6. Reportes (por unidad) y cuadro del lab

- **Crear (todos, incl. invitado):** modal desde la tarjeta/tabla/panel → comentario obligatorio → doc en `reportes` con `unidadId` (no-INS exige elegir unidad o escanear código).
- **Marca visual:** chip rojo **"Reportado"** en la tarjeta (visible a todos): "2 de 10 unidades reportadas" o "Reportado" en insumos. Se calcula leyendo `reportes` abiertos por `idLab` (una consulta por lab), no un campo en `items`.
- **Click en la marca:** lista de reportes (comentario, quién, fecha). **Solo admin** ve la solución y los botones *Resolver* (eligiendo nuevo estado bueno/malo/reparación).
- **Cuadro dentro del lab (D4)**, entre subtítulo y filtros (`pages/inventory.js:222-224`), calculado sobre todos los activos (no los filtrados):
  - **N° de registros** (tarjetas activas)
  - **Total por cantidad** (suma de `cantidad` numérica; en no-INS = unidades activas)
  - **Reportadas** (unidades reportadas abiertas + insumos reportados)
  - *(admin)* **Pendientes de código/impresión**
- **Colores en la tarjeta** (para no chocar): **borde izquierdo grueso** = estado del código; **chip** = reportado/estado.
  | Situación | Color |
  |---|---|
  | `sinCodigo` | 🟧 ámbar + chip "Código sin generar" |
  | `pendienteImprimir` (incl. tipo cambiado) | 🟥 rojo + chip "Pendiente imprimir" |
  | `impreso` | sin marca |
  | Reportado | chip rojo "Reportado" |
  | malo / reparación | chip rojo / naranja |

---

## 7. Panel lateral (pantalla principal)

**Dónde:** `HomePage` en `pages/index.js` (~153-166): `<SidePanel>` hermano de `LabsContainer` en un contenedor flex/grid (estilos en `styles/Home.module.css`); se muestra **solo cuando ya cargaron los datos**. En móvil, drawer (como la maqueta).

| Bloque | Detalle |
|---|---|
| Lab actual | Nombre + ubicación (campo nuevo `ubicacion` en labs). En `/` se actualiza al seleccionar una `LaboratoryCard`; en `/inventory`, el lab abierto. |
| Buscador por código | `autoFocus`, `Enter` (escáner USB), recupera foco; reutiliza `SearchAppBar`. |
| Ficha | Unidad encontrada + su registro: código, lab, marca, modelo, tipo, serie, Fundaempresa, estado. |
| Acciones | **Reportar** (todos) · **Imprimir etiqueta** (admin) · Editar / Dar de baja (admin). |
| Pendientes | Solo admin: unidades con `pendienteImprimir` + "Imprimir pendientes". |

---

## 8. Códigos para lo existente, etiquetas e impresión

### 8.1 Generar códigos faltantes (D8)
- En la **tarjeta del lab** (home), si hay registros sin código y eres admin: botón **"Generar códigos de barra (N pendientes)"** → diálogo "¿Está seguro? Se asignarán códigos según el tipo (MOB/HER/INS/EQU). No se puede deshacer."
- **Algoritmo (idempotente y reanudable):**
  1. Consulta los registros del lab con `estadoCodigo=='sinCodigo'` y activos, en páginas de ~400.
  2. Por lote, `runTransaction`: lee `counters/{PFX}` de los prefijos presentes, reserva rango, escribe código(s) y `estadoCodigo:'pendienteImprimir'`. INS → código en el registro; MOB/EQU/HER → crea `cantidad` unidades. Si ya tiene código, lo salta. Lote ≤ ~450 escrituras.
  3. Si falla a medias: los procesados ya quedaron en `pendienteImprimir`; al reintentar solo trae los `sinCodigo` restantes.
  4. **Datos incongruentes (D13):** sin tipo, tipo raro, `cantidad` vacía/no numérica/negativa → **no se procesan**; se les pone `requiereValidacion:true` + `motivoValidacion` ("sin tipo", "cantidad '5 pzas'") y se **marca el laboratorio** "⚠ datos incongruentes — validar (N)". Dentro del lab esos registros salen con franja/chip de advertencia; el admin los corrige (o los da de baja) y la marca se limpia sola al quedar válidos. "Suministro"→INS.
  4b. **Umbrales (D11):** los registros que superan 10 (HER/EQU), 20 (MOB) o 100 (INS) se detienen en un diálogo de validación uno a uno antes de crear unidades (ver §4.2).
  5. UI: barra de progreso `procesados/total`, botón cancelar entre lotes, bloqueo de doble clic; tras terminar: "Quedan N pendientes".
- **Contar pendientes por lab:** `getCountFromServer` con `estadoCodigo=='sinCodigo'` (requiere que los registros viejos tengan el campo → la migración inicial escribe `estadoCodigo:'sinCodigo'` y `activo:true`; índice compuesto `idLab+estadoCodigo`). Alternativa: contadores denormalizados en el lab (más mantenimiento).
- Nuevos registros: código automático al crearse (no necesitan botón).

### 8.2 Etiquetas
Una función `printLabels(items[])`: CSS `@page` con tamaño real, una etiqueta por página (`page-break-after`), **SVG** de JsBarcode Code 128 (módulo ≥0.25 mm, zona silenciosa 3 mm) y código legible debajo, en `<iframe>` oculto. Tamaño configurable (mm, `localStorage`). La maqueta ya trae 50×30 mm.

### 8.3 Dónde se imprime (solo admin)
- **Individual:** botón en detalle/edición y en cada fila de la tabla de unidades.
- **Todo el laboratorio (D6):** botón en la tarjeta del lab y en `/inventory`, con diálogo **"¿Imprimir 128 etiquetas del laboratorio X?"**, casillas *solo pendientes / todas* y filtro por tipo.
- **Panel lateral:** la etiqueta mostrada o "Imprimir pendientes".
- **Tandas:** máx. ~100 etiquetas por trabajo ("Parte 1 de 2"). Tras cada tanda: "¿Salieron bien?" → Sí marca `impreso` solo de esos ids; No, nada. (El navegador no puede saber si salió el papel; `afterprint` también se dispara al cancelar → confirmación manual.)

### 8.4 La impresora
Sin marca/modelo visibles en la foto. Para identificarla en el PC donde está conectada: *Configuración → Impresoras y escáneres → (impresora) → Propiedades* para ver el nombre del **driver** (suele revelar Zebra/TSC/Xprinter/Gprinter/Munbyn/HPRT) y *Administrador de dispositivos → Detalles → Id. de hardware* (VID/PID). El **autotest** (mantener FEED al encender) suele imprimir modelo, firmware y lenguaje (ZPL/TSPL/EPL).
**No hace falta saberlo para empezar:** la impresión por navegador con el driver de Windows funciona con cualquiera. Calibrar el papel tras cada rollo (FEED) y hacer una **etiqueta de prueba** (borde + código escaneable) antes de la primera tirada. Opcional futuro: QZ Tray/RAW cuando se conozca el lenguaje.

---

## 9. Campos nuevos y permisos

| Campo | Admin | Invitado |
|---|---|---|
| Número de serie, Código Fundaempresa (por defecto vacíos) | edita | ve |
| Última modificación (+por) | ve | oculto (UI) |
| Fecha de vencimiento (D5) | switch "Tiene vencimiento"; si sí, fecha obligatoria; si no, `null`; opcional chip "Vence pronto ≤30 d" | oculto (UI) |
| Estado (bueno/malo/reparación) | cambia | ve |
| Reportes + comentario | ve y resuelve | ve y crea; no ve solución |
| Agregar / editar / baja / imprimir / cambiar tipo / importar | ✅ | ❌ |

**Validación de vencimiento:** fecha válida `yyyy-mm-dd`, año 2000–2100; se permiten pasadas (con aviso "vencido"); misma regla en alta, edición e importación.

**Reglas Firestore (crear `firestore.rules`; hoy no existen):**
```
function isAdmin(){ return request.auth!=null && request.auth.token.role=='admin'; }
items, items/*/unidades, laboratorios, counters, codigos, importaciones:
  read: auth != null  (invitado no lee activo==false)
  create/update: isAdmin()    delete: isAdmin() && resource.data.activo == false   (solo desde la papelera)
reportes: read auth!=null;
  create: auth!=null, campos permitidos, estadoReporte=='abierto', reportadoPor.uid==auth.uid, fecha==request.time
  update/delete: isAdmin()
reportes/*/privado: read, write: isAdmin()
```
Hoy el rol es solo UI (`index.js:35-45`, duplicado en `inventory.js:56-69`): extraer `useRole()`.

---

## 10. Excel (export / import con validador)

**Export (mejorar `components/exportData/export.js`)** — dos hojas por lab:
- **Registros:** una fila por registro: id, código (solo INS), nombre, tipo, marca, modelo, cantidad, ubicación, col. localización, serie/Fundaempresa (INS), tiene vencimiento, fecha, estado, activo.
- **Unidades:** una fila por unidad (código, registro, serie, Fundaempresa, estado, observaciones, activo).
- Hoja oculta `_meta` (versión de esquema, fecha de exportación, `itemId`/`unidadId`/`idLab`). Hoy el export no trae id ni código y la hoja se llama "Lab N".

**Import `pages/importar.js` (solo admin)** — `lib/import/validate.js` puro y testeable:
| Resultado | Regla |
|---|---|
| 🔴 **Error** (bloquea) | Código faltante/inexistente/duplicado/distinto al de su id; prefijo ≠ tipo; **cambio de tipo**; **cambio de cantidad en no-INS** ("use la app"); cantidad no entera o negativa; campo lleno en BD que quedó vacío; tipo fuera del catálogo; fecha inválida; "tiene vencimiento=Sí" sin fecha |
| 🟡 **Amarillo** (casilla "confirmo") | Cambia nombre, modelo, marca, serie, Fundaempresa, ubicación, observaciones, cantidad de insumo (se valida) |
| ➕ Nuevas | Fila sin código → recibe código al subir (requiere registro padre en Unidades) |
| ➖ Ausentes | Se listan; **marcar baja** con confirmación aparte, nunca borrar |

Flujo: subir → validar → **resumen** (sin cambios / modificados / nuevos / bajas / errores) → **previsualización celda a celda** (viejo tachado → nuevo) → **Subir** deshabilitado hasta 0 errores → corregir y re-subir (re-valida). Detecta cambios concurrentes comparando `ultimaModificacion`. Escritura: respaldo xlsx automático → reservar rango de códigos → `writeBatch` de 500 → registro en `importaciones/`. Idempotente. Nota: proteger la columna Código en Excel es débil; la validación real es en código.

---

## 11. Migración (script admin con dry-run y respaldo previo)
1. **Respaldo:** "Exportar todo" a Excel antes de tocar nada.
2. `cantidad` string → Number (`trim`, `,`→`.`); vacío → 0 y excepción; texto ("varios", "5 pzas") → **lista de revisión manual**, no adivinar.
3. `tipo` "Suministro"→INS; vacío/otro → excepción.
4. Agregar `activo:true` y `estadoCodigo:'sinCodigo'` a items y labs que no los tengan; `observaciones` `[]`→`""`.
5. **No** generar códigos aquí: lo hace cada admin con el botón por lab (§8.1). Los registros no-INS crean sus unidades en ese momento.
5b. **Datos viejos se conservan (D12):** `observaciones`, serie y demás campos del registro **no se mueven ni se borran**; se siguen mostrando en la ficha del registro como "Observaciones generales / datos previos". Las unidades nuevas nacen con sus campos vacíos y propios. Nada se pierde ni se copia a una unidad arbitraria.
5c. **Marcado de incongruentes (D13):** registros sin tipo/tipo raro/cantidad inválida → `requiereValidacion:true` + `motivoValidacion`; el lab guarda el conteo `incongruentes` (o se cuenta con `getCountFromServer`). La migración **no corrige nada por su cuenta**.
6. Idempotente (marca `migradoV3`), lotes de ~400, confirmación si hay cantidades enormes (ej. 500).

---

## 12. Hoja de ruta

| Fase | Contenido | Esfuerzo |
|---|---|---|
| **0. Base / deuda** | `useRole`; lista de tipos única; `normalizeText`; arreglar `create/update-item` (propagar errores, `ultimaModificacion`); bugs §15; `firestore.rules` + auditoría; credenciales invitado a env | 1 d |
| **1. Migración + baja lógica + papelera** | Script, `activo`, `estadoCodigo`, marcado de incongruentes (lab y registro), `deactivateItem/Lab`, filtro `!== false`, vista `/bajas` con restaurar, eliminar y **vaciar papelera** | 3 d |
| **2. Modelo de unidades** | Subcolección, tabla, cambios de cantidad, estados, campos nuevos (serie, Fundaempresa, vencimiento, ubicación de lab) | 3 d |
| **3. Códigos** | Contadores por tipo, `codigos/`, generación en altas, **botón "Generar códigos" por lab**, buscador | 2 d |
| **4. Panel lateral + búsqueda** | `SidePanel`, ficha, Enter/escáner, `?item=` | 1.5 d |
| **5. Reportes + cuadro del lab** | Colección, modal por unidad, marcas, cuadro, vista admin | 1.5 d |
| **6. Etiquetas / impresión** | `printLabels`, individual/lab/panel, tandas, confirmación, prueba física | 1.5 d |
| **7. Cambio de tipo** | Diálogo, transacciones INS↔N unidades, tarjeta roja | 1 d |
| **8. Import/Export Excel** | Export v2 (2 hojas), validador, preview, escritura segura | 3 d |
Total ≈ **16–17 días** (plan original: 4–5). Orden: 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Cada fase se puede entregar por separado en su propia rama/PR.

---

## 13. Qué cambia del plan anterior
- `INV-######` + contador único → **4 prefijos, contador por tipo**; código **no editable**.
- Una etiqueta por registro → **una por unidad** (MOB/EQU/HER).
- Borrado real → **baja lógica** (items, unidades y labs).
- Estado `reportado` guardado → **marca derivada** de reportes abiertos.
- Se agregan: unidades, reportes, panel lateral, cambio de tipo, import Excel, reglas Firestore, migración.

## 14. Por validar antes de implementar
**Resueltos con las decisiones del 2026-11-21:** volumen alto → umbrales D11; datos viejos → se conservan (D12); tipo/cantidad raros → lab marcado "incongruentes" (D13); baja de registros → papelera (D14); impresora → después (D15).

**Siguen abiertos (no bloquean la fase 0–2):**
1. **Motivos de baja** (lista cerrada: dañada, perdida, traslado, obsoleta, cambio de tipo, otro) y **quién restaura/vacía la papelera** (¿cualquier admin?). Se propone: cualquier admin restaura; vaciar exige escribir `VACIAR` + respaldo automático.
2. **EQU/MOB/HER → INS** (destructivo): se propone **bloquearlo** si alguna unidad ya tiene serie o Fundaempresa. Confirmar.
3. **Fecha de vencimiento no activada:** se deja **vacía/`null`** (no la fecha del día, para no confundirla con un vencimiento real). Confirmar.
4. **Umbrales (D11):** ¿"más de 10" incluye exactamente 10? Se asume **estrictamente mayor** (10 pasa sin alerta, 11 alerta). Confirmar; y si Insumo > 100 debe preguntar **una vez por registro**.
5. **Opción "Omitir"** en la validación uno a uno: el registro queda `pendienteValidar` y se vuelve a ofrecer la próxima vez que se pulse "Generar códigos". Confirmar que es el comportamiento deseado.
6. **Etiqueta física de una unidad dada de baja:** ¿se retira? (proceso, no código).
7. **Reglas de Firestore actuales:** revisarlas **en la consola de Firebase** (no están en el repo); hoy el invitado podría poder escribir. Puede hacerse ya, sin esperar a la implementación.
8. **Volumen real aproximado** (nº de registros/unidades por lab): solo sirve para estimar el tiempo de la migración y los lotes; ya no decide el diseño.
9. Confirmar versión de `firebase` instalada (`getCountFromServer`) y límites de 500 escrituras por lote.
10. **Seguridad:** el invitado usa **credenciales públicas** (`loginForm.js`); mover a env, tratarlo como usuario público y activar App Check.
11. **Pendiente por impresora (se retoma después):** modelo/driver y lenguaje (autotest + driver, §8.4), **tamaño del rollo en mm**, y si imprime un solo PC. Hasta entonces la fase 6 se construye con tamaño configurable y se prueba cuando esté la impresora.

## 15. Bugs a corregir al tocar cada archivo
- `pages/inventory.js:157` muta estado (`item.equipo = ...toLowerCase()`); `:93-95` `readLabById` null revienta.
- `optionsItemCard.js:213` `updateItem` sin `await`.
- `observaciones` se inicializa `[]` pero se usa como texto (`addItemCard.js:66`); `cantidad` string.
- `create/update/delete-item` tragan errores; `readLab()` devuelve `undefined` si falla.
- `delete-lab` deja items huérfanos (se resuelve con baja lógica).
- `loginForm.js:18` `loginUser` sin `await`; credenciales del invitado en texto plano (y en el historial de git).
- Lista de tipos triplicada; rol duplicado en 2 páginas.
- Residuos sin uso: `@auth0/nextjs-auth0`, `@vercel/postgres`, `@vercel/blob`, `pages/api/auth/[auth0].js`.

## 16. Archivos
**Crear:** `lib/codes/{prefixes,normalize}.js`, `components/firebase/{generate-code,generate-missing-codes,find-by-code,create-report,read-reports,change-type,deactivate-item,restore-item,manage-units}.js`, `components/{SidePanel,ReportModal,StatsBox,UnitsTable,GenerateCodesButton}.js`, `components/labels/LabelPreview.js`, `lib/printing/printLabels.js`, `lib/import/validate.js`, `pages/{importar,bajas}.js`, `hooks/useRole.js`, `scripts/migrate-v3.js`, `firestore.rules`, `firestore.indexes.json`.
**Modificar:** `pages/index.js`, `pages/inventory.js`, `components/{addItemCard,optionsItemCard,addLabCard,optionsLabCard,laboratoryCard,searchBar,itemsFilterer}.js`, `components/firebase/{create,update,delete}-item.js`, `delete-lab.js`, `read-item.js`, `read-lab.js`, `components/exportData/export.js`, `loginForm.js`, `package.json` (`jsbarcode`).

## 17. Criterios de aceptación
1. Escribir/escanear `EQU-000123` (o `equ000123`) abre la unidad y su registro en < 2 s desde cualquier pantalla.
2. Un registro de 10 equipos muestra una tarjeta con imagen; al abrirla, tabla de 10 unidades editables por el admin; el invitado solo ve cantidad y datos generales.
3. Registros y unidades nuevos reciben código sin intervención y jamás se duplican; los códigos de baja no se reutilizan.
4. En un lab con registros viejos, el botón "Generar códigos" asigna el prefijo correcto según tipo, informa cuántos quedan pendientes y es reanudable; la tarjeta pasa de ámbar a roja a sin marca.
5. "Eliminar" nunca borra: pasa a la papelera `/bajas`, se puede restaurar; "Vaciar papelera" pide confirmación con conteo exacto y respaldo; el cuadro del lab solo cuenta activos; un código eliminado jamás se reutiliza.
5b. Un registro HER/EQU con más de 10 (o MOB con más de 20) pide validación uno a uno con su nombre antes de crear unidades; Insumo > 100 pregunta Sí/No.
5c. Un lab con registros sin tipo/cantidad válida aparece marcado "datos incongruentes — validar"; dentro, cada registro afectado está marcado y no recibe código hasta corregirse. Los datos viejos (observaciones, etc.) siguen visibles.
6. Cambiar tipo genera códigos nuevos, deja la tarjeta roja y no se limpia hasta confirmar impresión.
7. Invitado puede reportar y ver reportes/comentarios, no la solución ni escribir en `items`.
8. El lab muestra N° de registros, total por cantidad y reportadas; cada tarjeta, su cantidad.
9. Imprimir todo el lab pide confirmación con el número exacto de etiquetas; se imprime en tandas y solo se marca `impreso` tras confirmar.
10. Un Excel con código alterado, cantidad inválida o campo vaciado no se puede subir; los cambios de nombre/modelo salen en amarillo; hay resumen y preview antes de subir.
11. Etiqueta impresa con barcode + código legible, leída por el escáner a la primera.

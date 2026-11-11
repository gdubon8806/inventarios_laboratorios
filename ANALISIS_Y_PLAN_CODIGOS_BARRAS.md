# Inventario de Laboratorios CEUTEC — Análisis y plan de códigos de barra

> Fecha: 2026-11-10 · Estado: **solo análisis y plan, nada implementado todavía.**

---

## 1. Cómo funciona hoy el sistema

### Stack
| Capa | Tecnología |
|---|---|
| Framework | Next.js (Pages Router, JS + algo de TS) + React 18.2 |
| UI | MUI (Material UI) + algo de Tailwind/CSS Modules, `react-hot-toast` para avisos |
| Base de datos | **Firebase Firestore** (colecciones `laboratorios` e `items`) |
| Imágenes | Firebase Storage (`uploadImages.js`, `delete-blob.js`) |
| Autenticación | **Firebase Auth** (email/contraseña) + *custom claim* `role` (`admin` o vacío) |
| Exportación | SheetJS (`vendor/xlsx`) → Excel por laboratorio o de todo |

> Rastros aparentemente residuales (no se usan en el flujo actual): `@auth0/nextjs-auth0` y `pages/api/auth/[auth0].js`, `@vercel/postgres`, `@vercel/blob`, `firebase-admin`.

### Pantallas
- **`/` (`pages/index.js`)** — login (`loginForm.js`) y, si hay sesión, la lista de laboratorios en tarjetas. Tiene un buscador **por nombre de laboratorio** (filtra en el cliente, ignorando tildes). Los admins ven *Agregar laboratorio* y *Exportar todo*. Hay botón "Ingresar como invitado".
- **`/inventory?id=<idLab>` (`pages/inventory.js`)** — items del laboratorio en tarjetas. Buscador por nombre de equipo + filtro por tipo (Suministro, Herramienta, Mobiliario, Equipo). Click en el nombre abre modal de detalles (solo lectura); admins ven *Agregar*, *Opciones* (editar/eliminar), comentarios y *Exportar*.

### Modelo de datos (Firestore)
```
laboratorios/{id}  → name, description, imgurl, imgname
items/{id}         → equipo, marca, modelo, ubicacion, columnadelocalizacion,
                     tipo, cantidad, imgurl, imgname, observaciones, idLab
itemComments/...   → comentarios por item (título, descripción, time)
```
Los items son una colección **plana** con `idLab` como referencia. Esto es clave: permite buscar un código en **todos** los laboratorios con una sola consulta (`where('codigo','==',X)`), sin `collectionGroup`.

### Roles
- `admin`: crea/edita/borra y exporta. Cualquier otro usuario (incluido invitado) es solo lectura. El rol viene de `getIdTokenResult().claims.role`.
- Las **reglas de Firestore no están en el repo**; hay que revisarlas en la consola de Firebase (ver §8).

### Hallazgos relevantes encontrados al revisar (no bloquean el plan, pero conviene saberlos)
1. **Credenciales del usuario invitado en texto plano** en `loginForm.js` (`invitadolaboratorios@gmail.com` / contraseña) — quedan además en el historial de git. Mientras el invitado sea solo lectura el riesgo es acotado, pero lo ideal es mover a variable de entorno y confirmar que las reglas de Firestore lo limitan a lectura.
2. `pages/inventory.js` **muta el estado** al filtrar (`item.equipo = item.equipo.toLowerCase()`), por lo que al buscar los nombres de los equipos quedan en minúscula en pantalla. Se debe arreglar al tocar ese archivo.
3. La lógica de "quitar tildes" está copiada 3 veces; conviene una sola función `normalizeText()` que también usaremos para el buscador por código.
4. `readLab()` devuelve `undefined` si falla → `laboratories.length` truncaría la pantalla.
5. `optionsItemCard.js` línea ~213: `const success = updateItem(...)` sin `await`.
6. `observaciones` se inicializa como `[]` pero se edita como texto.
7. El export a Excel no tiene columna de código (se agregará).

---

## 2. Qué se quiere lograr

1. **Buscador general por código** en la pantalla de laboratorios (`/`): escribir o **escanear** un código y llegar directo al equipo/producto, sin importar en qué laboratorio esté.
2. **Campo "Código"** en cada equipo/producto (y opcionalmente en cada laboratorio) para guardar el código.
3. **Generador automático de código**:
   - Ahora: botón para generarlo a los registros ya existentes (uno a uno o en masa).
   - A futuro: todo registro **nuevo** recibe su código automáticamente al crearse.
4. **Impresión de etiquetas** en la impresora térmica de códigos de barra, con **código de barras + número del código legible** (para buscar manualmente si el escáner falla).

---

## 3. Diseño propuesto

### 3.1 Formato del código
- Simbología: **Code 128** (la estándar para alfanuméricos, la lee cualquier escáner).
- Formato propuesto, corto para que el barcode salga grande y legible en etiqueta pequeña:
  - Items: `INV-000001`, `INV-000002`, …
  - Laboratorios (si se decide): `LAB-001`, …
- Contador secuencial en Firestore: documento `counters/items` (`{ next: 1 }`) incrementado **dentro de una transacción** → nunca se repite aunque dos admins creen a la vez.
- El campo `codigo` es **editable** (por si un equipo ya trae un código de fábrica/activo fijo que quieren conservar); se valida unicidad antes de guardar.

### 3.2 Modelo de datos (cambios)
```
items/{id}         + codigo: "INV-000123"        (string, único)
                   + codigoGeneradoAuto: boolean (opcional, trazabilidad)
laboratorios/{id}  + codigo: "LAB-003"           (opcional)
counters/items     → { next: number }
counters/labs      → { next: number }
```
Consulta por código = igualdad sobre un solo campo → Firestore crea ese índice automáticamente (no requiere índice compuesto).

### 3.3 Buscador general por código (pantalla de laboratorios)
- Un **solo cuadro de búsqueda** en `/` que hoy filtra por nombre de lab. Se vuelve "inteligente":
  - Si el texto **parece código** (`INV-…`, `LAB-…`, o solo dígitos) → busca por código en Firestore.
  - Si no → comportamiento actual (filtra laboratorios por nombre).
- **Escáner de pistola USB = teclado**: "escribe" el código y manda `Enter`. Por eso el input debe tener `autoFocus`, reaccionar a `Enter` (no solo al debounce de 300 ms) y recuperar el foco después de cada búsqueda.
- Resultado:
  - Coincidencia exacta → navega a `/inventory?id=<idLab>&item=<itemId>` y **abre automáticamente el modal de detalles** del equipo.
  - Código parcial (búsqueda manual) → lista de coincidencias por prefijo (`>=` / `<` en Firestore) con laboratorio y nombre.
  - Sin resultados → aviso "Código no encontrado".
- Mismo buscador reutilizable en `/inventory` (busca dentro del lab por nombre **o** código).
- Es posible hoy mismo: la colección ya es plana y los datos se leen por Firestore directamente desde el cliente.

### 3.4 Campo "Código" en formularios
Archivos a modificar: `addItemCard.js`, `optionsItemCard.js`, `addLabCard.js`, `optionsLabCard.js`, y el modal de detalles en `pages/inventory.js`.
- Input **Código** + botón **"Generar"** (llama al generador) + botón **"Imprimir etiqueta"** (en edición/detalle).
- **Al crear** un item/lab: si el campo queda vacío → se genera solo (en `create-item.js` / `create-lab.js`, dentro de la transacción del contador).
- Validación: no permitir duplicados (consulta previa + reintento si la transacción falla).

### 3.5 Generación masiva para los registros existentes
- Botón de admin **"Generar códigos faltantes"** en la pantalla de inicio:
  1. Lee todos los items (y labs) sin `codigo`.
  2. Los ordena (por lab y nombre) y les asigna códigos consecutivos con `writeBatch` (máx. 500 por lote), actualizando el contador al final.
  3. Muestra resumen ("Se asignaron 214 códigos") y ofrece **imprimir todas las etiquetas** en cola.
- Se puede ejecutar varias veces sin riesgo (solo toca registros sin código).

### 3.6 Etiqueta a imprimir
Contenido, de arriba a abajo (tamaño final según el rollo, ver preguntas):
```
┌───────────────────────────┐
│  Lab: Redes 1  (pequeño)  │
│  Router Cisco 2901        │
│  ||||| |||| ||||| |||||   │  ← Code 128
│       INV-000123          │  ← número legible (para búsqueda manual)
└───────────────────────────┘
```
- Barcode con **JsBarcode** (SVG/canvas), con `displayValue: true` o texto aparte en fuente grande.
- Zona de silencio mínima a los lados y altura de barras suficiente para escáner (~10–12 mm).

### 3.7 Impresión en la impresora térmica
Impresora de la foto: **térmica de escritorio de 4 pulgadas**, LEDs POWER/ERROR y botón FEED, con etiqueta de "Paper Calibration" (típica de las compatibles con Zebra/TSC tipo Xprinter/HPRT/Munbyn). **No se ve marca/modelo ni si habla ZPL, TSPL o EPL** — esto hay que confirmarlo (ver §7).

Se propone una **capa de abstracción** (equivale al recurso `print_barcode_label` / `thermal_label_printer` que mencionaste) para no atar la app a un método:

```ts
// lib/printing/printLabel.js
printLabel({ codigo, titulo, subtitulo, copias })  // → Promise
```

Estrategias, de menos a más compleja:

| Opción | Cómo funciona | Pros | Contras |
|---|---|---|---|
| **A. Impresión del navegador (recomendada para Fase 1)** | Se renderiza la etiqueta en una vista con CSS `@page { size: 50mm 30mm; margin:0 }` y `window.print()`. Usa el **driver de Windows** de la impresora | Cero software extra, funciona ya, el barcode se imprime como imagen | Aparece el diálogo de impresión (se evita con Chrome `--kiosk-printing`); hay que fijar el tamaño de papel una vez |
| **B. QZ Tray + ZPL/TSPL** | Programa local que recibe comandos crudos desde la web | Impresión **silenciosa**, rápida, texto/barcode nativos de la impresora, ideal para lote | Instalar QZ Tray en el PC; sin certificado muestra un aviso de confianza; hay que saber el lenguaje de la impresora |
| **C. WebUSB** | La web habla directo con la impresora por USB | Sin software | Hay que cambiar el driver con Zadig, frágil, solo Chrome/Edge |
| **D. Mini servicio local (Node)** | Servicio en el PC de la impresora que recibe trabajos por HTTP | Control total | Más mantenimiento |

**Recomendación:** empezar con **A** (rápido y robusto) y dejar la interfaz `printLabel` lista para cambiar a **B** si quieren impresión silenciosa/masiva. Para imprimir las ~cientos de etiquetas de la carga inicial, A funciona con una página que contiene N etiquetas (una por página).

> Importante: la app se usa desde un navegador, así que **la impresión solo funcionará desde el PC al que está conectada la impresora** (o uno con ella compartida en red).

---

## 4. Plan de implementación por fases

### Fase 0 — Preparación (½ día)
- [ ] Resolver las preguntas de §7 (modelo de impresora, tamaño de etiqueta, escáner, cantidad por código).
- [ ] Confirmar/ajustar **reglas de Firestore** (§8).
- [ ] Hacer un respaldo: usar *Exportar todo* a Excel antes de modificar datos.

### Fase 1 — Núcleo de códigos (1–1.5 días)
- [ ] `lib/codes/normalize.js` — `normalizeText()` único + `isCodeLike()`.
- [ ] `components/firebase/generate-code.js` — transacción sobre `counters/{items|labs}`, devuelve `INV-000123`.
- [ ] `components/firebase/find-by-code.js` — búsqueda exacta y por prefijo.
- [ ] Modificar `create-item.js` / `create-lab.js` para autogenerar `codigo` si viene vacío y validar unicidad.
- [ ] Campo **Código** + botón **Generar** en los 4 formularios y en el modal de detalles (solo lectura para no-admin).
- [ ] Agregar columna **Código** a los exports de Excel.
- [ ] Corregir hallazgos 2, 4, 5 de §1 en los archivos tocados.

### Fase 2 — Buscador general (1 día)
- [ ] Extender `SearchAppBar` (o crear `CodeSearchBar`) con: `Enter`, `autoFocus`, devolver foco, modo código vs nombre.
- [ ] En `pages/index.js`: búsqueda por código → redirige a `/inventory?id=…&item=…`.
- [ ] En `pages/inventory.js`: leer `item` del query y abrir el modal de detalles de ese equipo (y hacer scroll/resaltar la tarjeta).
- [ ] Lista de coincidencias para códigos parciales.

### Fase 3 — Etiquetas e impresión (1–1.5 días)
- [ ] Instalar `jsbarcode`.
- [ ] `components/labels/LabelPreview.js` — vista previa de la etiqueta (barcode + número + nombre).
- [ ] `lib/printing/printLabel.js` — estrategia A (CSS `@page` + `window.print()`).
- [ ] Botón **Imprimir etiqueta** en detalle/edición de item y lab; campo "copias".
- [ ] Prueba física con la impresora: calibrar (botón FEED), ajustar tamaño/densidad y verificar que el escáner lee la etiqueta.

### Fase 4 — Carga masiva de existentes (½–1 día)
- [ ] Botón admin **"Generar códigos faltantes"** (batch + resumen).
- [ ] Página/vista **"Imprimir etiquetas"** con selección por laboratorio y por rango; imprime todas las de un lab en una tirada.
- [ ] Corrida real en producción con respaldo previo.

### Fase 5 (opcional) — Impresión silenciosa
- [ ] Estrategia B con QZ Tray + ZPL/TSPL según el lenguaje de la impresora.

**Estimación total:** ~4 a 5 días de trabajo (Fases 1–4), sin contar pruebas físicas con la impresora.

---

## 5. Archivos que se tocarían / crearían

| Acción | Archivo |
|---|---|
| Crear | `lib/codes/normalize.js`, `components/firebase/generate-code.js`, `components/firebase/find-by-code.js`, `components/firebase/backfill-codes.js`, `components/labels/LabelPreview.js`, `components/labels/PrintLabelButton.js`, `lib/printing/printLabel.js`, `pages/etiquetas.js` |
| Modificar | `pages/index.js`, `pages/inventory.js`, `components/searchBar.js`, `components/addItemCard.js`, `components/optionsItemCard.js`, `components/addLabCard.js`, `components/optionsLabCard.js`, `components/firebase/create-item.js`, `components/firebase/create-lab.js`, `components/exportData/export.js`, `package.json` |

---

## 6. Criterios de aceptación
1. Escanear una etiqueta en la pantalla de laboratorios abre el equipo correcto en < 2 s.
2. Escribir manualmente `INV-000123` (o solo `123`) hace lo mismo.
3. Crear un item/lab nuevo le asigna código sin intervención; nunca hay códigos duplicados.
4. Los registros existentes quedan todos con código tras la carga masiva.
5. La etiqueta impresa muestra barcode + número, y el escáner la lee en el primer intento.
6. Usuarios no admin pueden buscar pero no generar, editar ni imprimir en masa.

---

## 7. Preguntas pendientes (necesito tu respuesta para cerrar el plan)
1. **Modelo exacto de la impresora** (suele estar en una etiqueta atrás/abajo) y si la usan por **USB** o red. Con eso confirmo si habla ZPL, TSPL o EPL y busco el driver.
2. **Tamaño del rollo de etiquetas** (ej. 50×30 mm, 40×25 mm, 100×50 mm) — define el diseño.
3. **Escáner**: ¿es de pistola USB (como el de la foto, junto al teclado)? ¿Agrega `Enter` al final? Lo probamos en un bloc de notas.
4. **Cantidad vs código**: si un registro dice `cantidad: 10` (ej. 10 microscopios), ¿lleva **un solo código** para todo el registro o **un código por unidad**? Lo segundo exige dividir el registro. *Recomiendo un código por registro para suministros, y por unidad solo para equipos importantes.*
5. **Laboratorios**: ¿también llevan código/etiqueta, o solo los equipos/productos?
6. **Formato del código**: ¿te sirve `INV-000123` o ya tienen un esquema institucional (activo fijo, etc.) que deba respetarse?
7. ¿Quién va a imprimir (¿solo un PC con la impresora o varios)? Determina si basta la Fase 3-A o conviene QZ Tray.

---

## 8. Riesgos y consideraciones
- **Reglas de Firestore**: `counters/*` y la escritura de `codigo` deben permitirse **solo a `role == 'admin'`**; los demás, lectura. Verificar que el invitado no pueda escribir.
- **Unicidad**: se garantiza con transacción sobre el contador + chequeo previo; los códigos manuales requieren validación explícita.
- **Carga masiva**: lotes de 500 escrituras; hacer respaldo (Excel) antes.
- **Escáner en otra distribución de teclado** puede cambiar caracteres como `-` → probar en la fase 3; si falla, usar códigos solo numéricos o configurar el escáner.
- **Calibración de la impresora** (sticker visible en la foto indica proceso con botón FEED 1–4 s al cambiar de rollo): documentarlo para quien la use.
- **Credenciales del invitado** en el código (ver §1.1).
- **Impresión depende del PC local**; la app no puede imprimir desde un celular sin un servicio intermedio.

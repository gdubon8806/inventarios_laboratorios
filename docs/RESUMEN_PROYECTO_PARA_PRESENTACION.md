# Inventario de Laboratorios CEUTEC — Resumen general para presentación

> Documento pensado para entregarse a una IA (o a una persona) que genere la presentación de **lo que tenemos** y **lo que falta**.
> Fecha: 2026-11-11 · Estado: sistema actual en uso + maqueta visual de la búsqueda por código. **El código de la aplicación no se ha modificado.**

---

## 1. En una frase

Aplicación web para que coordinación consulte y administre el inventario de equipos, herramientas, mobiliario y suministros de los laboratorios de CEUTEC. Lo siguiente es **identificar cada equipo con un código de barras**, encontrarlo en segundos escaneándolo y poder **imprimir su etiqueta**.

---

## 2. Cómo funciona hoy

### Tecnología
| Capa | Tecnología |
|---|---|
| Aplicación | Next.js + React, interfaz con MUI |
| Base de datos | Firebase Firestore (laboratorios, items, comentarios) |
| Imágenes | Firebase Storage |
| Acceso | Firebase Auth (correo/contraseña) con rol `admin`; el resto, solo lectura |
| Exportación | Excel (por laboratorio o completo) |

### Pantallas
1. **Inicio (`/`)**: inicio de sesión (con botón *Ingresar como invitado*) y lista de laboratorios en tarjetas. Buscador por **nombre de laboratorio**. Los administradores pueden agregar laboratorios y *Exportar todo* a Excel.
2. **Inventario (`/inventory?id=…`)**: equipos del laboratorio en tarjetas, con buscador por nombre y filtro por tipo (Suministro, Herramienta, Mobiliario, Equipo). Detalle en modal; los administradores agregan, editan, eliminan, comentan y exportan.

### Datos de cada equipo
Equipo, marca, modelo, ubicación, columna de localización, tipo, cantidad, imagen, observaciones y laboratorio al que pertenece.

### Limitación principal hoy
**No existe un identificador único por equipo.** Para encontrar algo hay que saber en qué laboratorio está y buscarlo por nombre.

---

## 3. En qué ayuda al equipo de coordinación

| Necesidad | Hoy | Con códigos de barras |
|---|---|---|
| Encontrar un equipo | Entrar al laboratorio correcto y buscar por nombre | Escanear o escribir el código y llegar directo, sin importar el laboratorio |
| Saber qué es y dónde está | Revisar tarjetas | Un escaneo abre el detalle (ubicación, estado, observaciones) |
| Evitar duplicados y confusiones de nombres | Dos equipos "Router" se confunden | Cada uno tiene su código único |
| Inventarios físicos / auditorías | Lista en Excel, comparación manual | Escanear equipo por equipo y verificar contra el sistema |
| Etiquetar equipos | No hay etiquetas | Etiqueta con código de barras y número legible |
| Reportes | Excel sin identificador | Excel con columna **Código** |

Beneficios resumidos: menos tiempo de búsqueda, menos errores, control por equipo, base para auditorías y préstamos futuros.

---

## 4. Qué se está construyendo (visión)

1. **Campo "Código"** en cada equipo (y opcionalmente en cada laboratorio).
2. **Buscador por código**: escribir o escanear (la pistola USB funciona como un teclado que envía Enter).
3. **Generador de código**: manual para los registros existentes y automático para los nuevos (formato propuesto `INV-000123`, simbología Code 128).
4. **Etiquetas imprimibles** con código de barras + número legible, en la impresora térmica de 4".

Detalle técnico completo: ver `ANALISIS_Y_PLAN_CODIGOS_BARRAS.md` (en la raíz del repo).

---

## 5. Qué ya existe (entregable visual)

**Maqueta de la pantalla de búsqueda** en `docs/maqueta-busqueda/index.html` (se abre con doble clic; requiere internet para cargar dos librerías):

- Cuadro **"Buscar por código"** con botón **Buscar código** (acepta Enter, como lo haría el escáner).
- Resultado de ejemplo con equipo, laboratorio, ubicación y etiquetas.
- Botón **Generar PDF de etiqueta** (50×30 mm, código de barras Code 128 + número). Descarga un PDF real.
- Códigos de ejemplo para probar: `INV-000123`, `INV-000045`, `INV-000207`.
- Captura de referencia: `docs/maqueta-busqueda/captura.png`.

> Es una **maqueta independiente**: usa datos de ejemplo, no se conecta a Firestore y no forma parte de la aplicación.

---

## 6. Atajos rápidos tomados en la maqueta vs. lo que debe cambiar para que funcione de verdad

| # | Atajo rápido en la maqueta | Cambio necesario en la aplicación real |
|---|---|---|
| 1 | Los equipos son datos fijos dentro del HTML | Buscar en Firestore: `where('codigo','==',X)` sobre la colección plana `items` |
| 2 | Los códigos de ejemplo están escritos a mano | Generador con contador en transacción (`counters/items`) para que nunca se repitan |
| 3 | El campo Código es solo un cuadro de texto | Campo `codigo` guardado en el item, editable, con validación de unicidad |
| 4 | Se genera el PDF con la librería jsPDF desde un CDN | Instalar `jsbarcode` (y `jspdf` si se mantiene el PDF) como dependencias del proyecto, sin CDN |
| 5 | El PDF se descarga y se imprime a mano | Etiqueta con CSS `@page` + `window.print()` usando el driver de la impresora; luego, impresión silenciosa (QZ Tray + ZPL/TSPL) si se necesita |
| 6 | Tamaño de etiqueta fijo 50×30 mm | Confirmar tamaño real del rollo y modelo de impresora |
| 7 | "Ver detalle" solo muestra un aviso | Navegar a `/inventory?id=<lab>&item=<id>` y abrir el modal de detalle |
| 8 | Un único cuadro de búsqueda de código separado del buscador de laboratorios | Unificar: si el texto parece código busca por código, si no filtra por nombre |
| 9 | Código no validado por formato | `isCodeLike()` y `normalizeText()` compartidos |
| 10 | Sin permisos | Solo `admin` genera/edita/imprime en masa; los demás buscan y consultan (reglas de Firestore) |

### Verificación de que no se afectó lo funcional
- Se agregaron únicamente archivos nuevos dentro de `docs/` y documentación en la raíz; también `.engram/` en `.gitignore`.
- No se tocaron `pages/`, `components/`, `styles/`, `package.json` ni la configuración de Firebase, por lo que el comportamiento de la aplicación es idéntico al anterior.

---

## 7. Plan de mejora por fases

| Fase | Contenido | Esfuerzo estimado |
|---|---|---|
| 0 | Resolver preguntas abiertas, revisar reglas de Firestore, respaldo (Exportar todo) | ½ día |
| 1 | Núcleo de códigos: campo, generador, validación de unicidad, columna en Excel | 1–1,5 días |
| 2 | Buscador por código en inicio e inventario; abrir detalle automáticamente | 1 día |
| 3 | Etiquetas e impresión (vista previa, imprimir desde el navegador, prueba con la impresora) | 1–1,5 días |
| 4 | Carga masiva: "Generar códigos faltantes" + impresión de etiquetas por laboratorio | ½–1 día |
| 5 (opcional) | Impresión silenciosa con QZ Tray | según necesidad |

Total estimado: **4 a 5 días** (Fases 1–4), sin contar pruebas físicas con la impresora.

---

## 8. Lo que falta (resumen para la presentación)

**Hecho**
- Análisis del sistema actual y plan técnico completo.
- Maqueta visual de la pantalla de búsqueda con generación rápida de PDF.

**Falta**
- Implementar las Fases 1 a 4 (campo, generador, buscador real, etiquetas, carga masiva).
- Definir con coordinación las decisiones abiertas (sección 9).
- Prueba física con la impresora térmica y el escáner.
- Corregir hallazgos técnicos (sección 10).

---

## 9. Decisiones pendientes con coordinación
1. Modelo exacto de la impresora y si se usa por USB o red.
2. Tamaño del rollo de etiquetas.
3. Escáner: ¿pistola USB? ¿envía Enter al final?
4. Un código por registro, o un código por unidad cuando `cantidad` > 1.
5. ¿Los laboratorios también llevan código?
6. ¿Formato `INV-000123` o un esquema institucional (activo fijo)?
7. ¿Quién imprime? ¿Un solo PC o varios?

## 10. Riesgos y deuda técnica detectados
- Credenciales del usuario invitado en texto plano dentro del código (mover a variable de entorno y confirmar que solo lee).
- Las reglas de Firestore no están en el repositorio; hay que revisarlas en la consola.
- Al filtrar en `pages/inventory.js` se modifica el estado y los nombres quedan en minúscula.
- Lógica de "quitar tildes" repetida tres veces.
- `readLab()` puede devolver `undefined` ante un error.
- Falta `await` en `updateItem` dentro de `optionsItemCard.js`.
- La impresión depende del PC que tenga conectada la impresora.
- Dependencias residuales (`@auth0/nextjs-auth0`, `@vercel/postgres`, `@vercel/blob`).

---

## 11. Archivos de referencia en el repositorio
- `ANALISIS_Y_PLAN_CODIGOS_BARRAS.md` — análisis y plan técnico detallado.
- `docs/maqueta-busqueda/index.html` — maqueta visual interactiva.
- `docs/maqueta-busqueda/captura.png` — captura de la maqueta.
- `docs/RESUMEN_PROYECTO_PARA_PRESENTACION.md` — este documento.

# Validación de cambios y hallazgos — Inventarios de laboratorios

- **Fecha:** 2026-11-24
- **Elaborado por:** Claude (asistente de programación), a pedido de Osbin Salgado
- **Rama:** `feat/mejoras-movil-demo` (creada desde `main`, commit `3a5b85b` del 2026-11-23)
- **Estado:** Borrador. Los cambios están en el equipo local, **sin commit y sin desplegar**.
- **Para qué sirve este documento:** (1) listar lo que hay que validar para confirmar que nada se rompió, (2) dejar por escrito lo que se descubrió sobre los laboratorios que aparecían con 0 registros, (3) dejar claro qué no se pudo comprobar.

> Los nombres de archivos, pantallas internas y reglas técnicas están solo en el **Anexo A**.

---

## 1. Resumen

Se hicieron cinco grupos de cambios:

1. **Rediseño de pantallas** para celular y computadora (encabezado, tarjetas, detalle, búsqueda, colores y formas).
2. **Cambios de funcionamiento:** reportes con comentario mínimo de 20 caracteres y estado "En revisión"; marca y modelo por unidad; editar todo desde una sola pantalla; agregar cantidad con contador; exportación con más datos por unidad.
3. **Herramientas nuevas:** pantalla de diagnóstico de datos y un **modo demo** con datos ficticios para probar sin conectarse a producción.
4. **Corrección** de botones que se veían en blanco.
5. **Impresión de etiquetas** preparada para la impresora térmica **Vortek DIR-EB58III** (rollo de hasta 4", 110 mm de ancho, 100 mm de impresión efectiva), con posibilidad de usar otra impresora y cambiar el tamaño (ver 2.4 y los casos CP-14 a CP-16).

**Riesgo global: Medio.** La mayor parte es de pantalla. Lo que toca datos reales es: las reglas de seguridad de la base de datos, el nuevo contador de cantidad, la edición de unidades (marca y modelo) y los reportes.

**Pruebas hechas (2026-11-24):** 129 pruebas automáticas en verde; la versión de producción compila sin errores; el recorrido completo se probó en el modo demo con datos ficticios, en celular y computadora. **No se probó contra la base de datos real.**

---

## 2. Qué validar (por nivel de riesgo)

### 2.1 Riesgo alto o medio: tocan datos o reglas

| # | Cambio | Qué podría romperse |
|---|--------|---------------------|
| V-01 | **Reglas de seguridad de la base de datos** (reportes): ahora aceptan un campo adicional opcional y exigen comentario de al menos 20 caracteres | Si no se despliegan, un reporte con detalle adicional será rechazado. Si se despliegan mal, podrían bloquear lecturas o escrituras. **Esas reglas no se probaron en el emulador de Firebase.** |
| V-02 | **Contador de cantidad** (en modo editar): agregar unidades con sus datos, o sumar/restar en insumos | Crea códigos nuevos; si falla a la mitad podrían quedar unidades sin sus datos. El contador de códigos es compartido por todo el sistema. |
| V-03 | **Marca y modelo por unidad**; la tarjeta del registro muestra la marca solo si es igual en todas | La marca del registro se recalcula cada vez que se edita una unidad. Un registro podría mostrar la marca vacía si las unidades difieren (es lo esperado). |
| V-04 | **Editar datos generales**: ya no guarda marca, modelo, tipo ni cantidad (excepto insumos o registros con datos incongruentes) | Si alguien esperaba editar la marca desde la pantalla general, ya no puede. No debería borrar datos existentes. |
| V-05 | **Reportes**: mínimo 20 caracteres, campo opcional, estado "En revisión" con comentario interno solo para admin | Reportes viejos (de menos de 20 caracteres) siguen existiendo; solo se exige a los nuevos. El estado nuevo cuenta como reporte abierto. |
| V-06 | **Exportar a Excel**: la hoja de unidades trae 6 columnas informativas más (tipo, marca, modelo, ubicación, columna, cantidad del registro) | Un Excel exportado ahora y vuelto a importar: las columnas nuevas deben ignorarse. **No se probó importar un archivo con estas columnas contra la base real.** |
| V-07 | **Pantalla principal lee todos los registros una sola vez** (para conteos y búsqueda global) | Con muchos registros puede tardar más al abrir. Antes los conteos no cargaban sin avisar si fallaba; ahora sale un aviso rojo. |

### 2.2 Riesgo bajo: solo pantalla

- Encabezado fijo; en celular solo íconos y en una fila. El invitado solo ve Atrás y Cerrar sesión.
- Tarjetas de laboratorio y de registro nuevas (toda la tarjeta del laboratorio entra al laboratorio).
- Detalle del registro en modo "solo ver" y modo "editar".
- Buscador general (inicio) y por laboratorio, ahora en todos los campos; cajón de búsqueda por código con lector USB en computadora y selector de tipo en celular.
- Carga centrada y capa de carga al exportar.
- Colores, formas y tipografía nuevos; imágenes más altas.

### 2.4 Impresión de etiquetas (impresora térmica directa)

| # | Cambio | Qué podría romperse |
|---|--------|---------------------|
| V-08 | Ahora se elige la **impresora** (Vortek DIR-EB58III por defecto u "Otra impresora") y el **tamaño** de la etiqueta (100×50 por defecto; también 100×30, 100×70, 80×50, 60×40, 50×30, 40×25 o personalizado) | Si la etiqueta física no mide lo mismo que el tamaño elegido, el código puede cortarse o salir descentrado |
| V-09 | Con la Vortek la **zona efectiva es de 100 mm**: una etiqueta más ancha se centra en esa zona; más ancha que el rollo (110 mm) da error | Una etiqueta de 110 mm quedará con 5 mm en blanco a cada lado (es lo esperado) |
| V-10 | El texto va en **negro puro** (la térmica directa no imprime grises) y los textos crecen en etiquetas grandes | Las etiquetas de 50×30 deben verse igual que antes |
| V-11 | Las barras se ajustan a la **resolución** (203 dpi por defecto, **dato por confirmar** con la ficha del equipo; se puede pasar a 300 dpi) | Con una resolución equivocada las barras pueden salir borrosas y no leerse |

Lo elegido se guarda en el navegador de cada equipo.

### 2.3 Cosas que ya no existen (verificar que no se echen de menos)

- Botón "Abrir" de la tarjeta del laboratorio.
- Opciones del registro: ya no están "Editar datos", "Unidades y reportes" ni "Cambiar cantidad". Ahora son **Editar**, **Cambiar tipo** y **Dar de baja**.
- El panel de consulta fijo a la derecha: ahora es un cajón que se abre con un botón.

---

## 3. Riesgos y casos de prueba

Cada caso debe terminar con evidencia (captura de pantalla o registro). Se recomienda probar primero en el modo demo y luego en un ambiente de prueba conectado a datos de prueba, **nunca primero en producción**.

| Caso | Qué se prueba | Pasos (como los haría el usuario) | Resultado esperado | Evidencia | Riesgo |
|------|---------------|-----------------------------------|--------------------|-----------|--------|
| CP-01 | Reporte con comentario corto | Reportar una unidad y escribir "No enciende" | El botón de enviar queda bloqueado y dice cuántos caracteres faltan | Captura | V-05 |
| CP-02 | Reporte válido con detalle | Escribir 25 caracteres + detalle opcional y enviar | El reporte aparece con código, fecha y estado "Abierto" | Captura del reporte y de la base | V-01, V-05 |
| CP-03 | Reporte sin detalle opcional | Enviar solo el comentario obligatorio | Se envía bien (funciona incluso con las reglas anteriores) | Captura | V-01 |
| CP-04 | En revisión (admin) | Modo editar → Revisar → "Poner en revisión" con comentario interno | Estado "En revisión"; el invitado no ve el comentario interno | Captura admin e invitado | V-05 |
| CP-05 | Agregar unidades | Editar un registro con 15 unidades → Agregar 2 → llenar serie → confirmar | Cantidad pasa a 17; 2 códigos nuevos pendientes de imprimir; la serie queda en la unidad correcta | Captura + lista de códigos | V-02 |
| CP-06 | Contador pasa el límite | Agregar unidades que superen el máximo permitido para el tipo | Pide confirmación antes de crear | Captura | V-02 |
| CP-07 | Quitar cantidad en un insumo | Insumo → Cambiar cantidad → Quitar 1 con motivo | Cantidad baja en 1 | Captura | V-02 |
| CP-08 | Marca por unidad | Cambiar la marca de una sola unidad | La tarjeta del registro deja de mostrar marca; al igualarlas vuelve a mostrarla | Captura antes/después | V-03 |
| CP-09 | Editar datos generales | Cambiar nombre, ubicación y columna; guardar | Se guardan; marca, modelo y tipo no cambian | Captura | V-04 |
| CP-10 | Cambiar tipo | Opciones → Cambiar tipo | Aviso amarillo con detalle (código nuevo, etiquetas a reimprimir); exige escribir CAMBIAR | Captura | V-02 |
| CP-11 | Exportar | Exportar un laboratorio y todos | Aparece la capa de carga y se descarga; la hoja de unidades trae las columnas nuevas y una fila por unidad | Archivo Excel | V-06 |
| CN-01 | Importar un Excel recién exportado | Exportar y volver a importar sin cambios | Informa "sin cambios" (las columnas nuevas se ignoran) | Captura del informe | V-06 |
| CN-02 | Invitado no edita | Entrar como invitado | No ve Opciones ni Exportar; puede ver y reportar | Captura | V-04 |
| CN-03 | Invitado no ve soluciones internas | Revisar un reporte resuelto como invitado | No aparece la solución ni el comentario interno | Captura | V-05 |
| CN-04 | Lectura con error | Simular falta de permiso en la base de prueba | La pantalla principal muestra el aviso rojo (en el laboratorio individual aún no, ver OB-01) | Captura | V-07 |
| CP-12 | Móvil | Revisar inicio, laboratorio, detalle y cajón de código en un teléfono real | Sin textos cortados; botones solo con ícono en una fila | Capturas | Pantalla |
| CP-14 | Imprimir en la Vortek | Elegir Vortek y 100×50; imprimir una etiqueta de prueba con borde (página de calibración) | Sale completa, sin cortarse ni correrse; el texto es negro y nítido | Foto de la etiqueta | V-08, V-10 |
| CP-15 | Escanear la etiqueta impresa | Escanear con el lector USB las etiquetas de la prueba | Se lee a la primera | Captura de la búsqueda por código | V-11 |
| CP-16 | Otra impresora u otro tamaño | Elegir "Otra impresora" o "Personalizado" y escribir otras medidas | La vista previa y el papel cambian al nuevo tamaño | Captura | V-08 |
| CN-05 | Etiqueta más ancha que el rollo | Escribir 120 mm de ancho con la Vortek | Aviso de error: supera el rollo de 110 mm | Captura | V-09 |
| CP-13 | Lector USB | Escanear una etiqueta en computadora | El código entra completo y se busca solo | Captura | Pantalla |

---

## 4. Descubrimientos: ¿por qué algunos laboratorios aparecían con 0 registros?

### 4.1 Conclusión honesta

**No se pudo confirmar la causa.** No se tuvo acceso a los datos reales. Tampoco se encontró en el código ningún cambio que **borre o esconda registros por sí mismo**.

Lo que sí se confirmó, por el usuario: **los registros de esos laboratorios no están en la Papelera** y **no se hizo ninguna importación de Excel** (la importación sí podía dar de baja registros ausentes del archivo).

### 4.2 Qué se revisó

Se comparó cómo se leían y se creaban los datos antes y después de las funciones nuevas del 2026-11-21 al 23:

- Los laboratorios y registros que no tienen el dato "activo" se siguen tratando como activos.
- La consulta de registros por laboratorio es la misma que antes.
- El proceso de migración de datos solo agrega campos; no cambia a qué laboratorio pertenece cada registro ni oculta nada.

### 4.3 Causas posibles, de más a menos probable

| # | Posible causa | Por qué | Cómo comprobarla |
|---|---------------|---------|------------------|
| H-1 | **Un error de lectura se muestra como "0 registros"** | Las pantallas devolvían una lista vacía ante cualquier error (por ejemplo falta de permiso o falla de red), sin avisar. Para el usuario es idéntico a "no hay registros". | Abrir el laboratorio con las herramientas del navegador y buscar errores rojos en la consola |
| H-2 | **Registros que apuntan a un laboratorio que ya no existe** | Si un laboratorio se recreó, sus registros conservan el identificador del anterior y no aparecen en ninguno. | Abrir la pantalla de diagnóstico (ver 4.4) |
| H-3 | **Reglas de seguridad desplegadas distintas a las que había** | El archivo de reglas del repositorio se escribió sin ver las reglas que tenía la consola y **no se probó en el emulador**. Podrían negar lecturas a algún tipo de usuario. | Comparar las reglas actuales de la consola con el archivo del repositorio |
| H-4 | **Otro proyecto o configuración en el despliegue de vista previa** | El 2026-11-23 se agregó un despliegue de vista previa. Si apunta a otra base, mostraría laboratorios distintos. | Comparar la configuración del despliegue con la de producción |
| H-5 | Registros dados de baja | Descartada por el usuario (no están en la Papelera). | — |

### 4.4 Qué se dejó para investigarlo

- **Pantalla de diagnóstico** (solo administrador, solo lectura): compara cada laboratorio con los registros que realmente existen y señala los registros "huérfanos" y los que la pantalla no muestra. En el modo demo detecta el caso de ejemplo (3 registros de Laboratorio de Redes que apuntan a un identificador viejo).
- **Aviso rojo en la pantalla principal** si la lectura de registros falla.

### 4.5 Qué falta

- Abrir el diagnóstico **en el sitio real** y revisar el resultado (**Por confirmar**).
- Que el laboratorio individual también avise cuando falla la lectura (OB-01).
- Si el diagnóstico encuentra huérfanos: preparar una reasignación **con respaldo previo** (no se hizo; sería un cambio sobre datos reales y requiere aprobación).

---

## 5. Cómo probar sin producción (modo demo)

1. Ejecutar `npm run dev:demo` y abrir `http://localhost:3100`.
2. Administrador: `admin@demo.local` / `admin123`. Invitado: botón "Ingresar como invitado".
3. Los datos son ficticios y se guardan solo en el navegador. Para volver al inicio se escribe `__demoReset()` en la consola del navegador.
4. El modo demo solo se activa con esa variable; la versión normal no cambia (la compilación de producción lo comprobó).

Limitación: el modo demo imita la base de datos; **no valida las reglas de seguridad reales ni los índices**.

---

## 6. Observaciones y riesgo residual

| # | Observación | Riesgo | Recomendación | Responsable |
|---|-------------|--------|---------------|-------------|
| OB-01 | La pantalla de un laboratorio individual sigue mostrando "No hay registros" si la lectura falla | Medio (puede repetir el síntoma de los "0") | Hacer que muestre el error como la pantalla principal | Desarrollo |
| OB-02 | Reglas de seguridad sin probar en emulador | Alto | Probarlas en el emulador y compararlas con las de la consola antes de desplegar | Desarrollo |
| OB-03 | Importar y Papelera conservan el diseño anterior y no se revisaron en celular tras los cambios (la Papelera se vio aceptable) | Bajo | Revisar y unificar | Desarrollo |
| OB-04 | No se probó importar un Excel con las columnas nuevas de unidades contra la base real | Medio | Ejecutar CN-01 en ambiente de prueba | Desarrollo |
| OB-05 | La cantidad ya no se escribe a mano y "Cambiar cantidad" desapareció | Bajo | Confirmar con quien opera que el contador cubre su necesidad | Dueño del proceso |
| OB-06 | Los cambios no tienen commit ni PR | Informativo | Hacer commit y PR cuando se apruebe | Desarrollo |
| OB-08 | No se conoce el **largo real** de las etiquetas adhesivas del rollo ni la **resolución** exacta de la Vortek DIR-EB58III. Se supuso 100×50 mm y 203 dpi | Medio | Medir la etiqueta, confirmar los dpi en la ficha del fabricante y dejar elegido el tamaño correcto | Dueño del proceso |
| OB-09 | La impresión sale por el diálogo de impresión del navegador: el sistema no puede saber si el papel salió, por eso siempre pregunta "¿salieron bien?" antes de marcar como impresa | Bajo | Mantener esa confirmación | Desarrollo |
| OB-07 | El modo demo y el tema visual agregan archivos nuevos al repositorio | Bajo | Decidir si el modo demo queda en el repositorio | Dueño del proceso |

---

## 7. Criterios de aceptación y salida

- Todos los casos CP y CN pasan en el ambiente de prueba, con evidencia archivada.
- Las reglas de seguridad probadas en emulador y comparadas con las de la consola.
- Resultado del diagnóstico del sitio real revisado y la causa de los "0" explicada o descartada.
- Sin defectos que bloqueen ver, reportar o exportar.
- Aprobación: dueño del proceso (Osbin Salgado).

---

## 8. Glosario

- **Base de datos (Firebase/Firestore):** donde se guardan laboratorios, registros, unidades y reportes.
- **Reglas de seguridad:** normas de la base de datos que dicen quién puede leer y escribir.
- **Emulador:** copia de prueba de la base de datos que corre en el equipo.
- **Unidad:** cada pieza física de un registro con su propio código (equipos, mobiliario y herramientas).
- **Insumo:** artículo consumible; lleva un solo código por registro.
- **Registro huérfano:** registro que apunta a un laboratorio que ya no existe.
- **Modo demo:** versión de prueba con datos ficticios que no toca producción.

---

## Anexo A. Referencias técnicas

**Rama y base:** `feat/mejoras-movil-demo`, desde `main` `3a5b85b`. Resumen del cambio: 40 archivos modificados y 11 nuevos (sin commit).

**Comandos:**
- Pruebas: `npm test` (129 en verde).
- Compilar: `npx next build` (compila; necesita las variables de Firebase, se usaron valores falsos solo para compilar).
- Demo: `npm run dev:demo` → `http://localhost:3100`.
- Dependencias: `npm ci` (la carpeta `node_modules` heredada de la rama anterior estaba desfasada).

**Reglas de seguridad:** `firestore.rules` — en `reportes`, la lista permitida de campos incluye `detalleAdicional`; `comentario` ≥ 20 y ≤ 1000 caracteres; `detalleAdicional` ≤ 500. Las reglas de `reportes/{id}/privado` (solución y comentario interno) siguen siendo solo admin. **Pendiente desplegar.**

**Datos nuevos o cambiados:**
- `reportes`: campo opcional `detalleAdicional`; estado `enRevision`; campos `revisadoPor`, `fechaRevision`; documento `reportes/{id}/privado/revision`.
- `items/{id}/unidades/{u}`: campos editables `marca`, `modelo`.
- `items/{id}`: `marca`, `modelo`, `marcaMixta`, `modeloMixto` se recalculan al editar una unidad.

**Impresión de etiquetas:** `lib/printing/printers.js` (nuevo: perfiles Vortek y Otra, resolución, zona efectiva), `lib/printing/labelLayout.js` (zona efectiva centrada, escala de textos, negro puro), `lib/printing/printLabels.js`, `components/labels/PrinterSettings.js` (nuevo), `PrintLabelsDialog.js`, `PrintCalibrationPage.js`, `LabelPreview.js` (también se corrigió la vista previa, que no escalaba el código de barras) y las pruebas `lib/printing/printers.test.mjs`.

**Archivos nuevos:** `styles/theme.js`, `components/layout/AppHeader.js`, `components/RecordCard.js`, `components/ItemDetail.js`, `components/RecordEditForm.js`, `components/AddUnitsPanel.js`, `components/ui/LoadingScreen.js`, `components/ui/GlobalBusy.js`, `pages/diagnostico.js`, `scripts/dev-demo.js`, carpeta `demo/`.

**Archivos principales modificados:** `pages/index.js`, `pages/inventory.js`, `pages/_app.js`, `components/laboratoryCard.js`, `components/optionsItemCard.js`, `components/optionsLabCard.js`, `components/UnitsTable.js`, `components/ReportsList.js`, `components/ReportModal.js`, `components/SidePanel.js`, `components/CodeSearch.js`, `components/StatsBox.js`, `components/searchBar.js`, `components/itemsFilterer.js`, `components/ChangeTypeDialog.js`, `components/firebase/read-lab-statuses.js`, `components/firebase/manage-units.js`, `components/firebase/create-report.js`, `components/firebase/resolve-report.js`, `components/firebase/read-reports.js`, `lib/codes/builders.js`, `lib/import/columns.js`, `lib/import/workbook.js`, `lib/inventory/stats.js`, `styles/global.css`, `tailwind.config.js`, `next.config.js`, `package.json`.

**Archivos que ya no se usan en pantalla (siguen en el código):** `components/QuantityDialogs.js` (solo se usa su diálogo de confirmación por cantidad alta).

**Hallazgo de estilos:** el reinicio de estilos de Tailwind dejaba transparentes los botones `contained` de MUI; se restablecieron los colores en `styles/global.css`. La ruta del archivo del cargador de imagen en `tailwind.config.js` estaba mal escrita y se corrigió.

**Modo demo:** `next.config.js` sustituye `firebase/*` por `demo/*` solo con `NEXT_PUBLIC_DEMO=1`; en el servidor hay que quitar `firebase/*` de `externals` para que el reemplazo funcione.

**Comparación para el diagnóstico (H-1 a H-4):** lecturas que devuelven vacío ante error: `components/firebase/read-item.js` (pantalla de laboratorio), `read-lab.js`; con aviso desde esta rama: `read-lab-statuses.js` (pantalla principal).

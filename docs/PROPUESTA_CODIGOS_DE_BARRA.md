# Propuesta: códigos de barra para el inventario de laboratorios

## El problema

Hoy los equipos **no tienen un código que los identifique**.

- Para encontrar un equipo hay que saber en qué laboratorio está y buscarlo por su nombre.
- Dos equipos con nombre parecido se confunden fácilmente.
- No hay forma rápida de verificar un equipo físico contra el sistema (inventarios, auditorías, préstamos).
- Los equipos no llevan ninguna etiqueta que los vincule con el registro.

## La solución

Darle a cada equipo un **código único**, mostrarlo como **código de barras** y como **número legible**, y poder buscarlo desde el buscador general.

1. **Código único por equipo** (por ejemplo `INV-000123`).
2. **Etiqueta** con el código de barras y, debajo, el número, para pegarla en el equipo.
3. **Búsqueda por código** desde la pantalla principal:
   - Con el escáner: se escanea la etiqueta y se abre el equipo.
   - A mano: si el escáner falla, se escribe el número y se obtiene el mismo resultado.
4. **Botón para generar el código** en PDF, listo para imprimir la etiqueta.

El diseño actual de la aplicación no cambia: solo se agrega una fila junto al buscador con el campo de código y sus botones.

## Cómo ayuda al equipo de coordinación

| Necesidad | Antes | Con códigos de barra |
|---|---|---|
| Encontrar un equipo | Buscar por nombre en cada laboratorio | Escribir o escanear el código y llegar directo |
| Distinguir equipos parecidos | Se confunden por el nombre | Cada uno tiene su código único |
| Verificar un equipo físico | Comparación manual con la lista | Un escaneo abre su registro |
| Identificar el equipo en sitio | Sin etiqueta | Etiqueta con código y número |

## Cómo se entrega

- **Primero:** se publica en la web el buscador por código y el botón que genera el código en PDF, sin cambiar nada de lo que ya funciona.
- **Después:** se pasa a la impresión de etiquetas en la impresora térmica, aunque el resto aún no esté completo.

## Qué ayuda a decidir (preguntas para coordinación)

1. Modelo de la impresora y tamaño del rollo de etiquetas.
2. Si el escáner es de pistola USB.
3. Un código por registro o uno por cada unidad cuando hay varias.
4. Si el formato `INV-000123` sirve o hay un esquema institucional que respetar.

## Ver cómo se ve

- Maqueta interactiva: `docs/maqueta-busqueda/index.html` (captura en `docs/maqueta-busqueda/captura.png`).
- Documento general para la presentación: `docs/RESUMEN_PROYECTO_PARA_PRESENTACION.md`.
- Plan técnico detallado: `ANALISIS_Y_PLAN_CODIGOS_BARRAS.md`.

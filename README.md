Inventario de laboratorios de CEUTEC SN SPS

## Configuración

1. Copia `.env.example` a `.env` y completa las variables (Firebase y usuario invitado).
2. `npm install` y `npm run dev`.

## Reglas e índices de Firestore

Las reglas viven en `firestore.rules` y los índices en `firestore.indexes.json` (se despliegan con
`firebase deploy --only firestore`, usando `firebase.json`). Antes de desplegar, revisa en la consola de
Firebase las reglas actuales: no estaban en el repositorio.

## Migración de datos (v3)

`scripts/migrate-v3.js` prepara los datos existentes (campo `activo`, `estadoCodigo`, cantidad numérica,
marcado de registros con datos incongruentes). Por defecto es un **dry-run** (no escribe nada):

```
set GOOGLE_APPLICATION_CREDENTIALS=ruta\a\serviceAccountKey.json
node scripts/migrate-v3.js            # solo muestra el informe
node scripts/migrate-v3.js --apply    # guarda respaldo JSON en backups/ y aplica los cambios
```

Requiere `firebase-admin` (ya está en las dependencias) y una cuenta de servicio con acceso a Firestore.

#!/usr/bin/env node
// Arranca la app en MODO DEMO (datos ficticios en memoria, sin Firebase real) en http://localhost:3100
//   npm run dev:demo
// Cuentas: admin@demo.local / admin123  ·  invitado@demo.local / invitado123 (o el botón "Ingresar como invitado").
// Los datos se guardan en el navegador; para volver a los datos iniciales abre la consola y ejecuta __demoReset().
const { spawn } = require('child_process');
const path = require('path');

const nextBin = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next');
const port = process.env.PORT || '3100';
const child = spawn(process.execPath, [nextBin, 'dev', '-p', port], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NEXT_PUBLIC_DEMO: '1',
    NEXT_PUBLIC_GUEST_EMAIL: 'invitado@demo.local',
    NEXT_PUBLIC_GUEST_PASSWORD: 'invitado123',
  },
});
child.on('exit', (code) => process.exit(code ?? 0));

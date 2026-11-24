// next.config.js
const path = require('path');

// MODO DEMO (npm run dev:demo): sustituye Firebase por una versión en memoria con datos ficticios,
// para probar toda la app sin las variables de entorno de producción. Ver demo/ y scripts/dev-demo.js.
const DEMO = process.env.NEXT_PUBLIC_DEMO === '1';

module.exports = {
  distDir: DEMO ? '.next-demo' : '.next',
  images: {
    domains: ['firebasestorage.googleapis.com'],
  },
  webpack(config, { isServer }) {
    if (DEMO) {
      // En el servidor Next trata los paquetes de node_modules como externos y se saltaría los alias:
      // aquí se excluye `firebase/*` de esa lista para que también se use la versión demo.
      if (isServer && Array.isArray(config.externals)) {
        config.externals = config.externals.map((ext) => (
          typeof ext === 'function'
            ? (data, cb) => (/^firebase(\/|$)/.test(data.request) ? cb() : ext(data, cb))
            : ext
        ));
      }
      const demo = (f) => path.resolve(__dirname, 'demo', f);
      Object.assign(config.resolve.alias, {
        'firebase/firestore': demo('firestore.js'),
        'firebase/auth': demo('auth.js'),
        'firebase/storage': demo('storage.js'),
        'firebase/app': demo('app.js'),
      });
    }
    return config;
  },
};

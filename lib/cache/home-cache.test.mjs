import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TTL_MS, _resetHomeCache, clearDirtyLabs, getHomeCache, invalidateHomeCache, markLabDirty, setHomeCache, updateHomeCache,
} from './home-cache.js';

const base = { isAdmin: true, labs: [{ id: 'L1' }], items: [{ id: 'i1', idLab: 'L1' }], incongruentes: {} };

test('sin caché o caducada -> null', () => {
  _resetHomeCache();
  assert.equal(getHomeCache({ isAdmin: true }), null);
  setHomeCache({ ...base, now: 1000 });
  assert.ok(getHomeCache({ isAdmin: true, now: 1000 + TTL_MS }));
  assert.equal(getHomeCache({ isAdmin: true, now: 1001 + TTL_MS }), null);
});

test('otro rol no reutiliza la caché', () => {
  _resetHomeCache();
  setHomeCache({ ...base, now: 0 });
  assert.equal(getHomeCache({ isAdmin: false, now: 1 }), null);
});

test('laboratorio sucio: se informa para releer solo ese y se limpia', () => {
  _resetHomeCache();
  setHomeCache({ ...base, now: 0 });
  markLabDirty('L1');
  assert.deepEqual(getHomeCache({ isAdmin: true, now: 1 }).dirtyLabs, ['L1']);
  clearDirtyLabs(['L1']);
  assert.deepEqual(getHomeCache({ isAdmin: true, now: 1 }).dirtyLabs, []);
});

test('invalidar todo obliga a una lectura completa; setHomeCache lo restablece', () => {
  _resetHomeCache();
  setHomeCache({ ...base, now: 0 });
  invalidateHomeCache();
  assert.equal(getHomeCache({ isAdmin: true, now: 1 }), null);
  setHomeCache({ ...base, now: 2 });
  assert.ok(getHomeCache({ isAdmin: true, now: 3 }));
});

test('updateHomeCache cambia el contenido sin reiniciar el reloj', () => {
  _resetHomeCache();
  setHomeCache({ ...base, now: 0 });
  updateHomeCache({ labs: [{ id: 'L2' }] });
  assert.deepEqual(getHomeCache({ isAdmin: true, now: 1 }).labs, [{ id: 'L2' }]);
  assert.equal(getHomeCache({ isAdmin: true, now: TTL_MS + 1 }), null);
});

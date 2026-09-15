const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRepository } = require('../src/repositories/repository.factory');
const { paginationContext, parsePagination } = require('../src/context/pagination.context');
const transport = () => import(pathToFileURL(path.resolve(__dirname, '../../frontend/src/services/transport.js')));

test('compresión HTTP y no-store: JSON comprimido sin habilitar caché clínica', async () => {
  const express = require('express'); const compression = require('compression');
  const app = express(); app.use(compression()); app.use(require('../src/middleware/availability.middleware'));
  app.get('/data', (_request, response) => response.json({ rows: Array(20).fill('contenido sintético de prueba'.repeat(10)) }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/data`, { headers: { 'Accept-Encoding': 'gzip' } });
    assert.equal(response.headers.get('content-encoding'), 'gzip'); assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal((await response.json()).rows.length, 20);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('PA-02: pagina en persistencia, limita el tamaño y mantiene consultas de validación completas', async () => {
  const rows = Array.from({ length: 61 }, (_, id) => ({ id: id + 1 }));
  const calls = [];
  const database = { paciente: {
    findMany: async (args) => { calls.push(args); return rows.slice(args?.skip || 0, args?.take ? (args.skip || 0) + args.take : undefined); },
    count: async () => rows.length
  } };
  const repository = createRepository(['paciente'], database);
  const scope = parsePagination({ page: '2', pageSize: '20' });
  await paginationContext.run(scope, async () => {
    assert.deepEqual((await repository.paciente.findPage({})).map((row) => row.id), rows.slice(20, 40).map((row) => row.id));
    assert.equal((await repository.paciente.findMany({})).length, 61);
  });
  assert.equal(calls[0].skip, 20); assert.equal(calls[0].take, 20);
  assert.equal(scope.results.paciente.total, 61);
  assert.equal(parsePagination({ pageSize: '200' }).pageSize, 50);
});
test('PA-03: cancelar una búsqueda no realiza reintentos', async () => {
  const { fetchWithPolicy } = await transport();
  const controller = new AbortController(); let calls = 0;
  const promise = fetchWithPolicy('http://test/search', { signal: controller.signal }, async (_url, init) => {
    calls++; return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  });
  controller.abort(); await assert.rejects(promise, { name: 'AbortError' }); assert.equal(calls, 1);
});
test('PA-06: POST, PATCH, PUT y DELETE nunca se repiten automáticamente', async () => {
  const { fetchWithPolicy } = await transport();
  for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
    let calls = 0;
    await assert.rejects(fetchWithPolicy('http://test/write', { method }, async () => { calls++; throw new Error('network'); }));
    assert.equal(calls, 1);
    calls = 0;
    assert.equal((await fetchWithPolicy('http://test/write', { method }, async () => { calls++; return new Response('{}', { status: 503 }); })).status, 503);
    assert.equal(calls, 1);
  }
});
test('lecturas se recuperan de errores transitorios, con un máximo de tres intentos', async () => {
  const { fetchWithPolicy } = await transport(); let calls = 0;
  const result = await fetchWithPolicy('http://test/read', {}, async () => new Response('{}', { status: ++calls < 3 ? 503 : 200 }));
  assert.equal(result.status, 200); assert.equal(calls, 3);
  calls = 0;
  assert.equal((await fetchWithPolicy('http://test/read', {}, async () => { calls++; return new Response('{}', { status: 401 }); })).status, 401);
  assert.equal(calls, 1);
});
test('PA-08: readiness devuelve fallo con PostgreSQL caído; liveness permanece independiente', async () => {
  const repository = require('../src/repositories/health.repository');
  const health = require('../src/services/health.service'); const previous = repository.checkConnection;
  try {
    repository.checkConnection = async () => { throw new Error('database down'); };
    assert.equal((await health.readiness()).status, 'unavailable'); assert.equal(health.liveness().status, 'ok');
    repository.checkConnection = async () => {};
    assert.equal((await health.readiness()).status, 'ok');
    const state = require('../src/config/availability'); state.draining = true;
    assert.equal((await health.readiness()).reason, 'draining'); state.draining = false;
  } finally { repository.checkConnection = previous; }
});

test('PA-04/05: borrador cifrado recuperable, autenticado y aislado por clínica y usuario', async () => {
  const entries = new Map();
  global.sessionStorage = new class {
    getItem(key) { return this[key] || null; }
    setItem(key, value) { this[key] = String(value); }
    removeItem(key) { delete this[key]; }
  }();
  global.indexedDB = { open() {
    const request = {};
    queueMicrotask(() => {
      request.result = { createObjectStore() {}, close() {}, transaction() {
        const tx = { objectStore() { return {
          get(key) { const read = {}; queueMicrotask(() => { read.result = entries.get(key); read.onsuccess(); }); return read; },
          put(value, key) { entries.set(key, value); queueMicrotask(() => tx.oncomplete?.()); },
          clear() { entries.clear(); queueMicrotask(() => tx.oncomplete?.()); }
        }; } }; return tx;
      } };
      request.onupgradeneeded?.(); request.onsuccess();
    }); return request;
  } };
  const drafts = await import(pathToFileURL(path.resolve(__dirname, '../../frontend/src/services/secure-drafts.js')));
  const scope = 'cumed:45:attention:5';
  const value = { diagnostico: 'Información clínica de prueba', pacienteId: 5 };
  await drafts.saveDraft(scope, value);
  const ciphertext = sessionStorage.getItem('medicalsys-draft:' + scope);
  assert.ok(!ciphertext.includes(value.diagnostico));
  assert.deepEqual(await drafts.loadDraft(scope), value);
  assert.equal([...entries.values()][0].key.extractable, false);
  sessionStorage.setItem('medicalsys-draft:otra:45:attention:5', ciphertext);
  assert.equal(await drafts.loadDraft('otra:45:attention:5'), null);
  const tampered = JSON.parse(ciphertext); tampered.data = tampered.data.slice(0, -8) + 'AAAAAAAA';
  sessionStorage.setItem('medicalsys-draft:' + scope, JSON.stringify(tampered));
  assert.equal(await drafts.loadDraft(scope), null);
  await drafts.saveDraft(scope, value); await drafts.clearDrafts();
  assert.equal(await drafts.loadDraft(scope), null);
});

test('PA-05: el service worker omite API, uploads y assets externos incluso con solicitud GET', async () => {
  const vm = require('node:vm');
  const { serviceWorkerSource } = await import(pathToFileURL(path.resolve(__dirname, '../../frontend/pwa-worker.mjs')));
  const source = serviceWorkerSource({ assets: ['/assets/app.js'], precache: ['/assets/app.js'], version: 'test' });
  const handlers = {};
  vm.runInNewContext(source, { URL, Set, self: { location: { origin: 'https://medicalsys.test' }, addEventListener: (event, callback) => { handlers[event] = callback; } } });
  for (const url of ['https://medicalsys.test/api/patients', 'https://medicalsys.test/uploads/expediente.pdf', 'https://external.test/file.js', 'https://medicalsys.test/assets/app.js?token=fake']) {
    let intercepted = false;
    handlers.fetch({ request: { method: 'GET', url }, respondWith() { intercepted = true; } });
    assert.equal(intercepted, false);
  }
});

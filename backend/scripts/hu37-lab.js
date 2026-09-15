// Local verification harness. Production uses the HAProxy/TLS configuration.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { gzipSync } = require('node:zlib');
const backend = path.resolve(__dirname, '..');
const dist = path.resolve(backend, '../frontend/dist');
const ports = [Number(process.env.LAB_API1_PORT || 3011), Number(process.env.LAB_API2_PORT || 3012)];
const port = Number(process.env.LAB_PORT || 5187);
const children = [];
let sequence = 0;
let bandwidthSlot = Date.now();
const rate = Number(process.env.LAB_KBPS || 0) * 1000 / 8;
const latency = Number(process.env.LAB_LATENCY_MS || 0);
function startInstance(index) {
  const child = spawn(process.execPath, ['src/server.js'], { cwd: backend, windowsHide: true,
    env: { ...process.env, PORT: String(ports[index]), NODE_ENV: 'development', WHATSAPP_PROVIDER: 'NONE', WHATSAPP_START_WORKER_IN_API: 'false' },
    stdio: ['ignore', 'ignore', 'pipe'] });
  child.stderr.resume();
  child.on('error', (error) => console.error(JSON.stringify({ event: 'lab.instance.error', code: error.code })));
  children[index] = child;
}
async function ready(index) {
  try { return (await fetch(`http://localhost:${ports[index]}/api/ready`, { signal: AbortSignal.timeout(2500) })).ok; }
  catch (_) { return false; }
}
async function waitReady(index) {
  for (let attempt = 0; attempt < 40; attempt++) { if (await ready(index)) return; await new Promise((resolve) => setTimeout(resolve, 250)); }
  throw new Error('Instancia de prueba no disponible. Compruebe PostgreSQL y puertos libres.');
}
function send(response, buffer) {
  if (!rate) { response.end(buffer); return; }
  for (let offset = 0; offset < buffer.length; offset += 4096) {
    const chunk = buffer.subarray(offset, offset + 4096);
    bandwidthSlot = Math.max(bandwidthSlot, Date.now() + latency) + chunk.length / rate * 1000;
    const last = offset + 4096 >= buffer.length;
    setTimeout(() => { if (!response.destroyed) { response.write(chunk); if (last) response.end(); } }, bandwidthSlot - Date.now());
  }
  if (!buffer.length) response.end();
}
const proxy = http.createServer(async (request, response) => {
  try {
    if (request.url.startsWith('/api/')) {
      const candidates = [sequence++ % 2, sequence % 2];
      let selected;
      for (const candidate of candidates) if (await ready(candidate)) { selected = candidate; break; }
      if (selected === undefined) { response.writeHead(503); response.end('{"message":"No hay instancias disponibles."}'); return; }
      // The request is sent once, after selecting a healthy instance.
      const upstream = http.request({ hostname: 'localhost', port: ports[selected], method: request.method, path: request.url, headers: request.headers }, (incoming) => {
        response.writeHead(incoming.statusCode, incoming.headers);
        incoming.pipe(response);
      });
      upstream.on('error', () => { if (!response.headersSent) response.writeHead(503); response.end(); });
      request.pipe(upstream);
      return;
    }
    const url = new URL(request.url, 'http://localhost');
    const asset = url.pathname.startsWith('/assets/') || ['/favicon.svg', '/sw.js', '/manifest.webmanifest'].includes(url.pathname);
    const relative = asset ? decodeURIComponent(url.pathname).slice(1) : 'index.html';
    const file = path.resolve(dist, relative);
    if (!file.startsWith(dist + path.sep)) { response.writeHead(400); response.end(); return; }
    let buffer = await fs.readFile(file);
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' }[path.extname(file)] || 'application/octet-stream';
    const headers = { 'Content-Type': mime, 'Cache-Control': asset && relative !== 'sw.js' ? 'public, max-age=3600' : 'no-cache' };
    if (/gzip/.test(request.headers['accept-encoding'] || '')) { buffer = gzipSync(buffer); headers['Content-Encoding'] = 'gzip'; headers.Vary = 'Accept-Encoding'; }
    headers['Content-Length'] = buffer.length;
    response.writeHead(200, headers); send(response, buffer);
  } catch (_) { response.writeHead(404); response.end(); }
});
async function close() {
  proxy.closeAllConnections(); proxy.close();
  for (const child of children) if (child && !child.killed) child.kill();
}
async function main() {
  for (let index = 0; index < ports.length; index++) startInstance(index);
  await Promise.all(ports.map((_, index) => waitReady(index)));
  await new Promise((resolve, reject) => { proxy.once('error', reject); proxy.listen(port, '0.0.0.0', resolve); });
  if (process.argv[2] === 'smoke') {
    let failures = 0; const start = performance.now();
    for (let i = 0; i < 10; i++) if (!(await fetch(`http://localhost:${port}/api/live`)).ok) failures++;
    children[0].kill(); await new Promise((resolve) => setTimeout(resolve, 150));
    for (let i = 0; i < 10; i++) if (!(await fetch(`http://localhost:${port}/api/live`)).ok) failures++;
    startInstance(0); await waitReady(0);
    for (let i = 0; i < 10; i++) if (!(await fetch(`http://localhost:${port}/api/live`)).ok) failures++;
    console.log(JSON.stringify({ event: 'lab.failover', requests: 30, failures, restarted: true, durationMs: Math.round(performance.now() - start) }));
    await close(); if (failures) process.exitCode = 1;
  } else console.log(JSON.stringify({ event: 'lab.ready', url: `http://localhost:${port}`, kbps: rate * 8 / 1000, latencyMs: latency }));
}
process.once('SIGINT', () => { void close(); });
process.once('SIGTERM', () => { void close(); });
main().catch(async (error) => { console.error(error.message); await close(); process.exitCode = 1; });

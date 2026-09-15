export class TransportError extends Error {
  constructor(message, code) { super(message); this.name = code === 'ABORTED' ? 'AbortError' : 'TransportError'; this.code = code; }
}
function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new TransportError('Solicitud cancelada.', 'ABORTED'));
    const cancel = () => { clearTimeout(timer); reject(new TransportError('Solicitud cancelada.', 'ABORTED')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve(); }, ms);
    signal?.addEventListener('abort', cancel, { once: true });
  });
}
export async function fetchWithPolicy(url, options = {}, fetcher = fetch) {
  const { timeoutMs = options.body instanceof FormData ? 60000 : 20000, signal, ...init } = options;
  const method = String(init.method || 'GET').toUpperCase();
  const readOnly = ['GET', 'HEAD'].includes(method);
  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) throw new TransportError('Solicitud cancelada.', 'ABORTED');
    const controller = new AbortController();
    let timedOut = false;
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
      const response = await fetcher(url, { ...init, cache: 'no-store', signal: controller.signal });
      // Consume the body inside the timeout too, so a slow body cannot hang.
      const buffer = await response.arrayBuffer();
      const result = new Response([204, 205, 304].includes(response.status) ? null : buffer,
        { status: response.status, statusText: response.statusText, headers: response.headers });
      if (!readOnly || ![502, 503, 504].includes(result.status) || attempt >= 2) return result;
    } catch (error) {
      if (signal?.aborted) throw new TransportError('Solicitud cancelada.', 'ABORTED');
      if (!readOnly || attempt >= 2) throw new TransportError(readOnly
        ? (timedOut ? 'El servidor tardó demasiado. Puedes volver a intentarlo.' : 'No fue posible conectar con el servidor.')
        : 'No se pudo comprobar el resultado del guardado. Conservamos el formulario; revisa el registro antes de reenviarlo.', timedOut ? 'TIMEOUT' : 'NETWORK');
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
    await pause(400 * (2 ** attempt) + Math.random() * 150, signal);
  }
}

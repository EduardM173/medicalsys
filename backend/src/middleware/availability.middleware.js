const state = require('../config/availability');
module.exports = function availability(request, response, next) {
  response.setHeader('Cache-Control', 'no-store, private');
  if (state.draining && !['/api/live', '/api/ready', '/api/health'].includes(request.path)) {
    return response.status(503).json({ message: 'Servidor en mantenimiento. Intenta nuevamente en unos segundos.' });
  }
  state.inFlight++;
  const started = performance.now();
  let finished = false;
  const record = () => {
    if (finished) return;
    finished = true;
    state.inFlight--;
    state.requests++;
    if (response.statusCode >= 500) state.failures++;
    state.durationMs += performance.now() - started;
  };
  response.once('finish', record);
  response.once('close', record);
  next();
};

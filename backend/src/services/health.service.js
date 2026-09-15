const healthRepository = require('../repositories/health.repository');
const state = require('../config/availability');

function liveness() { return { status: 'ok', service: 'medicalsys-api' }; }
async function readiness() {
  if (state.draining) return { status: 'unavailable', reason: 'draining' };
  let timer;
  try {
    await Promise.race([healthRepository.checkConnection(), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), 2000);
    })]);
    return { status: 'ok', database: 'connected' };
  } catch (_) { return { status: 'unavailable', database: 'unavailable' }; }
  finally { clearTimeout(timer); }
}
function metrics() {
  return { uptimeSeconds: Math.floor((Date.now() - state.startedAt) / 1000), requests: state.requests,
    failures: state.failures, inFlight: state.inFlight,
    averageDurationMs: state.requests ? Math.round(state.durationMs / state.requests) : 0 };
}

async function checkHealth() {
  await healthRepository.checkConnection();

  return {
    status: 'ok',
    service: 'medicalsys-api',
    database: 'connected'
  };
}

module.exports = { checkHealth, liveness, readiness, metrics };

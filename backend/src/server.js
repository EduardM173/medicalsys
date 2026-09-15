require('dotenv').config();
const app = require('./app');
const { startGreenApiPolling, stopGreenApiPolling } = require('./services/whatsapp/green-api-poller');
const { startWhatsAppNotificationWorker, stopWhatsAppNotificationWorker } = require('./workers/whatsapp-notification.worker');
const database = require('./config/prisma');
const availability = require('./config/availability');

const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
  console.log(`MedicalSys API disponible en http://localhost:${port}`);
  startGreenApiPolling();
  // En producción puede desactivarse y ejecutar uno o varios procesos
  // `npm run worker:whatsapp`; los bloqueos de PostgreSQL son compartidos.
  if (String(process.env.WHATSAPP_START_WORKER_IN_API || 'true').toLowerCase() !== 'false') {
    startWhatsAppNotificationWorker();
  }
});
server.requestTimeout = 30000;
server.headersTimeout = 35000;
server.on('error', (error) => {
  console.error(JSON.stringify({ event: 'server.error', code: error.code,
    message: error.code === 'EADDRINUSE' ? `El puerto ${port} ya está ocupado por otra instancia.` : 'No se pudo iniciar el servidor.' }));
  process.exitCode = 1;
});
function shutdown(signal) {
  if (availability.draining) return;
  availability.draining = true;
  stopGreenApiPolling();
  stopWhatsAppNotificationWorker();
  console.log(JSON.stringify({ event: 'server.draining', signal }));
  const deadline = setTimeout(() => { server.closeAllConnections(); process.exit(1); }, 20000);
  deadline.unref();
  server.close(async () => {
    await database.disconnectAll();
    clearTimeout(deadline);
    process.exit(0);
  });
  server.closeIdleConnections();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

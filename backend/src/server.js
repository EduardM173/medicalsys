require('dotenv').config();
const app = require('./app');
const { startGreenApiPolling } = require('./services/whatsapp/green-api-poller');
const { startWhatsAppNotificationWorker } = require('./workers/whatsapp-notification.worker');

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`MedicalSys API disponible en http://localhost:${port}`);
  startGreenApiPolling();
  // En producción puede desactivarse y ejecutar uno o varios procesos
  // `npm run worker:whatsapp`; los bloqueos de PostgreSQL son compartidos.
  if (String(process.env.WHATSAPP_START_WORKER_IN_API || 'true').toLowerCase() !== 'false') {
    startWhatsAppNotificationWorker();
  }
});

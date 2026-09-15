const {
  processNextNotificationJob,
  workerIdentity
} = require('../services/whatsapp/whatsapp-notification-queue.service');

const DEFAULT_INTERVAL_MS = 5000;
let timer = null;
let draining = false;

function intervalMs() {
  const value = Number(process.env.WHATSAPP_WORKER_INTERVAL_MS);
  return Number.isFinite(value) && value >= 1000 ? value : DEFAULT_INTERVAL_MS;
}

function batchSize() {
  const value = Number(process.env.WHATSAPP_WORKER_BATCH_SIZE);
  return Number.isInteger(value) && value >= 1 && value <= 100 ? value : 20;
}

// Puede ejecutarse en varios procesos/hosts: cada trabajo se reclama en la
// base con compare-and-set, por lo que solo el propietario del bloqueo envía.
async function drainOnce() {
  if (draining) return { processed: 0, skipped: true };
  draining = true;
  let processed = 0;
  try {
    const id = workerIdentity();
    for (let index = 0; index < batchSize(); index += 1) {
      const result = await processNextNotificationJob(id);
      if (!result.processed && result.reason === 'empty') break;
      if (result.processed || result.cancelled) processed += 1;
    }
    return { processed };
  } catch (error) {
    console.error(`[WhatsApp worker] ${error.message || 'No fue posible procesar la cola.'}`);
    return { processed, error: true };
  } finally {
    draining = false;
  }
}

function startWhatsAppNotificationWorker() {
  if (timer) return;
  void drainOnce();
  timer = setInterval(() => { void drainOnce(); }, intervalMs());
  timer.unref?.();
  console.log(`Worker de cola WhatsApp activo (${workerIdentity()}).`);
}

function stopWhatsAppNotificationWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}

if (require.main === module) {
  startWhatsAppNotificationWorker();
  const close = () => {
    stopWhatsAppNotificationWorker();
    process.exit(0);
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}

module.exports = { drainOnce, startWhatsAppNotificationWorker, stopWhatsAppNotificationWorker };

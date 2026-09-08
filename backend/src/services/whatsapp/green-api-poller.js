const notificationService = require('../notification.service');
const whatsappService = require('./whatsapp.service');

const DEFAULT_INTERVAL_MS = 6500;
let timer = null;
let polling = false;

function pollInterval() {
  const configured = Number(process.env.GREENAPI_POLL_INTERVAL_MS);
  return Number.isFinite(configured) && configured >= 5000 ? configured : DEFAULT_INTERVAL_MS;
}

async function pollOnce() {
  if (polling) return null;
  polling = true;
  try {
    const incoming = await whatsappService.receiveIncomingNotification();
    if (!incoming) return null;

    const result = await notificationService.processGreenApiIncomingNotification(incoming.body);
    // El mensaje se elimina solo después de procesarlo, para que Green API no
    // bloquee la cola repitiendo el mismo evento indefinidamente.
    await whatsappService.acknowledgeIncomingNotification(incoming.receiptId);
    if (result.confirmed) {
      console.log(`Cita ${result.appointmentId} confirmada por respuesta de WhatsApp.`);
    }
    return result;
  } catch (error) {
    // No se expone el token ni el cuerpo recibido. Green API reintentará los
    // elementos de su cola que no se hayan confirmado como procesados.
    console.error(`[Green API] ${error.message || 'No fue posible procesar una respuesta entrante.'}`);
    return null;
  } finally {
    polling = false;
  }
}

function startGreenApiPolling() {
  if (timer || String(process.env.WHATSAPP_PROVIDER || '').toUpperCase() !== 'GREEN_API') return;
  void pollOnce();
  timer = setInterval(() => { void pollOnce(); }, pollInterval());
  timer.unref?.();
  console.log('Recepción de respuestas WhatsApp por Green API activada.');
}

function stopGreenApiPolling() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { pollOnce, startGreenApiPolling, stopGreenApiPolling };

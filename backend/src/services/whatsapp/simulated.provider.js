const crypto = require('crypto');

/**
 * MED-212: Proveedor simulado para desarrollo, usado cuando la API real de
 * WhatsApp Business no está disponible o no está configurada (sin
 * WHATSAPP_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID). Mantiene la misma
 * interfaz que el proveedor real (CloudApiWhatsappProvider) para que el
 * resto del sistema (notification.service.js) sea independiente del
 * proveedor concreto que se use en cada entorno.
 */
class SimulatedWhatsappProvider {
  // eslint-disable-next-line class-methods-use-this
  async sendMessage({ to, body }) {
    // Pequeña latencia artificial para simular una llamada de red real.
    await new Promise((resolve) => setTimeout(resolve, 150));

    console.log(`[WhatsApp SIMULADO] Destino: ${to}\n${body}\n`);

    return {
      success: true,
      providerReference: `SIMULATED-${crypto.randomUUID()}`
    };
  }
}

module.exports = SimulatedWhatsappProvider;

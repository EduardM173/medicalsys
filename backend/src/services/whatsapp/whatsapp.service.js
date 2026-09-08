const SimulatedWhatsappProvider = require('./simulated.provider');
const CloudApiWhatsappProvider = require('./cloud-api.provider');
const TwilioWhatsappProvider = require('./twilio.provider');
const GreenApiWhatsappProvider = require('./green-api.provider');

/**
 * MED-211: Servicio reutilizable que concentra la comunicación con el
 * proveedor de WhatsApp. Es consumido tanto por la confirmación de citas
 * (HU-24) como por los recordatorios de citas (HU-25), evitando una segunda
 * implementación (MED-224). Sigue el mismo patrón "provider" ya usado por
 * services/storage/storage.service.js.
 *
 * Proveedores disponibles vía WHATSAPP_PROVIDER:
 *   SIMULATED  -> no envía nada real, solo registra (valor por defecto)
 *   GREEN_API  -> vincula tu propio WhatsApp vía QR (green-api.com), recomendado para pruebas
 *   CLOUD_API  -> WhatsApp Business Cloud API de Meta
 *   TWILIO     -> Sandbox/API de Twilio
 */
class WhatsappService {
  constructor() {
    this.simulatedProvider = new SimulatedWhatsappProvider();
    this.cloudApiProvider = new CloudApiWhatsappProvider();
    this.twilioProvider = new TwilioWhatsappProvider();
    this.greenApiProvider = new GreenApiWhatsappProvider();
  }

  getActiveProvider() {
    const configuredProvider = (process.env.WHATSAPP_PROVIDER || 'SIMULATED').toUpperCase();
    if (configuredProvider === 'CLOUD_API' && this.cloudApiProvider.isConfigured()) {
      return this.cloudApiProvider;
    }
    if (configuredProvider === 'TWILIO' && this.twilioProvider.isConfigured()) {
      return this.twilioProvider;
    }
    if (configuredProvider === 'GREEN_API' && this.greenApiProvider.isConfigured()) {
      return this.greenApiProvider;
    }
    // MED-212: si no hay credenciales reales configuradas, se recurre al
    // proveedor simulado para no bloquear el desarrollo ni las pruebas.
    return this.simulatedProvider;
  }

  /**
   * @param {{ to: string, body: string }} message
   * @returns {Promise<{ success: boolean, providerReference?: string, errorMessage?: string }>}
   */
  async sendMessage({ to, body }) {
    const provider = this.getActiveProvider();
    return provider.sendMessage({ to, body });
  }

  // Green API permite consumir la cola de mensajes entrantes por HTTP. Esto
  // funciona en desarrollo local sin exponer el backend con un túnel público.
  async receiveIncomingNotification() {
    const provider = this.getActiveProvider();
    if (provider !== this.greenApiProvider) return null;
    return provider.receiveNotification();
  }

  async acknowledgeIncomingNotification(receiptId) {
    const provider = this.getActiveProvider();
    if (provider !== this.greenApiProvider) return false;
    return provider.deleteNotification(receiptId);
  }
}

module.exports = new WhatsappService();

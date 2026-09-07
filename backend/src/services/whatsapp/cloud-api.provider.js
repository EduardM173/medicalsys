/**
 * Proveedor real basado en WhatsApp Business Cloud API (Meta Graph API).
 * Documentación: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Variables de entorno requeridas (backend/.env):
 *   WHATSAPP_PROVIDER=CLOUD_API
 *   WHATSAPP_PHONE_NUMBER_ID=xxxxxxxxxxxxxxx
 *   WHATSAPP_API_TOKEN=EAAG...
 *   WHATSAPP_API_VERSION=v20.0            (opcional, valor por defecto: v20.0)
 *   WHATSAPP_API_URL=https://graph.facebook.com/v20.0  (opcional, se arma solo con el account id)
 *
 * Si estas variables no están configuradas, whatsapp.service.js utiliza
 * automáticamente el proveedor simulado (simulated.provider.js).
 */
class CloudApiWhatsappProvider {
  constructor() {
    this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    this.token = process.env.WHATSAPP_API_TOKEN || '';
    this.baseUrl = process.env.WHATSAPP_API_URL || `https://graph.facebook.com/${this.apiVersion}`;
  }

  isConfigured() {
    return Boolean(this.phoneNumberId && this.token);
  }

  async sendMessage({ to, body }) {
    if (!this.isConfigured()) {
      return {
        success: false,
        errorMessage: 'El proveedor de WhatsApp Business API no está configurado (faltan credenciales).'
      };
    }

    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to: to.replace(/^\+/, ''),
      type: 'text',
      text: { body, preview_url: false }
    };

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    } catch (_error) {
      return {
        success: false,
        errorMessage: 'No fue posible conectarse con el proveedor de WhatsApp Business API.'
      };
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        errorMessage: data?.error?.message || 'El proveedor de WhatsApp rechazó el envío del mensaje.'
      };
    }

    const messageId = data?.messages?.[0]?.id || null;
    return { success: true, providerReference: messageId };
  }
}

module.exports = CloudApiWhatsappProvider;

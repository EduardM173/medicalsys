/**
 * Proveedor alternativo basado en Green API (green-api.com).
 * Documentación: https://green-api.com/en/docs/api/sending/SendMessage
 *
 * A diferencia de Twilio (que exige que cada destinatario "se una" a un
 * sandbox enviando un código) o de Meta (que exige verificación de
 * negocio), Green API vincula TU PROPIO WhatsApp escaneando un código QR
 * (igual que WhatsApp Web) y a partir de ahí puede enviar mensajes a
 * cualquier número directamente, sin pasos adicionales para quien los
 * recibe. Tiene un plan gratuito "Developer" pensado justo para pruebas
 * como esta.
 *
 * Variables de entorno requeridas (backend/.env):
 *   WHATSAPP_PROVIDER=GREEN_API
 *   GREENAPI_API_URL=https://xxxx.api.greenapi.com   (tal cual aparece en tu consola, sin / al final)
 *   GREENAPI_ID_INSTANCE=1101000001
 *   GREENAPI_API_TOKEN_INSTANCE=d75b3a66374942c5b3c019c698abc2067e151558acbd412345
 *
 * Si estas variables no están configuradas, whatsapp.service.js utiliza
 * automáticamente el proveedor simulado (simulated.provider.js).
 */
class GreenApiWhatsappProvider {
  constructor() {
    this.apiUrl = (process.env.GREENAPI_API_URL || '').replace(/\/$/, '');
    this.idInstance = process.env.GREENAPI_ID_INSTANCE || '';
    this.apiTokenInstance = process.env.GREENAPI_API_TOKEN_INSTANCE || '';
  }

  isConfigured() {
    return Boolean(this.apiUrl && this.idInstance && this.apiTokenInstance);
  }

  async sendMessage({ to, body }) {
    if (!this.isConfigured()) {
      return {
        success: false,
        errorMessage: 'El proveedor Green API no está configurado (faltan GREENAPI_API_URL / GREENAPI_ID_INSTANCE / GREENAPI_API_TOKEN_INSTANCE).'
      };
    }

    // Green API espera el número sin "+" y con el sufijo "@c.us" para chats individuales.
    const chatId = `${to.replace(/^\+/, '')}@c.us`;
    const url = `${this.apiUrl}/waInstance${this.idInstance}/sendMessage/${this.apiTokenInstance}`;

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message: body })
      });
    } catch (_error) {
      return {
        success: false,
        errorMessage: 'No fue posible conectarse con Green API.'
      };
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        // Si el error menciona "notAuthorized", hay que volver a escanear el QR en la consola de Green API.
        errorMessage: data?.message || data?.error || 'Green API rechazó el envío del mensaje.'
      };
    }

    return { success: true, providerReference: data.idMessage || null };
  }
}

module.exports = GreenApiWhatsappProvider;

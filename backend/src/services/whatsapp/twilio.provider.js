/**
 * Proveedor alternativo basado en la API de Twilio para WhatsApp.
 * Documentación: https://www.twilio.com/docs/whatsapp/sandbox
 *
 * Es la opción más rápida para probar envíos reales sin pasar por el
 * proceso de verificación de negocio de Meta: Twilio ofrece un número de
 * "sandbox" gratuito al que te unís enviando un mensaje de WhatsApp desde
 * tu propio celular.
 *
 * Variables de entorno requeridas (backend/.env):
 *   WHATSAPP_PROVIDER=TWILIO
 *   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *   TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   (número de sandbox por defecto de Twilio)
 *
 * Si estas variables no están configuradas, whatsapp.service.js utiliza
 * automáticamente el proveedor simulado (simulated.provider.js).
 */
class TwilioWhatsappProvider {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    // Número estándar del sandbox de Twilio; se sobreescribe si ya tienes un número propio aprobado.
    this.fromNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
  }

  isConfigured() {
    return Boolean(this.accountSid && this.authToken);
  }

  async sendMessage({ to, body }) {
    if (!this.isConfigured()) {
      return {
        success: false,
        errorMessage: 'El proveedor de Twilio no está configurado (faltan TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN).'
      };
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const from = this.fromNumber.startsWith('whatsapp:') ? this.fromNumber : `whatsapp:${this.fromNumber}`;
    const params = new URLSearchParams({
      From: from,
      To: `whatsapp:${to}`,
      Body: body
    });

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });
    } catch (_error) {
      return {
        success: false,
        errorMessage: 'No fue posible conectarse con Twilio.'
      };
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        // Código 63016/63018 de Twilio suele significar que el destinatario
        // no se unió al sandbox (no mandó "join <código>" desde su WhatsApp).
        errorMessage: data?.message || 'Twilio rechazó el envío del mensaje.'
      };
    }

    return { success: true, providerReference: data.sid || null };
  }
}

module.exports = TwilioWhatsappProvider;

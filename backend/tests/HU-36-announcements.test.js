const test = require('node:test');
const assert = require('node:assert/strict');
const { campaignPublicationStatus } = require('../src/services/campaign.service');
const { canReceiveWhatsApp, eligible, loyaltyLevel } = require('../src/services/announcement.service');

const now = new Date('2026-09-14T12:00:00Z');

test('PA-01/02/03: respeta borrador y calcula publicación o finalización por vigencia', () => {
  assert.equal(campaignPublicationStatus({ estado: 'BORRADOR', fecha_inicio: new Date('2026-09-01'), fecha_fin: new Date('2026-10-01') }, now), 'BORRADOR');
  assert.equal(campaignPublicationStatus({ estado: 'PROGRAMADA', fecha_inicio: new Date('2026-09-01'), fecha_fin: new Date('2026-10-01') }, now), 'ACTIVA');
  assert.equal(campaignPublicationStatus({ estado: 'ACTIVA', fecha_inicio: new Date('2026-08-01'), fecha_fin: new Date('2026-09-01') }, now), 'FINALIZADA');
});

test('PA-04: aplica edad, sexo, ubicación, condición y nivel en conjunto', () => {
  const patient = { fecha_nacimiento: new Date('1988-04-18'), sexo: 'MASCULINO', direccion: 'Zona Central, La Paz', fidelizacion: { nivel: 'PREMIUM' }, historia_clinica: { condiciones_cronicas: 'Hipertensión arterial controlada' } };
  const campaign = { segmento_edad_min: 30, segmento_edad_max: 50, segmento_sexo: 'MASCULINO', segmento_ubicacion: 'La Paz', segmento_nivel: 'ORO', segmento_condiciones: ['hipertensión'] };
  assert.equal(eligible(patient, campaign), true);
  assert.equal(eligible(patient, { ...campaign, segmento_nivel: 'PLATA' }), false);
});

test('PA-05: WhatsApp exige suscripción y autorización explícitas', () => {
  const base = { telefono: '+59170000000', fecha_nacimiento: new Date('1990-01-01'), fidelizacion: null, historia_clinica: null };
  const campaign = { whatsapp_habilitado: true };
  assert.equal(canReceiveWhatsApp({ ...base, preferencia_marketing: { suscrito: true, whatsapp_autorizado: true } }, campaign), true);
  assert.equal(canReceiveWhatsApp({ ...base, preferencia_marketing: { suscrito: false, whatsapp_autorizado: true } }, campaign), false);
  assert.equal(canReceiveWhatsApp({ ...base, preferencia_marketing: null }, campaign), false);
});

test('PA-08/09: los niveles se calculan con puntos no negativos y umbrales configurables', () => {
  assert.equal(loyaltyLevel(0), 'ESTANDAR');
  assert.equal(loyaltyLevel(200), 'FRECUENTE');
  assert.equal(loyaltyLevel(500), 'PREMIUM');
});

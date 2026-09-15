const cors = require('cors');
const cookieParser = require('cookie-parser');
const express = require('express');
const appointmentRoutes = require('./routes/appointment.routes');
const agendaRoutes = require('./routes/agenda.routes');
const attentionRoutes = require('./routes/attention.routes');
const authRoutes = require('./routes/auth.routes');
const billingRoutes = require('./routes/billing.routes');
const campaignRoutes = require('./routes/campaign.routes');
const clinicalDocumentRoutes = require('./routes/clinical-document.routes');
const clinicalMessageRoutes = require('./routes/clinical-message.routes');
const consentRoutes = require('./routes/consent.routes');
const consentTemplateRoutes = require('./routes/consent-template.routes');
const doctorRoutes = require('./routes/doctor.routes');
const documentRoutes = require('./routes/document.routes');
const healthRoutes = require('./routes/health.routes');
const loyaltyRoutes = require('./routes/loyalty.routes');
const medicalHistoryRoutes = require('./routes/medical-history.routes');
const notificationRoutes = require('./routes/notification.routes');
const patientPortalRoutes = require('./routes/patient-portal.routes');
const patientRoutes = require('./routes/patient.routes');
const roomRoutes = require('./routes/room.routes');
const scheduleRoutes = require('./routes/schedule.routes');
const serviceRoutes = require('./routes/service.routes');
const tenantRoutes = require('./routes/tenant.routes');
const userRoutes = require('./routes/user.routes');
const tenantMiddleware = require('./middleware/tenant.middleware');
const errorHandler = require('./middleware/error.middleware');
const requestLogger = require('./middleware/log.middleware');
const { enforceHttps } = require('./middleware/security.middleware');

const app = express();
app.enable('trust proxy');
app.use(enforceHttps());

function isOriginAllowed(origin) {
  if (!origin) return true;
  const configured = process.env.FRONTEND_URL || 'http://localhost:5173';
  if (origin === configured || origin === 'http://localhost:5173') return true;
  // Permitir subdominios de localhost para SaaS multi-tenant (ej. cumed.localhost:5173)
  if (/^https?:\/\/[a-z0-9-]+\.localhost(?::\d+)?$/.test(origin)) return true;
  if (/^https?:\/\/localhost(?::\d+)?$/.test(origin)) return true;
  return false;
}

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Bloqueado por CORS: origen no permitido (${origin})`));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/security', require('./routes/security.routes'));
app.use(tenantMiddleware);
app.use('/api/tenants', tenantRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/atenciones', attentionRoutes);
app.use('/api/attentions', attentionRoutes);
app.use('/api/historias', attentionRoutes);
app.use('/api/consents', consentRoutes);
app.use('/api/consentimientos', consentRoutes);
app.use('/api/consent-templates', consentTemplateRoutes);
app.use('/api/agenda', agendaRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/patient', patientPortalRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/patients', medicalHistoryRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api', clinicalMessageRoutes);
app.use('/api', scheduleRoutes);
app.use('/api', documentRoutes);
app.use('/api', clinicalDocumentRoutes);

app.use(errorHandler);

module.exports = app;
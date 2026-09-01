const cors = require('cors');
const cookieParser = require('cookie-parser');
const express = require('express');
const authRoutes = require('./routes/auth.routes');
const clinicalDocumentRoutes = require('./routes/clinical-document.routes');
const doctorRoutes = require('./routes/doctor.routes');
const documentRoutes = require('./routes/document.routes');
const healthRoutes = require('./routes/health.routes');
const medicalHistoryRoutes = require('./routes/medical-history.routes');
const patientRoutes = require('./routes/patient.routes');
const roomRoutes = require('./routes/room.routes');
const scheduleRoutes = require('./routes/schedule.routes');
const userRoutes = require('./routes/user.routes');
const errorHandler = require('./middleware/error.middleware');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/patients', medicalHistoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api', scheduleRoutes);
app.use('/api', documentRoutes);
app.use('/api', clinicalDocumentRoutes);

app.use(errorHandler);

module.exports = app;

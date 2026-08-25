const cors = require('cors');
const express = require('express');
const healthRoutes = require('./routes/health.routes');
const errorHandler = require('./middleware/error.middleware');

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use('/api', healthRoutes);
app.use(errorHandler);

module.exports = app;

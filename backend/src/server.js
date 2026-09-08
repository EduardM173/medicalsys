require('dotenv').config();
const app = require('./app');
const { startGreenApiPolling } = require('./services/whatsapp/green-api-poller');

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`MedicalSys API disponible en http://localhost:${port}`);
  startGreenApiPolling();
});

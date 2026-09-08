const { Router } = require('express');
const loyaltyController = require('../controllers/loyalty.controller');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = Router();

router.use(requireAuth, requireRole('ADMINISTRADOR'));

// HU-28: Gestionar fidelización de pacientes
router.get('/patients', loyaltyController.listPatients);
router.get('/stats', loyaltyController.getStats);
router.post('/enroll', loyaltyController.enrollPatient);
router.patch('/patients/:patientId', loyaltyController.updatePatientLoyalty);
router.delete('/patients/:patientId', loyaltyController.removePatientLoyalty);

module.exports = router;

const { Router } = require('express');
const patientController = require('../controllers/patient.controller');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = Router();

router.use(requireAuth, requireRole('RECEPCIONISTA', 'ADMINISTRADOR'));
router.post('/', patientController.createPatient);
router.get('/', patientController.listPatients);
router.get('/:id', patientController.getPatient);
router.patch('/:id', patientController.updatePatient);

module.exports = router;

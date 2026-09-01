const { Router } = require('express');
const patientController = require('../controllers/patient.controller');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = Router();

router.use(requireAuth);
router.post('/', requireRole('RECEPCIONISTA', 'ADMINISTRADOR'), patientController.createPatient);
router.get('/', requireRole('RECEPCIONISTA', 'ADMINISTRADOR', 'MEDICO'), patientController.listPatients);
router.get('/:id', requireRole('RECEPCIONISTA', 'ADMINISTRADOR', 'MEDICO'), patientController.getPatient);
router.patch('/:id', requireRole('RECEPCIONISTA', 'ADMINISTRADOR'), patientController.updatePatient);

module.exports = router;

const { Router } = require('express');
const doctorController = require('../controllers/doctor.controller');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = Router();

router.use(requireAuth);
router.get('/', requireRole('RECEPCIONISTA', 'ADMINISTRADOR'), doctorController.listDoctors);
router.get('/:id', requireRole('RECEPCIONISTA', 'ADMINISTRADOR'), doctorController.getDoctor);
router.post('/', requireRole('ADMINISTRADOR'), doctorController.createDoctor);
router.patch('/:id', requireRole('ADMINISTRADOR'), doctorController.updateDoctor);

module.exports = router;

const { Router } = require('express');
const doctorController = require('../controllers/doctor.controller');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = Router();

router.use(requireAuth, requireRole('ADMINISTRADOR'));
router.post('/', doctorController.createDoctor);
router.get('/', doctorController.listDoctors);
router.get('/:id', doctorController.getDoctor);
router.patch('/:id', doctorController.updateDoctor);

module.exports = router;

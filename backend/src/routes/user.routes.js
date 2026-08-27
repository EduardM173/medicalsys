const { Router } = require('express');
const userController = require('../controllers/user.controller');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = Router();

router.use(requireAuth, requireRole('ADMINISTRADOR'));
router.post('/', userController.createUser);
router.get('/', userController.listUsers);
router.get('/:id', userController.getUser);
router.patch('/:id', userController.updateUser);
router.delete('/:id', userController.deactivateUser);

module.exports = router;

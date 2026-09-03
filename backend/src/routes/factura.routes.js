const { Router } = require('express');
const requireAuth = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const facturaController = require('../controllers/factura.controller');

const router = Router();

// Todas las rutas de facturación requieren autenticación y rol RECEPCIONISTA o ADMINISTRADOR (MED-197 / PA-07)
router.use(requireAuth);
router.use(requireRole('RECEPCIONISTA', 'ADMINISTRADOR'));

// Configuración de la clínica emisora para la cabecera fiscal (debe ir antes de /:id)
router.get('/configuracion-clinica', facturaController.obtenerConfiguracionClinica);

// Listar facturas
router.get('/', facturaController.listarFacturas);

// Crear borrador o nueva factura
router.post('/', facturaController.crearFactura);

// Emisión computarizada ante el SIN (MED-184, MED-185)
router.post('/:id/emitir', facturaController.emitirFactura);

// Obtener detalle y resultado de emisión de una factura por ID (MED-184)
router.get('/:id', facturaController.obtenerFactura);

module.exports = router;

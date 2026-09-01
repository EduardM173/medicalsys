const prisma = require('../config/prisma');

function toMedicalService(service) {
  return {
    id: Number(service.id_servicio),
    codigo: service.codigo,
    nombre: service.nombre,
    tipo: service.tipo,
    duracionMinutos: service.duracion_minutos,
    precioBase: Number(service.precio_base),
    activo: service.activo
  };
}

async function listServices() {
  const services = await prisma.servicio_medico.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' }
  });
  return services.map(toMedicalService);
}

module.exports = { listServices };

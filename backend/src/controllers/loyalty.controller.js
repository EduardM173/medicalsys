const loyaltyService = require('../services/loyalty.service');

async function listPatients(req, res, next) {
  try {
    const { search, estado, nivel, soloMiembros } = req.query;
    const result = await loyaltyService.listPatientsWithLoyalty({
      search,
      estado,
      nivel,
      soloMiembros: soloMiembros === 'true' || soloMiembros === '1'
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function getStats(req, res, next) {
  try {
    const stats = await loyaltyService.getLoyaltyStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
}

async function enrollPatient(req, res, next) {
  try {
    const { patientId, nivel, puntos, notas } = req.body;
    if (!patientId) {
      return res.status(400).json({ message: 'El ID del paciente es obligatorio.' });
    }
    const result = await loyaltyService.enrollPatient({ patientId, nivel, puntos, notas });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function updatePatientLoyalty(req, res, next) {
  try {
    const { patientId } = req.params;
    const result = await loyaltyService.updatePatientLoyalty(patientId, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function removePatientLoyalty(req, res, next) {
  try {
    const { patientId } = req.params;
    const result = await loyaltyService.removePatientLoyalty(patientId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listPatients,
  getStats,
  enrollPatient,
  updatePatientLoyalty,
  removePatientLoyalty
};

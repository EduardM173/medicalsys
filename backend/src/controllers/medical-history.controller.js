const medicalHistoryService = require('../services/medical-history.service');

async function getMedicalHistory(request, response, next) {
  try {
    const result = await medicalHistoryService.getMedicalHistoryByPatientId(
      request.params.patientId
    );
    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = { getMedicalHistory };

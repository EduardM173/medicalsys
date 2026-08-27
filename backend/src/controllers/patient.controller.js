const patientService = require('../services/patient.service');

async function createPatient(request, response, next) {
  try {
    const patient = await patientService.createPatient(request.body);
    response.status(201).json({ patient });
  } catch (error) {
    next(error);
  }
}

async function listPatients(request, response, next) {
  try {
    const patients = await patientService.listPatients(request.query.search);
    response.status(200).json({ patients });
  } catch (error) {
    next(error);
  }
}

async function getPatient(request, response, next) {
  try {
    const patient = await patientService.getPatientById(request.params.id);
    response.status(200).json({ patient });
  } catch (error) {
    next(error);
  }
}

async function updatePatient(request, response, next) {
  try {
    const patient = await patientService.updatePatient(request.params.id, request.body);
    response.status(200).json({ patient });
  } catch (error) {
    next(error);
  }
}

module.exports = { createPatient, getPatient, listPatients, updatePatient };

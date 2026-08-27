const doctorService = require('../services/doctor.service');

async function createDoctor(request, response, next) {
  try {
    const doctor = await doctorService.createDoctor(request.body);
    response.status(201).json({ doctor });
  } catch (error) {
    next(error);
  }
}

async function listDoctors(request, response, next) {
  try {
    const doctors = await doctorService.listDoctors(request.query.search);
    response.status(200).json({ doctors });
  } catch (error) {
    next(error);
  }
}

async function getDoctor(request, response, next) {
  try {
    const doctor = await doctorService.getDoctorById(request.params.id);
    response.status(200).json({ doctor });
  } catch (error) {
    next(error);
  }
}

async function updateDoctor(request, response, next) {
  try {
    const doctor = await doctorService.updateDoctor(request.params.id, request.body);
    response.status(200).json({ doctor });
  } catch (error) {
    next(error);
  }
}

module.exports = { createDoctor, getDoctor, listDoctors, updateDoctor };

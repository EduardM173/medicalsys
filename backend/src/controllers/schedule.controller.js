const scheduleService = require('../services/schedule.service');

async function listDoctors(_request, response, next) {
  try {
    const doctors = await scheduleService.listDoctors();
    response.status(200).json({ doctors });
  } catch (error) {
    next(error);
  }
}

async function listSchedules(request, response, next) {
  try {
    const result = await scheduleService.listSchedulesByDoctor(request.params.doctorId);
    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function listActiveSchedules(request, response, next) {
  try {
    const result = await scheduleService.listActiveSchedulesByDoctor(request.params.doctorId);
    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function createSchedule(request, response, next) {
  try {
    const schedule = await scheduleService.createSchedule(request.params.doctorId, request.body);
    response.status(201).json({ schedule });
  } catch (error) {
    next(error);
  }
}

async function updateSchedule(request, response, next) {
  try {
    const schedule = await scheduleService.updateSchedule(request.params.scheduleId, request.body);
    response.status(200).json({ schedule });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createSchedule,
  listActiveSchedules,
  listDoctors,
  listSchedules,
  updateSchedule
};

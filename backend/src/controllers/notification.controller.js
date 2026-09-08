const notificationService = require('../services/notification.service');

async function getHistory(request, response, next) {
  try {
    const result = await notificationService.listPatientNotificationHistory({
      patientId: request.query.patientId,
      appointmentId: request.query.appointmentId
    });
    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

// HU-24
async function getConfirmationCandidates(request, response, next) {
  try {
    const appointments = await notificationService.listConfirmationCandidates();
    response.status(200).json({ appointments });
  } catch (error) {
    next(error);
  }
}

async function sendConfirmation(request, response, next) {
  try {
    const notification = await notificationService.sendAppointmentConfirmation(
      request.body.citaId,
      request.user.id
    );
    response.status(201).json({ notification });
  } catch (error) {
    next(error);
  }
}

// HU-25
async function getReminderCandidates(request, response, next) {
  try {
    const appointments = await notificationService.listReminderCandidates();
    response.status(200).json({ appointments });
  } catch (error) {
    next(error);
  }
}

async function sendReminder(request, response, next) {
  try {
    const notification = await notificationService.sendAppointmentReminder(
      request.body.citaId,
      request.user.id
    );
    response.status(201).json({ notification });
  } catch (error) {
    next(error);
  }
}

async function runReminders(request, response, next) {
  try {
    const summary = await notificationService.runAppointmentReminders(
      request.body.citaIds,
      request.user.id
    );
    response.status(200).json(summary);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getHistory,
  getConfirmationCandidates,
  sendConfirmation,
  getReminderCandidates,
  sendReminder,
  runReminders
};

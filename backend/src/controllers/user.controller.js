const userService = require('../services/user.service');

async function createUser(request, response, next) {
  try {
    const user = await userService.createUser(request.body);
    response.status(201).json({ user });
  } catch (error) {
    next(error);
  }
}

async function listUsers(_request, response, next) {
  try {
    const users = await userService.listUsers();
    response.status(200).json({ users });
  } catch (error) {
    next(error);
  }
}

async function getUser(request, response, next) {
  try {
    const user = await userService.getUserById(request.params.id);
    response.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}

async function updateUser(request, response, next) {
  try {
    const user = await userService.updateUser(request.params.id, request.body);
    response.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}

async function deactivateUser(request, response, next) {
  try {
    await userService.deactivateUser(request.params.id);
    response.status(200).json({ message: 'Usuario desactivado.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { createUser, deactivateUser, getUser, listUsers, updateUser };

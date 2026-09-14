const userService = require('../services/user.service');

async function createUser(request, response, next) {
  try {
    const user = await userService.mutateUser(
      'CREATE',
      null,
      request.body,
      request.user,
      request.tenant?.id
    );
    response.status(201).json({ user });
  } catch (error) {
    next(error);
  }
}

async function listUsers(request, response, next) {
  try {
    const tenantId = request.tenant?.id;
    const isSuperAdmin = request.user?.rol === 'SUPERADMIN' && !request.hasExplicitTenant;
    const users = await userService.listUsers({ tenantId, isSuperAdmin });
    response.status(200).json({ users });
  } catch (error) {
    next(error);
  }
}

async function listRoles(_request, response, next) {
  try { response.status(200).json({ roles: await userService.listRoles() }); }
  catch (error) { next(error); }
}

async function getUser(request, response, next) {
  try {
    const tenantId = request.tenant?.id;
    const isSuperAdmin = request.user?.rol === 'SUPERADMIN';
    const user = await userService.getUserById(request.params.id, { tenantId, isSuperAdmin });
    response.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}

async function updateUser(request, response, next) {
  try {
    const user = await userService.mutateUser(
      'UPDATE',
      request.params.id,
      request.body,
      request.user,
      request.tenant?.id
    );
    response.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}

async function deactivateUser(request, response, next) {
  try {
    await userService.mutateUser(
      'DEACTIVATE',
      request.params.id,
      {},
      request.user,
      request.tenant?.id
    );
    response.status(200).json({ message: 'Usuario desactivado.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { createUser, deactivateUser, getUser, listRoles, listUsers, updateUser };

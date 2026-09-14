const securityService = require('../services/security.service');

async function getMatrix(_request, response, next) {
  try {
    response.status(200).json(await securityService.matrix());
  } catch (error) {
    next(error);
  }
}

async function getAudit(_request, response, next) {
  try {
    response.status(200).json({ events: await securityService.audit() });
  } catch (error) {
    next(error);
  }
}

async function createRole(request, response, next) {
  try {
    const role = await securityService.createRole(request.body, request.user);
    response.status(201).json({ role });
  } catch (error) {
    next(error);
  }
}

async function updatePolicy(request, response, next) {
  try {
    const result = await securityService.updatePolicy(
      request.params.role,
      request.body.permissions,
      request.user
    );
    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function listTemporaryGrants(_request, response, next) {
  try {
    response.status(200).json({ grants: await securityService.listTemporaryGrants() });
  } catch (error) {
    next(error);
  }
}

async function grantTemporaryPermission(request, response, next) {
  try {
    const grant = await securityService.grantTemporaryPermission(request.body, request.user);
    response.status(201).json({ grant });
  } catch (error) {
    next(error);
  }
}

async function revokeTemporaryGrant(request, response, next) {
  try {
    const result = await securityService.revokeTemporaryGrant(request.params.id, request.user);
    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createRole,
  getAudit,
  getMatrix,
  grantTemporaryPermission,
  listTemporaryGrants,
  revokeTemporaryGrant,
  updatePolicy
};

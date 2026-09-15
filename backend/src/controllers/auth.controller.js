const authService = require('../services/auth.service');

const cookieName = 'medicalsys_session';

function cookieSettings() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  };
}

async function login(request, response, next) {
  try {
    const isExplicit = Boolean(
      request.headers['x-tenant-code'] ||
      request.headers['x-tenant-id'] ||
      request.query?.tenant ||
      request.hasExplicitTenant
    );

    const activeTenantCode = isExplicit
      ? (request.headers['x-tenant-code'] || request.tenant?.codigo || request.query?.tenant)
      : null;

    const result = await authService.login(request.body.email, request.body.password, activeTenantCode);
    if (isExplicit) {
      response.cookie(cookieName, result.token, {
        ...cookieSettings(),
        maxAge: 8 * 60 * 60 * 1000
      });
    } else {
      response.clearCookie(cookieName, cookieSettings());
    }
    response.status(200).json({ user: result.user, token: result.token });
  } catch (error) {
    next(error);
  }
}

function logout(_request, response) {
  response.clearCookie(cookieName, cookieSettings());
  response.status(200).json({ message: 'Sesión cerrada correctamente.' });
}

async function me(request, response, next) {
  try {
    const user = await authService.getCurrentUser(request.user.id);
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (token) {
        response.cookie(cookieName, token, {
          ...cookieSettings(),
          maxAge: 8 * 60 * 60 * 1000
        });
      }
    }
    response.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}

async function forgotPassword(request, response, next) {
  try {
    const result = await authService.forgotPassword(request.body.email);
    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = { forgotPassword, login, logout, me };

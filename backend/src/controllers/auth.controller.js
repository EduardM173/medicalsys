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
    const result = await authService.login(request.body.email, request.body.password);
    response.cookie(cookieName, result.token, {
      ...cookieSettings(),
      maxAge: 8 * 60 * 60 * 1000
    });
    response.status(200).json({ user: result.user });
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
    response.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}

module.exports = { login, logout, me };

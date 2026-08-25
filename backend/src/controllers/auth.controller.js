const authService = require('../services/auth.service');

const cookieName = 'medicalsys_session';

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/'
  };
}

async function login(request, response, next) {
  try {
    const result = await authService.login(request.body.email, request.body.password);
    response.cookie(cookieName, result.token, cookieOptions());
    response.status(200).json({ user: result.user });
  } catch (error) {
    next(error);
  }
}

async function me(request, response, next) {
  try {
    const user = await authService.getCurrentUser(request.user.id);
    response.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}

module.exports = { login, me };

import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuth } from '../contexts/AuthContext';
import { ApiError, forgotPasswordRequest } from '../services/api';
import '../styles/auth.css';

const REMEMBERED_EMAIL_KEY = 'remembered_email';

function getRememberedEmail() {
  try {
    return localStorage.getItem(REMEMBERED_EMAIL_KEY) || '';
  } catch (_error) {
    return '';
  }
}

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(getRememberedEmail);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => Boolean(getRememberedEmail()));
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');

  if (!loading && user) {
    return <Navigate replace to="/dashboard" />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(email, password);
      try {
        if (remember) {
          localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
        } else {
          localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        }
      } catch (_storageError) {
        // Almacenamiento no disponible: no bloquea el inicio de sesión.
      }
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError('No fue posible conectar con el servidor.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotSubmit(event) {
    event.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    setForgotSubmitting(true);

    try {
      const response = await forgotPasswordRequest(forgotEmail);
      setForgotSuccess(
        response.message || 'Se han enviado las instrucciones de restablecimiento a su correo electrónico.'
      );
      setForgotEmail('');
    } catch (requestError) {
      setForgotError(
        requestError instanceof ApiError
          ? requestError.message
          : 'No fue posible conectar con el servidor.'
      );
    } finally {
      setForgotSubmitting(false);
    }
  }

  function openForgotModal() {
    setForgotEmail(email);
    setForgotSuccess('');
    setForgotError('');
    setForgotOpen(true);
  }

  function closeForgotModal() {
    if (forgotSubmitting) return;
    setForgotOpen(false);
    setForgotSuccess('');
    setForgotError('');
  }

  return (
    <main className="login-layout">
      <section className="login-brand" aria-label="MedicalSys">
        <div className="login-orb-1" aria-hidden="true" />
        <div className="login-orb-2" aria-hidden="true" />
        <div className="brand-mark">M+</div>
        <h1>MedicalSys</h1>
        <h2>Gestión Médica Hospitalaria</h2>
        <p>Gestión clínica, administrativa y documental en una sola plataforma.</p>
      </section>

      <section className="login-form-area">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-heading">
            <span className="login-kicker">Acceso seguro</span>
            <h1>Bienvenido a MedicalSys</h1>
            <p>Ingrese sus credenciales para acceder al sistema.</p>
          </div>

          <Input
            autoComplete="email"
            id="email"
            label="Correo electrónico"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="usuario@medicalsys.test"
            required
            type="email"
            value={email}
          />

          <div className="password-field">
            <Input
              autoComplete="current-password"
              id="password"
              label="Contraseña"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Ingrese su contraseña"
              required
              type={showPassword ? 'text' : 'password'}
              value={password}
            />
            <button
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="password-toggle"
              onClick={() => setShowPassword((visible) => !visible)}
              type="button"
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>

          <div className="login-options">
            <label className="login-remember">
              <input
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                type="checkbox"
              />
              <span>Recordarme en este equipo</span>
            </label>
            <button className="login-forgot-link" onClick={openForgotModal} type="button">
              ¿Olvidó su contraseña?
            </button>
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}

          <Button disabled={submitting} type="submit">
            {submitting ? 'Ingresando...' : 'Iniciar sesión'}
          </Button>
        </form>
      </section>

      {forgotOpen && (
        <div className="forgot-overlay" role="dialog" aria-modal="true" aria-labelledby="forgot-title">
          <form className="forgot-modal" onSubmit={handleForgotSubmit}>
            <div className="forgot-heading">
              <span className="login-kicker">Recuperación de acceso</span>
              <h2 id="forgot-title">¿Olvidó su contraseña?</h2>
              <p>Ingrese el correo de su cuenta para recibir las instrucciones de restablecimiento.</p>
            </div>

            <Input
              autoComplete="email"
              id="forgot-email"
              label="Correo electrónico"
              onChange={(event) => setForgotEmail(event.target.value)}
              placeholder="usuario@medicalsys.test"
              required
              type="email"
              value={forgotEmail}
            />

            {forgotSuccess && <p className="forgot-success" role="status">{forgotSuccess}</p>}
            {forgotError && <p className="form-error" role="alert">{forgotError}</p>}

            <div className="forgot-actions">
              <Button disabled={forgotSubmitting || Boolean(forgotSuccess)} type="submit">
                {forgotSubmitting ? 'Enviando...' : 'Enviar instrucciones'}
              </Button>
              <Button disabled={forgotSubmitting} onClick={closeForgotModal} type="button" variant="ghost">
                Cerrar
              </Button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
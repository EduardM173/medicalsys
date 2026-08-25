import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../services/api';
import '../styles/auth.css';

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!loading && user) {
    return <Navigate replace to="/dashboard" />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(email, password);
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

  return (
    <main className="login-layout">
      <section className="login-brand" aria-label="MedicalSys">
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

          {error && <p className="form-error" role="alert">{error}</p>}

          <Button disabled={submitting} type="submit">
            {submitting ? 'Ingresando...' : 'Iniciar sesión'}
          </Button>
        </form>
      </section>
    </main>
  );
}

import React, { useEffect, useState } from 'react';
import { HealthStatus } from '../components/HealthStatus';
import { getHealth } from '../services/api';

export function HomePage() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setError(true));
  }, []);

  return (
    <main className="app-main">
      <section className="welcome-card">
        <h1>MedicalSys</h1>
        <p>Base técnica del MVP</p>
        <p>Frontend preparado para Sprint 2</p>
        <HealthStatus health={health} error={error} />
      </section>
    </main>
  );
}

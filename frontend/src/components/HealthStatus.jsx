export function HealthStatus({ health, error }) {
  if (health) {
    return <p className="status success">API y base de datos disponibles.</p>;
  }

  if (error) {
    return <p className="status">La comprobación de la API estará disponible al iniciar el backend.</p>;
  }

  return <p className="status">Comprobando disponibilidad de la API…</p>;
}

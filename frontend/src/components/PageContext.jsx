import React from 'react';
import { Link } from 'react-router-dom';

export function PageContext({ breadcrumbs = [], title, subtitle, actions, kpis = [] }) {
  return (
    <header className="page-context">
      {breadcrumbs.length > 0 && (
        <nav className="breadcrumbs" aria-label="Ruta de navegación">
          {breadcrumbs.map((item, index) => (
            <span className="breadcrumb-item" key={item.to || index}>
              {index > 0 && <span className="breadcrumb-sep" aria-hidden="true">/</span>}
              {item.to ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="page-context-title">
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="page-context-actions">{actions}</div>}
      </div>
      {kpis.length > 0 && (
        <div className="kpi-grid">
          {kpis.map((kpi) => (
            <div className={`kpi-card${kpi.tone ? ` kpi-${kpi.tone}` : ''}`} key={kpi.label}>
              <span className="kpi-icon" aria-hidden="true">{kpi.icon}</span>
              <div>
                <span className="kpi-label">{kpi.label}</span>
                <strong>{kpi.value}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </header>
  );
}
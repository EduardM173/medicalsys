import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPatientAnnouncements, updatePatientMarketingPreferences, usePatientPromotion } from '../services/api';
import '../styles/announcements.css';

function date(value) {
  return value ? new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeZone: 'America/La_Paz' }).format(new Date(value)) : 'Sin límite';
}

function operationKey(campaignId, serviceId) {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `promo-${campaignId}-${serviceId}-${random}`;
}

export function AnnouncementsPage() {
  const { user } = useAuth();
  const patientId = user?.patientId;
  const [items, setItems] = useState([]);
  const [preferences, setPreferences] = useState({ subscribed: false, whatsappAuthorized: false });
  const [selectedServices, setSelectedServices] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState({ type: '', text: '' });

  async function load() {
    if (!patientId) { setNotice({ type: 'error', text: 'Esta cuenta no está vinculada a un paciente.' }); setLoading(false); return; }
    setLoading(true);
    try {
      const response = await getPatientAnnouncements(patientId);
      setItems(response.announcements || []);
      setPreferences(response.preferences || { subscribed: true, whatsappAuthorized: false });
      setNotice({ type: '', text: '' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'No fue posible cargar los anuncios.' });
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [patientId]);

  async function savePreferences(next) {
    setBusy('preferences');
    try {
      const saved = await updatePatientMarketingPreferences(patientId, next);
      setPreferences(saved);
      setNotice({ type: 'success', text: saved.subscribed ? 'Preferencias de comunicación guardadas.' : 'Quedaste excluido de comunicaciones promocionales.' });
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setBusy(''); }
  }

  async function useBenefit(campaign) {
    const serviceId = selectedServices[campaign.id] || campaign.services[0]?.id;
    if (!serviceId) { setNotice({ type: 'error', text: 'La campaña todavía no tiene un servicio asociado.' }); return; }
    setBusy(`campaign-${campaign.id}`);
    try {
      const result = await usePatientPromotion(patientId, campaign.id, { serviceId, operationKey: operationKey(campaign.id, serviceId) });
      setNotice({ type: 'success', text: `Beneficio registrado: Bs ${result.discountApplied} de descuento y ${result.pointsAwarded} puntos. Nivel actual: ${result.level}.` });
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setBusy(''); }
  }

  return <main className="announcements-page">
    <header className="announcements-hero">
      <div><span>BIENESTAR Y PREVENCIÓN</span><h1>Anuncios y beneficios para ti</h1><p>MedicalSys muestra únicamente campañas vigentes que coinciden con tu perfil.</p></div>
      <div className="marketing-preferences" aria-label="Preferencias de marketing">
        <label><input type="checkbox" checked={preferences.subscribed} disabled={busy === 'preferences'} onChange={(event) => savePreferences({ ...preferences, subscribed: event.target.checked, whatsappAuthorized: event.target.checked ? preferences.whatsappAuthorized : false })} /> Recibir promociones</label>
        <label><input type="checkbox" checked={preferences.whatsappAuthorized} disabled={!preferences.subscribed || busy === 'preferences'} onChange={(event) => savePreferences({ ...preferences, whatsappAuthorized: event.target.checked })} /> Autorizar WhatsApp</label>
      </div>
    </header>
    {notice.text && <p className={`notice ${notice.type === 'error' ? 'error-notice' : 'success-notice'}`} role="status">{notice.text}</p>}
    {loading ? <div className="announcement-empty">Cargando campañas...</div> : !items.length ? <div className="announcement-empty"><strong>No hay campañas disponibles para ti ahora.</strong><span>Cuando exista una promoción vigente y compatible con tu perfil aparecerá aquí.</span></div> :
      <section className="announcement-grid" aria-label="Campañas disponibles">{items.map((campaign) => <article className="announcement-card" key={campaign.id}>
        {campaign.imageUrl ? <img src={campaign.imageUrl} alt="" loading="lazy" /> : <div className="announcement-placeholder" aria-hidden="true">✦</div>}
        <div className="announcement-body">
          <div className="announcement-tags">{campaign.discountPercent > 0 && <span>{campaign.discountPercent}% descuento</span>}{campaign.points > 0 && <span>+{campaign.points} puntos</span>}</div>
          <h2>{campaign.title}</h2><p>{campaign.content}</p>
          <small>Vigente del {date(campaign.startsAt)} al {date(campaign.endsAt)}</small>
          {campaign.services.length > 0 && <><label className="service-label" htmlFor={`service-${campaign.id}`}>Aplicar en</label><select id={`service-${campaign.id}`} value={selectedServices[campaign.id] || campaign.services[0].id} onChange={(event) => setSelectedServices({ ...selectedServices, [campaign.id]: event.target.value })}>{campaign.services.map((service) => <option value={service.id} key={service.id}>{service.name} · Bs {service.price}</option>)}</select></>}
          <button type="button" disabled={!campaign.services.length || busy === `campaign-${campaign.id}`} onClick={() => useBenefit(campaign)}>{busy === `campaign-${campaign.id}` ? 'Registrando...' : 'Usar beneficio'}</button>
        </div>
      </article>)}</section>}
  </main>;
}

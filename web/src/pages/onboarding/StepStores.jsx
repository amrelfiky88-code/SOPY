import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useT } from '../../i18n/index.jsx';

export default function StepStores({ onNext, onBack }) {
  const t = useT();
  const { tenant } = useAuth();
  const [branches, setBranches] = useState([]);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const { branches } = await api.get('/tenants/branches');
      setBranches(branches);
    } catch (err) {
      setError(err.message);
    }
  };
  useEffect(() => { load(); }, []);

  const addBranch = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/tenants/branches', { name, city });
      setName('');
      setCity('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const removeBranch = async (id) => {
    setError('');
    try {
      await api.del(`/tenants/branches/${id}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h2>{t('onb.stores.title')}</h2>
      <p>{t('onb.stores.intro', { n: tenant?.branch_count ?? '' })}</p>

      {error && <div className="error-banner">{error}</div>}

      {branches.map((b) => (
        <div className="checklist-row" key={b.id}>
          <div><strong>{b.name}</strong>{b.city ? ` — ${b.city}` : ''}</div>
          <button className="btn btn-small btn-danger" onClick={() => removeBranch(b.id)}>{t('page.remove')}</button>
        </div>
      ))}

      <form onSubmit={addBranch} style={{ marginTop: 16 }}>
        <div className="field">
          <label htmlFor="branchName">{t('page.branchName')}</label>
          <input id="branchName" required value={name} onChange={(e) => setName(e.target.value)} placeholder={t('onb.stores.placeholder')} />
        </div>
        <div className="field">
          <label htmlFor="branchCity">{t('page.city')}</label>
          <input id="branchCity" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <button className="btn btn-secondary" type="submit" disabled={submitting}>{t('page.addBranch')}</button>
      </form>

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <button className="btn btn-secondary" onClick={onBack}>{t('page.back')}</button>
        <button className="btn btn-primary" onClick={onNext} disabled={branches.length === 0}>
          {t('common.continue')}
        </button>
      </div>
      {branches.length === 0 && <p className="hint">{t('onb.stores.needOne')}</p>}
    </div>
  );
}

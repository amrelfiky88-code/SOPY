import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useT } from '../i18n/index.jsx';

// Names are business.* in i18n/pageLabels.js.
const BUSINESS_TYPES = ['restaurant', 'cafe', 'quick_service', 'bar', 'cloud_kitchen', 'hotel_fb'];

export default function ConfigureData() {
  const t = useT();
  const { tenant, setTenant } = useAuth();
  const navigate = useNavigate();
  const [branchCount, setBranchCount] = useState(tenant?.branch_count || 1);
  const [userCount, setUserCount] = useState(tenant?.user_count || 1);
  const [businessType, setBusinessType] = useState('restaurant');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { tenant: updated } = await api.patch('/tenants/current', {
        branchCount: Number(branchCount),
        userCount: Number(userCount),
        businessType,
        onboardingStep: 'pricing',
      });
      setTenant(updated);
      navigate('/pricing');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="screen-narrow">
      <div className="stepper">
        <div className="dot done" /><div className="dot done" /><div className="dot" /><div className="dot" /><div className="dot" />
      </div>
      <h2>{t('configure.title')}</h2>
      <p>{t('configure.intro')}</p>

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="branchCount">{t('page.numBranches')}</label>
          <input id="branchCount" type="number" min={1} required value={branchCount} onChange={(e) => setBranchCount(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="userCount">{t('page.numUsers')}</label>
          <input id="userCount" type="number" min={1} required value={userCount} onChange={(e) => setUserCount(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="businessType">{t('configure.businessType')}</label>
          <select id="businessType" value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
            {BUSINESS_TYPES.map((type) => <option key={type} value={type}>{t(`business.${type}`)}</option>)}
          </select>
        </div>

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? t('common.saving') : t('configure.seePrice')}
        </button>
      </form>
    </div>
  );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';

const BUSINESS_TYPES = [
  { value: 'restaurant', label: 'Full-service restaurant' },
  { value: 'cafe', label: 'Café / coffee shop' },
  { value: 'quick_service', label: 'Quick-service / fast casual' },
  { value: 'bar', label: 'Bar / pub' },
  { value: 'cloud_kitchen', label: 'Cloud / delivery-only kitchen' },
  { value: 'hotel_fb', label: 'Hotel food & beverage' },
];

export default function ConfigureData() {
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
      <h2>Configure your data</h2>
      <p>Confirm the numbers we'll use to set up your account and your plan.</p>

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="branchCount">Number of branches</label>
          <input id="branchCount" type="number" min={1} required value={branchCount} onChange={(e) => setBranchCount(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="userCount">Number of users</label>
          <input id="userCount" type="number" min={1} required value={userCount} onChange={(e) => setUserCount(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="businessType">Business type</label>
          <select id="businessType" value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
            {BUSINESS_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'See your price'}
        </button>
      </form>
    </div>
  );
}

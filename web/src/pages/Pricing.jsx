import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { calculatePricing } from '../../../shared/pricing.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api.js';

export default function Pricing() {
  const { tenant, setTenant } = useAuth();
  const navigate = useNavigate();
  const [branches, setBranches] = useState(tenant?.branch_count || 1);
  const [users, setUsers] = useState(tenant?.user_count || 1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const pricing = useMemo(() => calculatePricing({ branches, users }), [branches, users]);

  const handleContinue = async () => {
    setError('');
    setSubmitting(true);
    try {
      const { tenant: updated } = await api.patch('/tenants/current', {
        branchCount: Number(branches),
        userCount: Number(users),
        onboardingStep: 'checkout',
      });
      setTenant(updated);
      navigate('/checkout');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="screen-narrow">
      <div className="stepper">
        <div className="dot done" /><div className="dot done" /><div className="dot done" /><div className="dot" /><div className="dot" />
      </div>
      <h2>Your plan</h2>
      <p>Pricing tapers down as you add branches and users — pay for what you run.</p>

      {error && <div className="error-banner">{error}</div>}

      <div className="field">
        <label htmlFor="branches">Branches: {branches}</label>
        <input id="branches" type="range" min={1} max={50} value={branches} onChange={(e) => setBranches(Number(e.target.value))} />
        <input type="number" min={1} value={branches} onChange={(e) => setBranches(Number(e.target.value) || 0)} style={{ marginTop: 8 }} />
      </div>
      <div className="field">
        <label htmlFor="users">Users: {users}</label>
        <input id="users" type="range" min={1} max={100} value={users} onChange={(e) => setUsers(Number(e.target.value))} />
        <input type="number" min={1} value={users} onChange={(e) => setUsers(Number(e.target.value) || 0)} style={{ marginTop: 8 }} />
      </div>

      <div className="card">
        <table>
          <tbody>
            <tr>
              <td>Branches ({pricing.branchCount} × ~${pricing.branchBlendedRate.toFixed(2)} avg)</td>
              <td style={{ textAlign: 'right' }}>${pricing.branchSubtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Users ({pricing.userCount} × ~${pricing.userBlendedRate.toFixed(2)} avg)</td>
              <td style={{ textAlign: 'right' }}>${pricing.userSubtotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
          <strong>Monthly total</strong>
          <strong style={{ fontSize: 22 }}>${pricing.monthlyTotal.toFixed(2)}</strong>
        </div>
      </div>

      <p className="hint" style={{ fontSize: 13 }}>
        First branch is $10/mo, tapering to $7/mo at volume. First user is $9/mo, tapering to $5/mo at volume.
      </p>

      <button className="btn btn-primary" onClick={handleContinue} disabled={submitting}>
        {submitting ? 'Saving…' : 'Continue to checkout'}
      </button>
    </div>
  );
}

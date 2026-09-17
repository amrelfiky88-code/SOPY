import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { calculatePricing, PLAN_LIMITS, clampPlanCount } from '../../../shared/pricing.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api.js';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function Pricing() {
  const { tenant, setTenant } = useAuth();
  const navigate = useNavigate();
  const [branches, setBranches] = useState(() => clampPlanCount(tenant?.branch_count ?? 1, PLAN_LIMITS.branches));
  const [users, setUsers] = useState(() => clampPlanCount(tenant?.user_count ?? 1, PLAN_LIMITS.users));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const pricing = useMemo(() => calculatePricing({ branches, users }), [branches, users]);

  const handleContinue = async () => {
    setError('');
    setSubmitting(true);
    try {
      // The count fields can sit empty mid-edit, so clamp once more here
      // rather than sending '' and relying on the server to interpret it.
      const { tenant: updated } = await api.patch('/tenants/current', {
        branchCount: clampPlanCount(branches, PLAN_LIMITS.branches) ?? PLAN_LIMITS.branches.min,
        userCount: clampPlanCount(users, PLAN_LIMITS.users) ?? PLAN_LIMITS.users.min,
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

      <QuantityField
        id="branches"
        label="Branches"
        value={branches}
        onChange={setBranches}
        limits={PLAN_LIMITS.branches}
        sliderMax={50}
      />
      <QuantityField
        id="users"
        label="Users"
        value={users}
        onChange={setUsers}
        limits={PLAN_LIMITS.users}
        sliderMax={100}
      />

      <div className="card">
        <div className="summary-row">
          <span>
            Branches
            <span className="hint"> {pricing.branchCount} × {money(pricing.branchBlendedRate)} avg</span>
          </span>
          <span>{money(pricing.branchSubtotal)}</span>
        </div>
        <div className="summary-row">
          <span>
            Users
            <span className="hint"> {pricing.userCount} × {money(pricing.userBlendedRate)} avg</span>
          </span>
          <span>{money(pricing.userSubtotal)}</span>
        </div>
        <div className="summary-row summary-total">
          <span>Monthly total</span>
          <span>{money(pricing.monthlyTotal)}</span>
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

// Slider for a quick sweep, plus a −/+ stepper that stays usable with a
// fingertip and can't be pushed outside the plan limits.
function QuantityField({ id, label, value, onChange, limits, sliderMax }) {
  const commit = (next) => {
    const clamped = clampPlanCount(next, limits);
    if (clamped !== null) onChange(clamped);
  };

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="qty-stepper">
        <button
          type="button"
          onClick={() => commit(value - 1)}
          disabled={value <= limits.min}
          aria-label={`One fewer ${label.toLowerCase()}`}
        >
          −
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={limits.min}
          max={limits.max}
          value={value}
          onChange={(e) => {
            // Let the field go empty mid-edit; clamp on blur instead of
            // fighting the keyboard on every keystroke.
            if (e.target.value === '') return onChange('');
            commit(e.target.value);
          }}
          onBlur={(e) => commit(e.target.value === '' ? limits.min : e.target.value)}
        />
        <button
          type="button"
          onClick={() => commit(Number(value || 0) + 1)}
          disabled={value >= limits.max}
          aria-label={`One more ${label.toLowerCase()}`}
        >
          +
        </button>
      </div>
      <input
        type="range"
        className="qty-range"
        min={limits.min}
        max={sliderMax}
        value={Math.min(Number(value) || limits.min, sliderMax)}
        onChange={(e) => commit(e.target.value)}
        aria-label={`${label} slider`}
      />
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { calculatePricing, PLAN_LIMITS, clampPlanCount } from '../../../shared/pricing.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useT } from '../i18n/index.jsx';
import { money } from '../i18n/pageLabels.js';
import { api } from '../api.js';
import QuantityField from '../components/QuantityField.jsx';

export default function Pricing() {
  const t = useT();
  const { tenant, setTenant } = useAuth();
  const navigate = useNavigate();
  const [branches, setBranches] = useState(() => clampPlanCount(tenant?.branch_count ?? 1, PLAN_LIMITS.branches));
  const [users, setUsers] = useState(() => clampPlanCount(tenant?.user_count ?? 1, PLAN_LIMITS.users));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // An emptied box mid-edit is priced at the minimum — the plan that will
  // actually be saved — rather than as if it were free.
  const pricing = useMemo(() => calculatePricing({
    branches: clampPlanCount(branches, PLAN_LIMITS.branches) ?? PLAN_LIMITS.branches.min,
    users: clampPlanCount(users, PLAN_LIMITS.users) ?? PLAN_LIMITS.users.min,
  }), [branches, users]);

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
      <h2>{t('pricing.title')}</h2>
      <p>{t('pricing.intro')}</p>

      {error && <div className="error-banner">{error}</div>}

      <QuantityField
        id="branches"
        label={t('page.branchesLabel')}
        value={branches}
        onChange={setBranches}
        limits={PLAN_LIMITS.branches}
        sliderMax={50}
      />
      <QuantityField
        id="users"
        label={t('page.usersLabel')}
        value={users}
        onChange={setUsers}
        limits={PLAN_LIMITS.users}
        sliderMax={100}
      />

      <div className="card">
        <div className="summary-row">
          <span>
            {t('page.branchesLabel')}
            <span className="hint"> {t('page.avgRate', { n: pricing.branchCount, rate: money(pricing.branchBlendedRate) })}</span>
          </span>
          <span>{money(pricing.branchSubtotal)}</span>
        </div>
        <div className="summary-row">
          <span>
            {t('page.usersLabel')}
            <span className="hint"> {t('page.avgRate', { n: pricing.userCount, rate: money(pricing.userBlendedRate) })}</span>
          </span>
          <span>{money(pricing.userSubtotal)}</span>
        </div>
        <div className="summary-row summary-total">
          <span>{t('pricing.monthlyTotal')}</span>
          <span>{money(pricing.monthlyTotal)}</span>
        </div>
      </div>

      <p className="hint" style={{ fontSize: 13 }}>{t('pricing.rates')}</p>

      <button className="btn btn-primary" onClick={handleContinue} disabled={submitting}>
        {submitting ? t('common.saving') : t('pricing.continue')}
      </button>
    </div>
  );
}

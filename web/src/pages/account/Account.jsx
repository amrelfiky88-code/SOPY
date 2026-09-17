import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { calculatePricing, PLAN_LIMITS, clampPlanCount } from '../../../../shared/pricing.js';
import QuantityField from '../../components/QuantityField.jsx';
import { LabeledInput } from '../forms/OpsFormParts.jsx';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

const STATUS_PILL = {
  active: 'pill-green',
  pending: 'pill-amber',
  past_due: 'pill-red',
  canceled: 'pill-red',
};

const STATUS_LABEL = {
  active: 'Active',
  pending: 'Awaiting payment',
  past_due: 'Payment overdue',
  canceled: 'Canceled',
};

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;

export default function Account() {
  const { user, tenant, setUser } = useAuth();

  return (
    <div>
      <h2>Profile &amp; billing</h2>
      <ProfileCard user={user} tenant={tenant} setUser={setUser} />
      <SubscriptionCard user={user} tenant={tenant} />
    </div>
  );
}

function ProfileCard({ user, tenant, setUser }) {
  const [form, setForm] = useState({ fullName: '', title: '', phone: '' });
  const [status, setStatus] = useState('idle'); // idle | saving | saved
  const [error, setError] = useState('');

  useEffect(() => {
    setForm({ fullName: user?.fullName || '', title: user?.title || '', phone: user?.phone || '' });
  }, [user]);

  const set = (key, value) => { setForm((f) => ({ ...f, [key]: value })); setStatus('idle'); };

  const save = async () => {
    setError('');
    setStatus('saving');
    try {
      const { user: updated } = await api.patch('/auth/me', form);
      setUser?.(updated);
      setStatus('saved');
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  };

  return (
    <div className="card">
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Your profile</h3>
      {error && <div className="error-banner">{error}</div>}

      <div className="form-grid-2col">
        <LabeledInput label="Full name" value={form.fullName} onChange={(v) => set('fullName', v)} />
        <LabeledInput label="Job title" value={form.title} onChange={(v) => set('title', v)} />
        <LabeledInput label="Phone" type="tel" value={form.phone} onChange={(v) => set('phone', v)} />
      </div>

      <div className="summary-row">
        <span>Email</span>
        <span>{user?.email}</span>
      </div>
      <div className="summary-row">
        <span>Role</span>
        <span>{roleLabel(user?.role)}</span>
      </div>
      <div className="summary-row">
        <span>Restaurant</span>
        <span>{tenant?.restaurant_name}</span>
      </div>
      <p className="hint">Your email is how you sign in — contact support if you need it changed.</p>

      <button className="btn btn-primary" onClick={save} disabled={status === 'saving' || !form.fullName.trim()}>
        {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save profile'}
      </button>
    </div>
  );
}

function SubscriptionCard({ user, tenant }) {
  const isOwner = user?.role === 'business_owner';
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [branches, setBranches] = useState(1);
  const [users, setUsers] = useState(1);
  const [saving, setSaving] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const load = async () => {
    setError('');
    try {
      const { subscription: sub } = await api.get('/billing/subscription');
      setSubscription(sub);
      setBranches(clampPlanCount(sub?.branch_count ?? tenant?.branch_count ?? 1, PLAN_LIMITS.branches));
      setUsers(clampPlanCount(sub?.user_count ?? tenant?.user_count ?? 1, PLAN_LIMITS.users));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const preview = useMemo(() => calculatePricing({ branches, users }), [branches, users]);
  const currentTotal = Number(subscription?.monthly_total || 0);
  const difference = preview.monthlyTotal - currentTotal;

  const saveQuantities = async () => {
    setError('');
    setSaving(true);
    try {
      const { subscription: updated } = await api.patch('/billing/subscription/quantities', {
        branchCount: clampPlanCount(branches, PLAN_LIMITS.branches) ?? PLAN_LIMITS.branches.min,
        userCount: clampPlanCount(users, PLAN_LIMITS.users) ?? PLAN_LIMITS.users.min,
      });
      setSubscription(updated);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    setError('');
    setSaving(true);
    try {
      await api.post('/billing/subscription/cancel', {});
      setConfirmingCancel(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="card"><p style={{ margin: 0 }}>Loading your plan…</p></div>;

  if (!subscription) {
    return (
      <div className="card">
        <h3 style={{ fontSize: 16, marginBottom: 8 }}>Subscription</h3>
        <p style={{ margin: 0 }}>No subscription on this account yet.</p>
        {error && <div className="error-banner" style={{ marginTop: 12 }}>{error}</div>}
      </div>
    );
  }

  const renewal = formatDate(subscription.current_period_end);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, margin: 0 }}>Subscription</h3>
        <span className={`pill ${STATUS_PILL[subscription.status] || ''}`}>
          {STATUS_LABEL[subscription.status] || subscription.status}
        </span>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {editing ? (
        <>
          <QuantityField
            id="acct-branches"
            label="Branches"
            value={branches}
            onChange={setBranches}
            limits={PLAN_LIMITS.branches}
            sliderMax={50}
          />
          <QuantityField
            id="acct-users"
            label="Users"
            value={users}
            onChange={setUsers}
            limits={PLAN_LIMITS.users}
            sliderMax={100}
          />

          <div className="summary-row summary-total">
            <span>New monthly total</span>
            <span>{money(preview.monthlyTotal)}</span>
          </div>
          <p className="hint">
            {difference === 0
              ? 'Same as your current plan.'
              : `${difference > 0 ? 'Up' : 'Down'} ${money(Math.abs(difference))} from ${money(currentTotal)} a month. We'll prorate the difference on your next invoice.`}
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-small" onClick={saveQuantities} disabled={saving}>
              {saving ? 'Saving…' : 'Save plan'}
            </button>
            <button
              className="btn btn-secondary btn-small"
              onClick={() => {
                setBranches(clampPlanCount(subscription.branch_count, PLAN_LIMITS.branches));
                setUsers(clampPlanCount(subscription.user_count, PLAN_LIMITS.users));
                setEditing(false);
              }}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="summary-row">
            <span>
              Branches
              <span className="hint"> {subscription.branch_count} × {money(subscription.branch_rate)} avg</span>
            </span>
            <span>{money(Number(subscription.branch_count) * Number(subscription.branch_rate))}</span>
          </div>
          <div className="summary-row">
            <span>
              Users
              <span className="hint"> {subscription.user_count} × {money(subscription.user_rate)} avg</span>
            </span>
            <span>{money(Number(subscription.user_count) * Number(subscription.user_rate))}</span>
          </div>
          <div className="summary-row summary-total">
            <span>Billed monthly</span>
            <span>{money(subscription.monthly_total)}</span>
          </div>

          <p className="hint">
            {subscription.status === 'canceled'
              ? 'This subscription is canceled.'
              : renewal
                ? `Renews ${renewal}.`
                : 'Renews monthly.'}
          </p>

          {isOwner && subscription.status !== 'canceled' && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
              <button className="btn btn-secondary btn-small" onClick={() => setEditing(true)}>Change plan</button>
              {confirmingCancel ? (
                <>
                  <button className="btn btn-danger btn-small" onClick={cancel} disabled={saving}>
                    {saving ? 'Canceling…' : 'Yes, cancel subscription'}
                  </button>
                  <button className="btn btn-secondary btn-small" onClick={() => setConfirmingCancel(false)} disabled={saving}>
                    Keep it
                  </button>
                </>
              ) : (
                <button className="btn btn-secondary btn-small" onClick={() => setConfirmingCancel(true)}>
                  Cancel subscription
                </button>
              )}
            </div>
          )}
          {confirmingCancel && (
            <p className="hint">Your team keeps access until the end of the current billing period.</p>
          )}
          {!isOwner && <p className="hint">Only the business owner can change or cancel the plan.</p>}
        </>
      )}
    </div>
  );
}

function roleLabel(role) {
  return {
    business_owner: 'Business Owner',
    operations_manager: 'Operations Manager',
    area_manager: 'Area Manager',
    store_manager: 'Store Manager',
    employee: 'Employee',
  }[role] || role;
}

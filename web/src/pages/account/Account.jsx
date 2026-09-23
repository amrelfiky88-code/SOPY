import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { calculatePricing, PLAN_LIMITS, clampPlanCount } from '../../../../shared/pricing.js';
import QuantityField from '../../components/QuantityField.jsx';
import { LabeledInput } from '../forms/OpsFormParts.jsx';
import { LANGUAGES } from '../../../../shared/languages.js';
import { useI18n } from '../../i18n/index.jsx';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

const STATUS_PILL = {
  active: 'pill-green',
  pending: 'pill-amber',
  past_due: 'pill-red',
  canceled: 'pill-red',
};

const STATUS_LABEL = {
  active: 'account.statusActive',
  pending: 'account.statusPending',
  past_due: 'account.statusPastDue',
  canceled: 'account.statusCanceled',
};

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;

export default function Account() {
  const { user, tenant, setUser } = useAuth();
  const { t } = useI18n();

  return (
    <div>
      <h2>{t('account.title')}</h2>
      <ProfileCard user={user} tenant={tenant} setUser={setUser} />
      <SubscriptionCard user={user} tenant={tenant} />
    </div>
  );
}

// Applies immediately on change rather than waiting for "Save profile" —
// a language picker that needs a second confirming click feels broken,
// and the save is a single field the server can take on its own.
function LanguageField({ user, setUser }) {
  const { t, lang, setLang } = useI18n();
  const [error, setError] = useState('');

  const change = async (next) => {
    const previous = lang;
    setError('');
    setLang(next);
    try {
      const { user: updated } = await api.patch('/auth/me', { language: next });
      setUser?.(updated);
    } catch (err) {
      setLang(previous); // roll back so the UI can't disagree with the saved profile
      setError(err.message);
    }
  };

  return (
    <div className="field">
      <label htmlFor="acct-language">{t('account.language')}</label>
      <select id="acct-language" value={lang} onChange={(e) => change(e.target.value)}>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.nativeLabel}{l.nativeLabel !== l.label ? ` — ${l.label}` : ''}
          </option>
        ))}
      </select>
      <p className="hint">{t('account.languageNote')}</p>
      {error && <div className="error-banner" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}

function ProfileCard({ user, tenant, setUser }) {
  const { t } = useI18n();
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
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>{t('account.yourProfile')}</h3>
      {error && <div className="error-banner">{error}</div>}

      <div className="form-grid-2col">
        <LabeledInput label={t('account.fullName')} value={form.fullName} onChange={(v) => set('fullName', v)} />
        <LabeledInput label={t('account.jobTitle')} value={form.title} onChange={(v) => set('title', v)} />
        <LabeledInput label={t('account.phone')} type="tel" value={form.phone} onChange={(v) => set('phone', v)} />
      </div>

      <LanguageField user={user} setUser={setUser} />

      <div className="summary-row">
        <span>{t('account.email')}</span>
        <span>{user?.email}</span>
      </div>
      <div className="summary-row">
        <span>{t('account.role')}</span>
        <span>{t(`role.${user?.role}`)}</span>
      </div>
      <div className="summary-row">
        <span>{t('account.restaurant')}</span>
        <span>{tenant?.restaurant_name}</span>
      </div>
      <p className="hint">{t('account.emailNote')}</p>

      <button className="btn btn-primary" onClick={save} disabled={status === 'saving' || !form.fullName.trim()}>
        {status === 'saving' ? t('common.saving') : status === 'saved' ? t('common.saved') : t('account.saveProfile')}
      </button>
      {/* Without this the button just sits there greyed out with no reason given. */}
      {!form.fullName.trim() && <p className="hint">{t('account.nameRequired')}</p>}
    </div>
  );
}

function SubscriptionCard({ user, tenant }) {
  const { t } = useI18n();
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

  if (loading) return <div className="card"><p style={{ margin: 0 }}>{t('account.loadingPlan')}</p></div>;

  if (!subscription) {
    return (
      <div className="card">
        <h3 style={{ fontSize: 16, marginBottom: 8 }}>{t('account.subscription')}</h3>
        <p style={{ margin: 0 }}>{t('account.noSubscription')}</p>
        {error && <div className="error-banner" style={{ marginTop: 12 }}>{error}</div>}
        {isOwner ? (
          <Link to="/checkout" className="btn btn-primary" style={{ marginTop: 14, width: '100%' }}>
            {t('account.choosePlan')}
          </Link>
        ) : (
          <p className="hint" style={{ marginTop: 10 }}>{t('account.ownerOnly')}</p>
        )}
      </div>
    );
  }

  const renewal = formatDate(subscription.current_period_end);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, margin: 0 }}>{t('account.subscription')}</h3>
        <span className={`pill ${STATUS_PILL[subscription.status] || ''}`}>
          {STATUS_LABEL[subscription.status] ? t(STATUS_LABEL[subscription.status]) : subscription.status}
        </span>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {editing ? (
        <>
          <QuantityField
            id="acct-branches"
            label={t('account.branches')}
            value={branches}
            onChange={setBranches}
            limits={PLAN_LIMITS.branches}
            sliderMax={50}
          />
          <QuantityField
            id="acct-users"
            label={t('account.users')}
            value={users}
            onChange={setUsers}
            limits={PLAN_LIMITS.users}
            sliderMax={100}
          />

          <div className="summary-row summary-total">
            <span>{t('account.newMonthlyTotal')}</span>
            <span>{money(preview.monthlyTotal)}</span>
          </div>
          <p className="hint">
            {difference === 0
              ? t('account.planUnchanged')
              : t(difference > 0 ? 'account.planUp' : 'account.planDown', {
                  amount: money(Math.abs(difference)),
                  current: money(currentTotal),
                })}
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-small" onClick={saveQuantities} disabled={saving}>
              {saving ? t('common.saving') : t('account.savePlan')}
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
              {t('common.cancel')}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="summary-row">
            <span>
              {t('account.branches')}
              <span className="hint"> {subscription.branch_count} × {money(subscription.branch_rate)}</span>
            </span>
            <span>{money(Number(subscription.branch_count) * Number(subscription.branch_rate))}</span>
          </div>
          <div className="summary-row">
            <span>
              {t('account.users')}
              <span className="hint"> {subscription.user_count} × {money(subscription.user_rate)}</span>
            </span>
            <span>{money(Number(subscription.user_count) * Number(subscription.user_rate))}</span>
          </div>
          <div className="summary-row summary-total">
            <span>{t('account.billedMonthly')}</span>
            <span>{money(subscription.monthly_total)}</span>
          </div>

          <p className="hint">
            {subscription.status === 'canceled'
              ? (renewal ? t('account.canceledUntil', { date: renewal }) : t('account.isCanceled'))
              : subscription.status === 'pending'
                ? t('account.pendingNote')
                : subscription.status === 'past_due'
                  ? t('account.pastDueNote')
                  : renewal
                    ? t('account.renewsOn', { date: renewal })
                    : t('account.renewsMonthly')}
          </p>

          {/* A checkout that was started but never paid: changing or
              canceling it failed with "No active subscription". */}
          {isOwner && subscription.status === 'pending' && (
            <Link to="/checkout" className="btn btn-primary" style={{ marginTop: 4, width: '100%' }}>
              {t('account.finishPayment')}
            </Link>
          )}

          {isOwner && (subscription.status === 'active' || subscription.status === 'past_due') && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
              <button className="btn btn-secondary btn-small" onClick={() => setEditing(true)}>{t('account.changePlan')}</button>
              {confirmingCancel ? (
                <>
                  <button className="btn btn-danger btn-small" onClick={cancel} disabled={saving}>
                    {saving ? t('common.saving') : t('account.confirmCancel')}
                  </button>
                  <button className="btn btn-secondary btn-small" onClick={() => setConfirmingCancel(false)} disabled={saving}>
                    {t('account.keepIt')}
                  </button>
                </>
              ) : (
                <button className="btn btn-secondary btn-small" onClick={() => setConfirmingCancel(true)}>
                  {t('account.cancelSubscription')}
                </button>
              )}
            </div>
          )}
          {isOwner && subscription.status === 'canceled' && (
            <Link to="/checkout" className="btn btn-primary" style={{ marginTop: 4, width: '100%' }}>
              {t('account.resubscribe')}
            </Link>
          )}
          {confirmingCancel && <p className="hint">{t('account.cancelNote')}</p>}
          {!isOwner && <p className="hint">{t('account.ownerOnly')}</p>}
        </>
      )}
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { calculatePricing, PLAN_LIMITS, clampPlanCount } from '../../../../shared/pricing.js';
import QuantityField from '../../components/QuantityField.jsx';
import ReferralCard from './ReferralCard.jsx';
import { LabeledInput } from '../forms/OpsFormParts.jsx';
import { LANGUAGES } from '../../../../shared/languages.js';
import { useI18n } from '../../i18n/index.jsx';
import { money, egp } from '../../i18n/pageLabels.js';
import { paymobReturnParams } from '../../lib/paymentRegion.js';
import JobTitleSelect from '../../components/JobTitleSelect.jsx';

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

// In the app's language, not the phone's: an Arabic page said "Oct 25, 2026".
const formatDate = (value, lang) =>
  value ? new Date(value).toLocaleDateString(lang || undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;

export default function Account() {
  const { user, tenant, setUser } = useAuth();
  const { t } = useI18n();

  return (
    <div>
      <h2>{t('account.title')}</h2>
      <ProfileCard user={user} tenant={tenant} setUser={setUser} />
      <PasswordCard />
      <SubscriptionCard user={user} tenant={tenant} />
      {user?.role === 'business_owner' && <ReferralCard />}
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

// There was no way to change a password at all. Changing it signs out
// every other device; this one gets a fresh session.
function PasswordCard() {
  const { t } = useI18n();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [status, setStatus] = useState('idle'); // idle | saving | saved
  const [error, setError] = useState('');
  const set = (key) => (e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setStatus('idle'); setError(''); };

  const mismatch = form.confirm && form.next !== form.confirm;
  const canSave = form.current && form.next.length >= 8 && form.next === form.confirm && status !== 'saving';

  const save = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setError('');
    setStatus('saving');
    try {
      const { token } = await api.patch('/auth/password', { currentPassword: form.current, newPassword: form.next });
      setToken(token);
      setForm({ current: '', next: '', confirm: '' });
      setStatus('saved');
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  };

  return (
    <form className="card" onSubmit={save}>
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>{t('account.password')}</h3>
      {error && <div className="error-banner">{error}</div>}
      {status === 'saved' && <div className="success-banner" role="status">{t('account.passwordChanged')}</div>}
      <div className="field">
        <label htmlFor="pw-current">{t('account.currentPassword')}</label>
        <input id="pw-current" type="password" autoComplete="current-password" value={form.current} onChange={set('current')} />
      </div>
      <div className="field">
        <label htmlFor="pw-new">{t('account.newPassword')}</label>
        <input id="pw-new" type="password" autoComplete="new-password" minLength={8} value={form.next} onChange={set('next')} />
        <div className="hint">{t('account.passwordHint')}</div>
      </div>
      <div className="field">
        <label htmlFor="pw-confirm">{t('account.confirmPassword')}</label>
        <input id="pw-confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
        {mismatch && <div className="error">{t('account.passwordMismatch')}</div>}
      </div>
      <button className="btn btn-primary" type="submit" disabled={!canSave}>
        {status === 'saving' ? t('common.saving') : t('account.changePassword')}
      </button>
    </form>
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
        <div className="field">
          <label htmlFor="profile-title">{t('account.jobTitle')}</label>
          <JobTitleSelect id="profile-title" value={form.title} onChange={(v) => set('title', v)} />
        </div>
        <LabeledInput label={t('account.phone')} type="tel" value={form.phone} onChange={(v) => set('phone', v)} />
      </div>

      <LanguageField user={user} setUser={setUser} />

      <div className="summary-row">
        <span>{t('account.email')}</span>
        <span className="summary-wrap" dir="ltr">{user?.email}</span>
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
  const { t, lang } = useI18n();
  const isOwner = user?.role === 'business_owner';
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [branches, setBranches] = useState(1);
  const [users, setUsers] = useState(1);
  const [saving, setSaving] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [notice, setNotice] = useState('');
  // A bigger Paymob plan waiting to be paid ({ checkoutUrl, amountEgp }).
  const [upgradePay, setUpgradePay] = useState(null);
  const navigate = useNavigate();

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

  useEffect(() => {
    // Back from paying on Paymob (next month, or a bigger plan): the signed
    // result is in the address. Check it, then take it out of the address.
    const params = paymobReturnParams(window.location.search);
    if (!params) { load(); return; }
    navigate('/app/account', { replace: true });
    (async () => {
      try {
        const result = await api.post('/billing/paymob/return', params);
        if (result.paid) setNotice(t('account.paymobPaid'));
        else setError(t('checkout.paymobFailed'));
      } catch (err) {
        setError(err.message);
      }
      await load();
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const preview = useMemo(() => calculatePricing({
    branches: clampPlanCount(branches, PLAN_LIMITS.branches) ?? PLAN_LIMITS.branches.min,
    users: clampPlanCount(users, PLAN_LIMITS.users) ?? PLAN_LIMITS.users.min,
  }), [branches, users]);
  // A changed plan needs a fresh Paymob amount.
  useEffect(() => { setUpgradePay(null); }, [branches, users]);
  const currentTotal = Number(subscription?.monthly_total || 0);
  const difference = preview.monthlyTotal - currentTotal;

  const saveQuantities = async () => {
    setError('');
    setSaving(true);
    try {
      const res = await api.patch('/billing/subscription/quantities', {
        branchCount: clampPlanCount(branches, PLAN_LIMITS.branches) ?? PLAN_LIMITS.branches.min,
        userCount: clampPlanCount(users, PLAN_LIMITS.users) ?? PLAN_LIMITS.users.min,
      });
      // Paymob: the bigger plan is paid for (the rest of this month) first.
      if (res.paymentRequired && res.paymob) { setUpgradePay(res.paymob); return; }
      setSubscription(res.subscription);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Paymob plans are paid a month at a time.
  const payNextMonth = async () => {
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const res = await api.post('/billing/paymob/renew', {});
      if (res.paymob) { window.location.assign(res.paymob.checkoutUrl); return; }
      setNotice(t('account.paymobPaid'));
      await load();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
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

  const resume = async () => {
    setError('');
    setSaving(true);
    try {
      await api.post('/billing/subscription/resume', {});
      await load();
    } catch (err) {
      setError(err.message);
      // The period ran out meanwhile: show the checkout route instead.
      if (err.status === 409) await load();
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

  const renewal = formatDate(subscription.current_period_end, lang);
  const stillPaid = subscription.current_period_end && new Date(subscription.current_period_end) > new Date();
  // The tapered subtotals, as billed. count × rounded average rate drifted
  // from the total by a few cents (7 stores: 7 × $8.43 = $59.01 vs $59.00).
  const today = calculatePricing({ branches: subscription.branch_count, users: subscription.user_count });
  // A plan bought before a price change is still billed at the rates it
  // was bought at; today's rates would list lines that don't add up to it.
  const cents = (n) => Math.round(n * 100) / 100;
  const current = Number(today.monthlyTotal) === Number(subscription.monthly_total) ? today : {
    branchBlendedRate: Number(subscription.branch_rate),
    userBlendedRate: Number(subscription.user_rate),
    branchSubtotal: cents(subscription.branch_count * subscription.branch_rate),
    userSubtotal: cents(subscription.user_count * subscription.user_rate),
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, margin: 0 }}>{t('account.subscription')}</h3>
        <span className={`pill ${STATUS_PILL[subscription.status] || ''}`}>
          {STATUS_LABEL[subscription.status] ? t(STATUS_LABEL[subscription.status]) : subscription.status}
        </span>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}

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
              : t(difference > 0 ? (subscription.provider === 'paymob' ? 'account.planUpPaymob' : 'account.planUp') : 'account.planDown', {
                  amount: money(Math.abs(difference)),
                  current: money(currentTotal),
                })}
          </p>

          {upgradePay && (
            <>
              <p className="hint">{t('account.paymobUpgrade', { amount: egp(upgradePay.amountEgp) })}</p>
              <button className="btn btn-primary" style={{ width: '100%', marginBottom: 10 }} onClick={() => window.location.assign(upgradePay.checkoutUrl)}>
                {t('checkout.payPaymob', { amount: egp(upgradePay.amountEgp) })}
              </button>
            </>
          )}

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
              <span className="hint"> {t('page.avgRate', { n: subscription.branch_count, rate: money(current.branchBlendedRate) })}</span>
            </span>
            <span>{money(current.branchSubtotal)}</span>
          </div>
          <div className="summary-row">
            <span>
              {t('account.users')}
              <span className="hint"> {t('page.avgRate', { n: subscription.user_count, rate: money(current.userBlendedRate) })}</span>
            </span>
            <span>{money(current.userSubtotal)}</span>
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
                  : subscription.provider === 'paymob' && renewal
                    ? t(stillPaid ? 'account.paidUntil' : 'account.paymobEnded', { date: renewal })
                    : renewal
                      ? t('account.renewsOn', { date: renewal })
                      : t('account.renewsMonthly')}
          </p>

          {isOwner && subscription.provider === 'paymob' && subscription.status === 'active' && subscription.paymob && (
            <button className="btn btn-primary" style={{ marginTop: 4, marginBottom: 10, width: '100%' }} onClick={payNextMonth} disabled={saving}>
              {saving ? t('common.saving') : t('account.payNextMonth', { amount: egp(subscription.paymob.renewalEgp) })}
            </button>
          )}

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
          {/* Still inside the paid period: take the cancel back. Going through
              checkout here charged a new month on top of the paid one. */}
          {isOwner && subscription.status === 'canceled' && stillPaid && (
            <>
              <button className="btn btn-primary" style={{ marginTop: 4, width: '100%' }} onClick={resume} disabled={saving}>
                {saving ? t('common.saving') : t('account.resume')}
              </button>
              <p className="hint">{t('account.resumeNote', { date: renewal })}</p>
            </>
          )}
          {isOwner && subscription.status === 'canceled' && !stillPaid && (
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

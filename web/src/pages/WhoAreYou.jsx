import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';
import { REFERRAL_WELCOME_USD } from '../../../shared/referrals.js';
import { countryOptions } from '../../../shared/countries.js';
import JobTitleSelect from '../components/JobTitleSelect.jsx';
import Logo from '../components/Logo.jsx';

// The code from a referral link (?ref=… now, or saved by main.jsx when the
// link was opened within the last 30 days).
function readReferralCode() {
  const fromUrl = new URLSearchParams(window.location.search).get('ref');
  if (fromUrl) return fromUrl.trim().toUpperCase();
  try {
    const saved = JSON.parse(localStorage.getItem('sopy_ref') || 'null');
    if (saved?.code && Date.now() - saved.at < 30 * 24 * 60 * 60 * 1000) return saved.code;
  } catch { /* ignore */ }
  return '';
}

export default function WhoAreYou() {
  const { t, lang } = useI18n();
  // All 195 countries by region, named in the page's language.
  const countryGroups = useMemo(() => countryOptions(lang), [lang]);
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [form, setForm] = useState({
    fullName: '', title: '', email: '', phone: '', password: '',
    restaurantName: '', country: '', branchCount: 1, userCount: 1,
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const [referralCode] = useState(readReferralCode);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      // The account keeps the language this page was filled in.
      await signup({ ...form, language: lang, referralCode: referralCode || undefined });
      try { localStorage.removeItem('sopy_ref'); } catch { /* ignore */ }
      navigate('/configure');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="screen-narrow">
      {/* The progress bar used to share this row with the language picker
          and collapsed to nothing; there was also no way back home. */}
      <div className="signed-out-bar">
        <Link to="/" className="auth-brand"><Logo size={28} /></Link>
        <LanguageSwitcher />
      </div>
      <div className="stepper">
        <div className="dot done" /><div className="dot" /><div className="dot" /><div className="dot" /><div className="dot" />
      </div>
      <h2>{t('signup.title')}</h2>
      <p>{t('signup.intro')}</p>
      {referralCode && (
        <div className="success-banner" role="status">
          {t('signup.referral', { amount: REFERRAL_WELCOME_USD })}
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="fullName">{t('page.fullName')}</label>
          <input id="fullName" required value={form.fullName} onChange={set('fullName')} />
        </div>
        <div className="field">
          <label htmlFor="title">{t('signup.jobTitle')}</label>
          <JobTitleSelect id="title" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} />
        </div>
        <div className="field">
          <label htmlFor="email">{t('page.email')}</label>
          <input id="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required value={form.email} onChange={set('email')} />
        </div>
        <div className="field">
          <label htmlFor="phone">{t('page.phone')}</label>
          <input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
        </div>
        <div className="field">
          <label htmlFor="password">{t('signup.password')}</label>
          <input id="password" type="password" autoComplete="new-password" minLength={8} required value={form.password} onChange={set('password')} />
          <div className="hint">{t('signup.passwordHint')}</div>
        </div>
        <div className="field">
          <label htmlFor="restaurantName">{t('signup.restaurantName')}</label>
          <input id="restaurantName" required value={form.restaurantName} onChange={set('restaurantName')} />
        </div>
        <div className="field">
          <label htmlFor="country">{t('signup.country')}</label>
          <select id="country" required value={form.country} onChange={set('country')}>
            <option value="" disabled>{t('signup.selectCountry')}</option>
            {countryGroups.map((g) => (
              <optgroup key={g.key} label={t(`countryGroup.${g.key}`)}>
                {g.countries.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </optgroup>
            ))}
            <option value="Other">{t('country.Other')}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="branchCount">{t('page.numBranches')}</label>
          <input id="branchCount" type="number" min={1} required value={form.branchCount} onChange={set('branchCount')} />
        </div>
        <div className="field">
          <label htmlFor="userCount">{t('page.numUsers')}</label>
          <input id="userCount" type="number" min={1} required value={form.userCount} onChange={set('userCount')} />
        </div>

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? t('signup.submitting') : t('common.continue')}
        </button>
      </form>
      <p style={{ marginTop: 16 }}>{t('signup.haveAccount')} <Link to="/login">{t('login.submit')}</Link></p>
    </div>
  );
}

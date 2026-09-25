import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, setToken } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';
import Logo from '../components/Logo.jsx';

export default function AcceptInvite() {
  const { t, lang } = useI18n();
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Who the link is for, checked before they type anything: a dead link
  // used to be discovered only after setting a password.
  const [invite, setInvite] = useState(null);
  const [deadLink, setDeadLink] = useState('');

  useEffect(() => {
    if (!token) return;
    api.get(`/auth/invite/${encodeURIComponent(token)}`)
      .then(setInvite)
      .catch((err) => { if (err.status === 404 || err.status === 410) setDeadLink(err.message); });
  }, [token, lang]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      // A new person's account takes the language they chose here.
      const data = await api.post('/auth/accept-invite', { inviteToken: token, password, language: lang });
      setToken(data.token);
      await refresh();
      // Someone joining for the first time isn't "welcome back".
      navigate('/app/dashboard', { state: { firstVisit: invite?.kind !== 'reset' } });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = invite?.kind === 'reset';

  return (
    <div className="screen-narrow">
      <div className="signed-out-bar">
        <span className="auth-brand"><Logo size={28} /></span>
        <LanguageSwitcher />
      </div>
      {!token || deadLink ? (
        <>
          <div className="error-banner">{deadLink || t('accept.missingToken')}</div>
          <p><Link to="/login">{t('login.submit')}</Link></p>
        </>
      ) : (
        <>
          <h2>{reset ? t('accept.resetTitle') : t('accept.title')}</h2>
          {invite ? (
            <p>
              {t(reset ? 'accept.resetFor' : 'accept.invitedBy', { name: invite.fullName, restaurant: invite.restaurantName })}{' '}
              {t('accept.loginAs')} <strong dir="ltr">{invite.email}</strong>
            </p>
          ) : (
            <p>{t('accept.intro')}</p>
          )}
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="password">{reset ? t('accept.newPassword') : t('page.password')}</label>
              <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
              <div className="hint">{t('signup.passwordHint')}</div>
            </div>
            {/* On a phone keyboard a typo here locked people out until a
                manager sent a new link. (Outside .field, whose input styles
                would stretch the checkbox full width.) */}
            <label className="inline-check" htmlFor="showPassword" style={{ margin: '-8px 0 18px' }}>
              <input id="showPassword" type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
              {t('accept.showPassword')}
            </label>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? t('common.saving') : t('accept.submit')}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

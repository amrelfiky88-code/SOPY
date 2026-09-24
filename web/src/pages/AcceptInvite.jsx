import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, setToken } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';

export default function AcceptInvite() {
  const { t, lang } = useI18n();
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      // A new person's account takes the language they chose here.
      const data = await api.post('/auth/accept-invite', { inviteToken: token, password, language: lang });
      setToken(data.token);
      await refresh();
      navigate('/app/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="screen-narrow">
      <div className="signed-out-bar">
        <span className="auth-brand">SOPY</span>
        <LanguageSwitcher />
      </div>
      {!token ? (
        <p>{t('accept.missingToken')}</p>
      ) : (
        <>
          <h2>{t('accept.title')}</h2>
          <p>{t('accept.intro')}</p>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="password">{t('page.password')}</label>
              <input id="password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
              <div className="hint">{t('signup.passwordHint')}</div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? t('common.saving') : t('accept.submit')}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

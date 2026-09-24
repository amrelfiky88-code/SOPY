import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useT } from '../i18n/index.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';

export default function Login() {
  const t = useT();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await login(email, password);
      const step = data.tenant.onboarding_step;
      const stepToPath = {
        configure_data: '/configure',
        pricing: '/pricing',
        checkout: '/checkout',
        onboarding: '/onboarding',
      };
      // Back to the page that sent them here, if it's an in-app page and
      // setup is done; otherwise wherever their setup step says.
      const from = location.state?.from;
      const returnTo = step === 'complete' && typeof from === 'string' && from.startsWith('/app/') ? from : null;
      navigate(stepToPath[step] || returnTo || '/app/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="screen-narrow">
      <div className="signed-out-bar">
        <Link to="/" className="auth-brand">SOPY</Link>
        <LanguageSwitcher />
      </div>
      <h2>{t('login.title')}</h2>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">{t('login.email')}</label>
          <input id="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">{t('login.password')}</label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: '100%' }}>
          {submitting ? t('login.signingIn') : t('login.submit')}
        </button>
      </form>
      <p className="hint" style={{ marginTop: 14 }}>{t('login.forgot')}</p>
      <p style={{ marginTop: 16 }}>{t('login.newToSopy')} <Link to="/get-started">{t('login.getStarted')}</Link></p>
    </div>
  );
}

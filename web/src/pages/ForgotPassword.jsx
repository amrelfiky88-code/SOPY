import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, setToken } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';
import Logo from '../components/Logo.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import PhoneField from '../components/PhoneField.jsx';

const RESEND_SECONDS = 60;

// Arabic-Indic and Persian keyboards type ٣ or ۳; the code is Western digits.
const westernDigits = (s) => s
  .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
  .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6F0))
  .replace(/\D/g, '')
  .slice(0, 6);

// Forgot password: a 6-digit code to the email they log in with or the
// mobile number in their profile (server: routes/forgot.routes.js), then a
// new password. Where neither way of sending is set up on the server, it
// says reset is unavailable for now.
export default function ForgotPassword() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useAuth();
  const [options, setOptions] = useState(null); // { email, sms }
  const [optionsFailed, setOptionsFailed] = useState(false);
  const [method, setMethod] = useState('email');
  const [email, setEmail] = useState(typeof location.state?.email === 'string' ? location.state.email : '');
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState('ask'); // ask → code → password
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  // Seconds before another code may go to the address in waitFor. The
  // server counts per address, so a different email or number isn't held up.
  const [wait, setWait] = useState(0);
  const [waitFor, setWaitFor] = useState('');

  const loadOptions = () => {
    setOptionsFailed(false);
    api.get('/auth/forgot/options')
      .then((o) => { setOptions(o); if (!o.email && o.sms) setMethod('sms'); })
      .catch(() => setOptionsFailed(true));
  };
  useEffect(loadOptions, []);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const who = method === 'email' ? { email: email.trim() } : { phone };
  const address = method === 'email' ? `email:${email.trim().toLowerCase()}` : `sms:${phone}`;
  const held = wait > 0 && waitFor === address;
  // Isolated, so an email or "+20 …" reads left to right inside Arabic.
  const shownTo = `⁦${method === 'email' ? email.trim() : phone}⁩`;

  const sendCode = async (again = false) => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await api.post('/auth/forgot', { ...who, language: lang });
      setStep('code');
      setCode('');
      setWait(RESEND_SECONDS);
      setWaitFor(address);
      if (again) setNotice(t('forgot.resent'));
    } catch (err) {
      if (err.status === 429) { setWait(RESEND_SECONDS); setWaitFor(address); }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const d = await api.post('/auth/forgot/verify', { ...who, code });
      setResetToken(d.resetToken);
      setStep('password');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // The code's reset token works like a manager's reset link.
  const save = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const d = await api.post('/auth/accept-invite', { inviteToken: resetToken, password });
      setToken(d.token);
      await refresh();
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      if (err.status === 404 || err.status === 410) {
        setStep('ask');
        setError(t('forgot.timedOut'));
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const startOver = () => { setStep('ask'); setError(''); setNotice(''); setCode(''); };
  const both = options?.email && options?.sms;
  const none = options && !options.email && !options.sms;

  return (
    <div className="screen-narrow">
      <div className="signed-out-bar">
        <Link to="/" className="auth-brand"><Logo size={28} /></Link>
        <LanguageSwitcher />
      </div>
      <h2>{step === 'password' ? t('accept.resetTitle') : t('forgot.title')}</h2>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}

      {optionsFailed && (
        <div className="error-banner">
          {t('forgot.loadFailed')}{' '}
          <button type="button" className="link-btn" onClick={loadOptions}>{t('common.tryAgain')}</button>
        </div>
      )}
      {!options && !optionsFailed && <p>{t('common.loading')}</p>}
      {/* Only when the server has no email or SMS service set up (it logs a
          warning at start-up). People reset their own password; this used to
          send them to a manager. */}
      {none && <p>{t('forgot.unavailable')}</p>}

      {options && !none && step === 'ask' && (
        <form onSubmit={(e) => { e.preventDefault(); sendCode(); }}>
          <p>{t('forgot.intro')}</p>
          {both && (
            <div className="field">
              <span className="field-label" id="forgot-how">{t('forgot.how')}</span>
              <div className="segmented" role="radiogroup" aria-labelledby="forgot-how">
                {[['email', t('forgot.byEmail')], ['sms', t('forgot.byPhone')]].map(([m, label]) => (
                  <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? 'active' : ''} onClick={() => { setMethod(m); setError(''); }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {method === 'email' ? (
            <div className="field">
              <label htmlFor="forgot-email">{t('forgot.emailLabel')}</label>
              <input id="forgot-email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          ) : (
            <>
              <PhoneField id="forgot-phone" label={t('forgot.phoneLabel')} value={phone} onChange={setPhone} />
              <div className="hint" style={{ marginTop: -8, marginBottom: 14 }}>{t('forgot.phoneHint')}</div>
            </>
          )}
          <button className="btn btn-primary" type="submit" disabled={busy || held || (method === 'sms' && !phone)} style={{ width: '100%' }}>
            {busy ? t('forgot.sending') : held ? t('forgot.resendIn', { s: wait }) : t('forgot.send')}
          </button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={verify}>
          <p>{t('forgot.sentTo', { to: shownTo })}</p>
          <div className="field">
            <label htmlFor="forgot-code">{t('forgot.codeLabel')}</label>
            <input
              id="forgot-code"
              className="code-input"
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(westernDigits(e.target.value))}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy || code.length !== 6} style={{ width: '100%' }}>
            {busy ? t('forgot.checking') : t('forgot.verify')}
          </button>
          <div className="forgot-actions">
            <button type="button" className="link-btn" disabled={busy || held} onClick={() => sendCode(true)}>
              {held ? t('forgot.resendIn', { s: wait }) : t('forgot.resend')}
            </button>
            <button type="button" className="link-btn" onClick={startOver}>{t('forgot.change')}</button>
          </div>
          <p className="hint">{method === 'email' ? t('forgot.noCodeEmail') : t('forgot.noCodePhone')}</p>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={save}>
          <p>{t('forgot.newTitle')}</p>
          <div className="field">
            <label htmlFor="forgot-password">{t('accept.newPassword')}</label>
            <PasswordInput id="forgot-password" autoComplete="new-password" minLength={8} required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
            <div className="hint">{t('signup.passwordHint')} {t('forgot.signsOut')}</div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? t('common.saving') : t('forgot.save')}
          </button>
        </form>
      )}

      <p style={{ marginTop: 20 }}><Link to="/login">{t('forgot.back')}</Link></p>
    </div>
  );
}

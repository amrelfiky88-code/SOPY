import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useI18n } from '../../i18n/index.jsx';
import { formatDateTime } from '../../lib/reportModel.js';
import { WhatsAppIcon, MailIcon, LinkIcon, ShareIcon } from '../../components/icons.jsx';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

// "Refer a restaurant": the owner's personal link, share buttons, and the
// credit it has earned. Credit is earned when a referred business makes its
// first payment and comes off this business's next payment automatically.
export default function ReferralCard() {
  const { t, lang } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = () => {
    setError('');
    api.get('/referrals').then(setData).catch((err) => setError(err.message));
  };
  useEffect(load, []);

  if (error) {
    return (
      <div className="card">
        <h3 style={{ fontSize: 16, marginBottom: 8 }}>{t('referral.title')}</h3>
        <div className="error-banner">{error} <button type="button" className="link-btn" onClick={load}>{t('common.tryAgain')}</button></div>
      </div>
    );
  }
  if (!data) return <div className="card"><p style={{ margin: 0 }}>{t('common.loading')}</p></div>;

  const url = `${window.location.origin}${data.path}`;
  const reward = money(data.rewardAmount);
  const welcome = money(data.welcomeAmount);
  const message = t('referral.shareMessage', { reward, welcome, url });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const field = document.createElement('textarea');
      field.value = url;
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      field.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const canShare = typeof navigator.share === 'function';

  return (
    <div className="card referral-card">
      <h3 style={{ fontSize: 16, marginBottom: 6 }}>{t('referral.title')}</h3>
      <p style={{ marginTop: 0 }}>{t('referral.intro', { reward, welcome })}</p>

      <div className="invite-link-url" aria-label={t('referral.yourLink')}>{url}</div>

      <div className="share-targets" style={{ marginTop: 12 }}>
        <button type="button" className="share-target" onClick={copy}>
          <span className="share-icon"><LinkIcon size={24} /></span>
          <span>{copied ? t('referral.copied') : t('share.copyLink')}</span>
        </button>
        <a className="share-target" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
          <span className="share-icon share-icon-whatsapp"><WhatsAppIcon size={24} /></span>
          <span>WhatsApp</span>
        </a>
        <a className="share-target" href={`mailto:?subject=${encodeURIComponent(t('referral.emailSubject'))}&body=${encodeURIComponent(message)}`}>
          <span className="share-icon share-icon-mail"><MailIcon size={24} /></span>
          <span>{t('share.email')}</span>
        </a>
        {canShare && (
          <button type="button" className="share-target" onClick={() => navigator.share({ title: 'SOPY', text: message }).catch(() => {})}>
            <span className="share-icon"><ShareIcon size={24} /></span>
            <span>{t('share.more')}</span>
          </button>
        )}
      </div>

      <div className="referral-stats">
        <div><div className="referral-stat-value">{data.signedUp}</div><div className="hint">{t('referral.signedUp')}</div></div>
        <div><div className="referral-stat-value">{data.paid}</div><div className="hint">{t('referral.paid')}</div></div>
        <div><div className="referral-stat-value">{money(data.credit.available + data.credit.scheduled)}</div><div className="hint">{t('referral.credit')}</div></div>
      </div>

      <p className="hint" style={{ marginBottom: 0 }}>
        {data.credit.scheduled > 0
          ? t('referral.scheduledNote', { amount: money(data.credit.scheduled) })
          : data.credit.available > 0
            ? t('referral.availableNote', { amount: money(data.credit.available) })
            : t('referral.howItWorks', { reward })}
      </p>

      {data.rewards.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {data.rewards.map((r) => (
            <div className="summary-row" key={r.id}>
              <span>{r.referred_restaurant || t('referral.aRestaurant')} <span className="hint">· {formatDateTime(r.created_at, lang)}</span></span>
              <span className="referral-plus">+{money(r.amount)}</span>
            </div>
          ))}
          {data.credit.used > 0 && <p className="hint" style={{ marginBottom: 0 }}>{t('referral.usedSoFar', { amount: money(data.credit.used) })}</p>}
        </div>
      )}
    </div>
  );
}

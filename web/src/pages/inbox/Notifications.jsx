import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { useInboxBadges } from '../../components/inboxBadges.jsx';
import { AlertTriangleIcon, BellIcon, CheckCircleIcon, ClockIcon, LinkIcon } from '../../components/icons.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { notificationText, shortTime, isToday } from './format.js';

const ICONS = { checklist_due: ClockIcon, incident: AlertTriangleIcon, report_submitted: CheckCircleIcon, referral_credit: LinkIcon };

// Where tapping a notification goes: the incident's thread, the report,
// or Profile for referral credit.
function destination(n) {
  if (n.kind === 'referral_credit') return '/app/account';
  if (n.kind === 'checklist_due') return '/app/dashboard';
  if (n.thread_id) return `/app/inbox/${n.thread_id}`;
  if (n.submission_id) return `/app/reports/${n.submission_id}`;
  return null;
}

export default function Notifications() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { refresh: refreshBadges } = useInboxBadges();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/notifications').then((d) => setItems(d.notifications)).catch((err) => setError(err.message));
  }, []);

  const open = async (n) => {
    if (!n.read_at) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      api.post(`/notifications/${n.id}/read`, {}).then(refreshBadges).catch(() => {});
    }
    const to = destination(n);
    if (to) navigate(to);
  };

  const markAll = async () => {
    try {
      await api.post('/notifications/read-all', {});
      setItems((list) => list.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
      refreshBadges();
    } catch (err) {
      setError(err.message);
    }
  };

  const groups = items
    ? [['today', items.filter((n) => isToday(n.created_at))], ['earlier', items.filter((n) => !isToday(n.created_at))]].filter(([, list]) => list.length)
    : [];

  return (
    <div>
      <div className="page-head-row" style={{ marginBottom: 6 }}>
        <h2 style={{ margin: 0 }}>{t('app.notifications')}</h2>
        {items?.some((n) => !n.read_at) && (
          <button type="button" className="link-btn" style={{ textDecoration: 'none', fontWeight: 600, fontSize: 14 }} onClick={markAll}>{t('notif.markAll')}</button>
        )}
      </div>
      {error && <div className="error-banner">{error}</div>}
      {!items && !error && <p className="hint">{t('common.loading')}</p>}
      {items && items.length === 0 && <div className="empty-state"><BellIcon size={32} /><span>{t('notif.empty')}</span></div>}
      {groups.map(([key, list]) => (
        <div key={key}>
          <div className="section-label" style={{ margin: '14px 4px 8px' }}>{t(`notif.${key}`)}</div>
          <div className="list-card">
            {list.map((n) => {
              const { tone, title, body } = notificationText(t, n);
              const Icon = ICONS[n.kind] || BellIcon;
              return (
                <button key={n.id} type="button" className="list-row" style={{ alignItems: 'flex-start' }} onClick={() => open(n)}>
                  <span className={`icon-tile icon-tile-round${tone === 'red' ? ' tone-red' : tone === 'amber' ? ' tone-amber' : ''}`} style={{ width: 36, height: 36 }}><Icon size={16} /></span>
                  <span className="row-text" style={{ gap: 2 }}>
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span className="row-title" style={{ fontWeight: n.read_at ? 600 : 700 }}>{title}</span>
                      <span className="row-meta" style={{ fontSize: 12, flexShrink: 0 }}>{shortTime(t, lang, n.created_at)}</span>
                    </span>
                    <span className="row-meta" style={{ lineHeight: 1.4 }}>{body}</span>
                  </span>
                  {!n.read_at && <span className="unread-dot" style={{ marginTop: 6 }} aria-label={t('notif.unread')} />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import PageHead from '../../components/PageHead.jsx';
import { MessageIcon, PlusIcon } from '../../components/icons.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { initials, threadTitle, threadSub, lastPreview, shortTime } from './format.js';

// Inbox: incident threads (opened by SOPY when a report is flagged) and
// conversations with teammates, newest first.
export default function Inbox() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [threads, setThreads] = useState(null);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);
  const [people, setPeople] = useState(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    api.get('/inbox/threads').then((d) => setThreads(d.threads)).catch((err) => setError(err.message));
  }, []);

  const openPicker = () => {
    setPicking((p) => !p);
    if (!people) api.get('/tenants/people').then((d) => setPeople(d.people.filter((p) => p.id !== user?.id))).catch((err) => setError(err.message));
  };

  const startWith = async (person) => {
    if (opening) return;
    setOpening(true);
    try {
      const { threadId } = await api.post('/inbox/threads', { userId: person.id });
      navigate(`/app/inbox/${threadId}`);
    } catch (err) {
      setError(err.message);
      setOpening(false);
    }
  };

  return (
    <div>
      <PageHead title={t('app.tabInbox')} intro={t('inbox.intro')} />
      <button type="button" className="btn btn-secondary" style={{ width: '100%', marginBottom: 14 }} onClick={openPicker} aria-expanded={picking}>
        <PlusIcon size={16} />{t('inbox.newMessage')}
      </button>

      {picking && (
        <div className="list-card" style={{ marginBottom: 14 }}>
          {!people && <p className="hint" style={{ padding: '12px 0' }}>{t('common.loading')}</p>}
          {people && people.length === 0 && <p className="hint" style={{ padding: '12px 0' }}>{t('inbox.noPeople')}</p>}
          {people?.map((p) => (
            <button key={p.id} type="button" className="list-row" onClick={() => startWith(p)} disabled={opening}>
              <span className="avatar avatar-sm">{initials(p.full_name)}</span>
              <span className="row-text"><span className="row-title">{p.full_name}</span><span className="row-meta">{p.title || t(`role.${p.role}`)}</span></span>
            </button>
          ))}
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}
      {!threads && !error && <p className="hint">{t('common.loading')}</p>}
      {threads && threads.length === 0 && (
        <div className="empty-state"><MessageIcon size={32} /><span>{t('inbox.empty')}</span></div>
      )}
      {threads && threads.length > 0 && (
        <div className="list-card">
          {threads.map((th) => (
            <Link key={th.id} to={`/app/inbox/${th.id}`} className="list-row">
              <span className={`avatar avatar-sm${th.kind === 'incident' ? ' tone-red' : ''}`}>{th.kind === 'incident' ? '!' : initials(th.other_name)}</span>
              <span className="row-text">
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span className="row-title" style={{ fontWeight: th.unread ? 700 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{threadTitle(t, th)}</span>
                  <span className="row-meta" style={{ flexShrink: 0, fontSize: 12 }}>{shortTime(t, lang, th.last_at || th.last_message_at)}</span>
                </span>
                <span className="row-meta" style={{ fontSize: 12 }}><bdi>{threadSub(t, th)}</bdi></span>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 14, color: th.unread ? 'var(--ink)' : 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', unicodeBidi: 'plaintext' }}>{lastPreview(t, th, user?.id)}</span>
                  {th.unread > 0 && <span className="count-badge" style={{ background: 'var(--green)' }}>{th.unread}</span>}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

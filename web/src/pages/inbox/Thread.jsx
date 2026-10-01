import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useInboxBadges } from '../../components/inboxBadges.jsx';
import { ChevronStartIcon, ChevronEndIcon, FileTextIcon, SendIcon } from '../../components/icons.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { reportTitle } from '../../i18n/formLabels.js';
import { initials, threadTitle, threadSub, incidentMessage, shortTime } from './format.js';

const MAX_LENGTH = 2000; // mirrors MESSAGE_MAX_LENGTH in inbox.routes.js
const POLL_MS = 15_000;

// One conversation. Opening it marks it read; new messages are picked up
// every 15 seconds while it's on screen.
export default function Thread() {
  const { threadId } = useParams();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { refresh: refreshBadges } = useInboxBadges();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const lastCount = useRef(0);

  useEffect(() => {
    let current = true;
    const load = async () => {
      try {
        const d = await api.get(`/inbox/threads/${threadId}`);
        if (!current) return;
        setData(d);
        await api.post(`/inbox/threads/${threadId}/read`, {});
        refreshBadges();
      } catch (err) {
        if (!current) return;
        if (err.status === 404 || err.status === 400) setMissing(true);
        else setError(err.message);
      }
    };
    load();
    const id = setInterval(() => { if (document.visibilityState === 'visible') load(); }, POLL_MS);
    return () => { current = false; clearInterval(id); };
  }, [threadId, refreshBadges]);

  // Keep the newest message in view when one arrives.
  useLayoutEffect(() => {
    const n = data?.messages.length || 0;
    if (n !== lastCount.current) endRef.current?.scrollIntoView({ block: 'end' });
    lastCount.current = n;
  }, [data]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const { message } = await api.post(`/inbox/threads/${threadId}/messages`, { body });
      setData((d) => ({ ...d, messages: [...d.messages, { ...message, sender_name: user?.fullName }] }));
      setDraft('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    // Enter sends on a keyboard; Shift+Enter (and phones' return key with
    // a composition open) keeps a new line.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const goBack = () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate('/app/inbox');
  };

  if (missing) {
    return (
      <div>
        <Link to="/app/inbox" className="back-link">{t('page.back')}</Link>
        <div className="empty-state">{t('inbox.notFound')}</div>
      </div>
    );
  }

  const thread = data?.thread;
  return (
    <div className="thread-page">
      <div className="thread-head">
        <button type="button" className="back-btn" onClick={goBack} aria-label={t('page.back')}><ChevronStartIcon size={24} /></button>
        {thread && (
          <>
            <span className={`avatar avatar-sm${thread.kind === 'incident' ? ' tone-red' : ''}`} style={{ width: 36, height: 36, fontSize: 13 }}>
              {thread.kind === 'incident' ? '!' : initials(thread.other_name)}
            </span>
            <span className="row-text">
              <span className="row-title" style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{threadTitle(t, thread)}</span>
              <span className="row-meta" style={{ fontSize: 12 }}><bdi>{threadSub(t, thread)}</bdi></span>
            </span>
          </>
        )}
      </div>

      <div className="thread-messages" aria-live="polite">
        {!data && !error && <p className="hint">{t('common.loading')}</p>}
        {data?.messages.map((m, i) => {
          const mine = m.sender_id && m.sender_id === user?.id;
          const system = !m.sender_id && m.kind === 'incident';
          const prev = data.messages[i - 1];
          const showWho = !mine && (!prev || prev.sender_id !== m.sender_id);
          return (
            <div key={m.id} className={`msg${mine ? ' mine' : ''}`}>
              {showWho && <span className="msg-who">{system ? 'SOPY' : (m.sender_name || t('inbox.formerMember'))}</span>}
              <div className={`bubble${system ? ' system' : ''}`}>
                {system ? incidentMessage(t, m.data || {}) : m.body}
                {system && thread?.submission_id && (
                  <Link to={`/app/reports/${thread.submission_id}`} className="report-chip">
                    <span className="icon-tile icon-tile-sm tone-red" style={{ width: 32, height: 32, borderRadius: 9 }}><FileTextIcon size={16} /></span>
                    <span className="row-text">
                      <span className="row-title" style={{ fontSize: 14 }}>{reportTitle(t, m.data?.kind, m.data?.templateName)}</span>
                      <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}><bdi>{m.data?.branchName}</bdi> · {t('reports.incident')}</span>
                    </span>
                    <span className="row-chev"><ChevronEndIcon size={16} /></span>
                  </Link>
                )}
              </div>
              <span className="msg-time">{shortTime(t, lang, m.created_at)}</span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error && <div className="error-banner" style={{ marginBottom: 8 }}>{error}</div>}
      <div className="composer">
        <textarea
          rows={1}
          value={draft}
          maxLength={MAX_LENGTH}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('inbox.message')}
          aria-label={t('inbox.message')}
        />
        <button type="button" className="send-btn" onClick={send} disabled={!draft.trim() || sending} aria-label={t('inbox.send')}>
          <SendIcon size={20} />
        </button>
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useT } from '../i18n/index.jsx';
import { MessageIcon, CheckCircleIcon } from './icons.jsx';

const CATEGORIES = ['bug', 'idea', 'other'];
const MAX_LENGTH = 2000; // mirrors FEEDBACK_MAX_LENGTH in feedback.routes.js

// `trigger` draws a different opener (Profile's settings row); it's given
// the function that opens the form.
export default function FeedbackButton({ onOpen, trigger }) {
  const t = useT();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('idea');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent
  const [error, setError] = useState('');
  const textareaRef = useRef(null);
  // Captured when the form opens, so it names the screen the user was
  // looking at rather than wherever they are when they hit send.
  const pageRef = useRef('');

  const openForm = () => {
    pageRef.current = location.pathname;
    setCategory('idea');
    setMessage('');
    setError('');
    setStatus('idle');
    setOpen(true);
    onOpen?.();
  };

  useEffect(() => {
    if (!open) return undefined;
    textareaRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const send = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('sending');
    try {
      await api.post('/feedback', { category, message, pagePath: pageRef.current });
      setStatus('sent');
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  };

  return (
    <>
      {trigger ? trigger(openForm) : (
        <button type="button" className="nav-btn" onClick={openForm}>
          <MessageIcon size={18} /> {t('feedback.button')}
        </button>
      )}

      {/* Portalled to <body>: the button lives in the sidebar, which is
          CSS-transformed on mobile, and a transformed ancestor becomes the
          containing block for position:fixed — the dialog would be trapped
          inside the drawer and slide off-screen when it closes. */}
      {open && createPortal(
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            onClick={(e) => e.stopPropagation()}
          >
            {status === 'sent' ? (
              <div className="empty-state" style={{ padding: '12px 0' }}>
                <CheckCircleIcon size={32} style={{ color: 'var(--green)', opacity: 1 }} />
                <p style={{ margin: 0 }}>{t('feedback.thanks')}</p>
                <button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>
                  {t('feedback.close')}
                </button>
              </div>
            ) : (
              <form onSubmit={send}>
                <h3 id="feedback-title" style={{ marginBottom: 4 }}>{t('feedback.title')}</h3>
                <p className="hint" style={{ marginTop: 0 }}>{t('feedback.intro')}</p>

                {error && <div className="error-banner">{error}</div>}

                <div className="filter-row" role="radiogroup" aria-label={t('feedback.kind')}>
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={category === c}
                      className={category === c ? 'active' : ''}
                      onClick={() => setCategory(c)}
                    >
                      {t(`feedback.category.${c}`)}
                    </button>
                  ))}
                </div>

                <div className="field">
                  <label htmlFor="feedback-message">{t('feedback.messageLabel')}</label>
                  <textarea
                    id="feedback-message"
                    ref={textareaRef}
                    rows={5}
                    maxLength={MAX_LENGTH}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <p className="hint" style={{ textAlign: 'end' }}>{message.length} / {MAX_LENGTH}</p>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                    {t('common.cancel')}
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={status === 'sending' || !message.trim()}>
                    {status === 'sending' ? t('feedback.sending') : t('feedback.send')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

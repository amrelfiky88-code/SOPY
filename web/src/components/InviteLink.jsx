import React, { useRef, useState } from 'react';
import { useT } from '../i18n/index.jsx';
import { LinkIcon, ShareIcon, WhatsAppIcon } from './icons.jsx';

// SOPY doesn't send email yet, so this link is the *only* way an invited
// person can join — it has to be readable and copyable on a phone. It was
// previously a bare <code> that ran ~475px wide inside a 335px card and got
// clipped, and the Team page didn't show it at all.
// kind="reset": the same one-time link, for someone who forgot their password.
// Sent the way staff are usually reached: WhatsApp, or the phone's own share
// sheet, as on the referral card.
export default function InviteLink({ path, email, kind = 'invite' }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const urlRef = useRef(null);
  const url = `${window.location.origin}${path}`;
  const message = t(kind === 'reset' ? 'invite.resetShareText' : 'invite.shareText', { url });
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The clipboard is blocked on plain-HTTP addresses and in some phone
      // browsers. The button used to just stay "Copy link" with no word:
      // select the link and say how to copy it by hand.
      setCopyFailed(true);
      const range = document.createRange();
      range.selectNodeContents(urlRef.current);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  return (
    <div className="card invite-link">
      <p style={{ margin: '0 0 8px' }}>
        {t(kind === 'reset' ? 'invite.resetFor' : 'invite.createdFor', { email: email || '' })}
      </p>
      <div className="invite-link-url" dir="ltr" ref={urlRef}>{url}</div>
      {copyFailed && <p className="hint" role="status" style={{ margin: '6px 0 0' }}>{t('invite.copyByHand')}</p>}
      <div className="share-targets" style={{ marginTop: 12 }}>
        <button type="button" className="share-target" onClick={copy}>
          <span className="share-icon"><LinkIcon size={24} /></span>
          <span>{copied ? t('invite.copied') : t('invite.copy')}</span>
        </button>
        <a className="share-target" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
          <span className="share-icon share-icon-whatsapp"><WhatsAppIcon size={24} /></span>
          <span>WhatsApp</span>
        </a>
        {canShare && (
          <button type="button" className="share-target" onClick={() => navigator.share({ title: 'SOPY', text: message }).catch(() => {})}>
            <span className="share-icon"><ShareIcon size={24} /></span>
            <span>{t('share.more')}</span>
          </button>
        )}
      </div>
    </div>
  );
}

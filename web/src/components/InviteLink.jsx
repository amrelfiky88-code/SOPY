import React, { useState } from 'react';

// SOPY doesn't send email yet, so this link is the *only* way an invited
// person can join — it has to be readable and copyable on a phone. It was
// previously a bare <code> that ran ~475px wide inside a 335px card and got
// clipped, and the Team page didn't show it at all.
export default function InviteLink({ path, email }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}${path}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API is blocked on plain-HTTP origins; the text is
      // selectable as a fallback.
      setCopied(false);
    }
  };

  return (
    <div className="card invite-link">
      <p style={{ margin: '0 0 8px' }}>
        Invite created{email ? ` for ${email}` : ''}. Send them this link to set their password — emails aren't sent automatically yet.
      </p>
      <div className="invite-link-url">{url}</div>
      <button type="button" className="btn btn-secondary btn-small" onClick={copy} style={{ marginTop: 10 }}>
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  );
}

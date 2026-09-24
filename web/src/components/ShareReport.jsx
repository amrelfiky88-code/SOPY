import React, { useEffect, useRef, useState } from 'react';
import { getToken } from '../api.js';
import { useI18n } from '../i18n/index.jsx';
import { renderReportPdf } from '../lib/reportPdf.js';
import { WhatsAppIcon, MailIcon, LinkIcon, ShareIcon, FilePdfIcon, DownloadIcon } from './icons.jsx';

// Share a finished report as a PDF: WhatsApp, email, a copyable link,
// the phone's own share sheet (which offers WhatsApp/Gmail/Drive with the
// PDF attached), or a straight save to the device.
//
// The PDF is built as soon as this mounts, not on tap: iOS only lets a
// page open the share sheet straight from a tap, and a few seconds of
// PDF rendering in between would use that permission up.
export default function ShareReport({ submissionId, model }) {
  const { t, dir } = useI18n();
  const [pdf, setPdf] = useState(null); // { blob, file, url }
  const [status, setStatus] = useState('preparing'); // preparing | ready | failed
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const linkPromise = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    setStatus('preparing');
    renderReportPdf(model, {
      dir,
      footer: (n) => `${t('report.generatedBy')} · ${model.title} · ${t('report.page', { n })}`,
      photoMissing: t('report.photoMissing'),
      critical: t('report.critical'),
    })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        const file = new File([blob], model.fileName, { type: 'application/pdf' });
        setPdf({ blob, file, url: objectUrl });
        setStatus('ready');
      })
      .catch(() => { if (!cancelled) setStatus('failed'); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [model, dir, t]);

  const canShareFile = !!(pdf && navigator.canShare && navigator.canShare({ files: [pdf.file] }));

  // Upload once, reuse the same link for WhatsApp, email and copy.
  const ensureLink = () => {
    if (link) return Promise.resolve(link);
    if (!linkPromise.current) {
      const form = new FormData();
      form.append('pdf', pdf.blob, model.fileName);
      form.append('fileName', model.fileName);
      linkPromise.current = fetch(`/api/submissions/${submissionId}/share`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Accept-Language': localStorage.getItem('sopy_lang') || 'en' },
        body: form,
      })
        // No signal: say so, rather than the browser's own "Failed to fetch".
        .catch(() => { throw new Error(t('api.offline')); })
        .then(async (res) => {
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.error || t('share.linkFailed'));
          const url = `${window.location.origin}${body.path}`;
          setLink(url);
          return url;
        })
        .catch((err) => { linkPromise.current = null; throw err; });
    }
    return linkPromise.current;
  };

  const run = async (key, fn) => {
    setError('');
    setNotice('');
    setBusy(key);
    try { await fn(); } catch (err) { if (err?.name !== 'AbortError') setError(err.message || t('share.linkFailed')); } finally { setBusy(''); }
  };

  const message = (url) => `${model.shareText}\n${url}`;

  const shareFile = () => run('share', () => navigator.share({ files: [pdf.file], title: model.title, text: model.shareText }));

  const whatsapp = () => {
    // Open the window during the tap (before any await) so it isn't
    // treated as a pop-up, then point it at WhatsApp once the link exists.
    const win = window.open('', '_blank');
    return run('whatsapp', async () => {
      try {
        const url = `https://wa.me/?text=${encodeURIComponent(message(await ensureLink()))}`;
        if (win) win.location.href = url; else window.location.href = url;
      } catch (err) {
        win?.close();
        throw err;
      }
    });
  };

  const email = () => run('email', async () => {
    const url = await ensureLink();
    window.location.href = `mailto:?subject=${encodeURIComponent(model.title)}&body=${encodeURIComponent(message(url))}`;
  });

  const copyLink = () => run('copy', async () => {
    const url = await ensureLink();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Older iOS without clipboard permission: select a temporary field.
      const field = document.createElement('textarea');
      field.value = url;
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      field.remove();
    }
    setNotice(t('share.copied'));
  });

  const ready = status === 'ready';
  const disabled = !ready || !!busy;

  return (
    <div className="share-sheet" aria-busy={status === 'preparing'}>
      <div className="share-card">
        <div className="share-card-head">
          <span>{t('share.title')}</span>
          <span className="hint">{t('share.expires')}</span>
        </div>
        <div className="share-targets">
          <button type="button" className="share-target" onClick={whatsapp} disabled={disabled}>
            <span className="share-icon share-icon-whatsapp"><WhatsAppIcon size={26} /></span>
            <span>{busy === 'whatsapp' ? t('share.working') : 'WhatsApp'}</span>
          </button>
          <button type="button" className="share-target" onClick={email} disabled={disabled}>
            <span className="share-icon share-icon-mail"><MailIcon size={26} /></span>
            <span>{busy === 'email' ? t('share.working') : t('share.email')}</span>
          </button>
          <button type="button" className="share-target" onClick={copyLink} disabled={disabled}>
            <span className="share-icon"><LinkIcon size={26} /></span>
            <span>{busy === 'copy' ? t('share.working') : t('share.copyLink')}</span>
          </button>
          {canShareFile && (
            <button type="button" className="share-target" onClick={shareFile} disabled={disabled}>
              <span className="share-icon"><ShareIcon size={26} /></span>
              <span>{t('share.more')}</span>
            </button>
          )}
        </div>
      </div>

      <div className="share-card-label">{t('share.moreOptions')}</div>
      <div className="share-card share-list">
        {canShareFile && (
          <button type="button" className="share-list-row" onClick={shareFile} disabled={disabled}>
            <FilePdfIcon size={24} />
            <span>{t('share.asPdf')}</span>
          </button>
        )}
        {ready ? (
          <a className="share-list-row" href={pdf.url} download={model.fileName}>
            <DownloadIcon size={24} />
            <span>{t('share.save')}</span>
          </a>
        ) : (
          <div className="share-list-row is-disabled">
            <DownloadIcon size={24} />
            <span>{status === 'failed' ? t('share.pdfFailed') : t('share.preparing')}</span>
          </div>
        )}
      </div>

      {notice && <div className="success-banner" role="status" style={{ marginTop: 12 }}>{notice}</div>}
      {error && <div className="error-banner" style={{ marginTop: 12 }}>{error}</div>}
      <p className="hint" style={{ marginTop: 10 }}>{t('share.linkNote')}</p>
    </div>
  );
}

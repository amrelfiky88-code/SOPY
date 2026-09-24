import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { query } from '../db.js';
import { translateError, uiLanguageFromHeader } from '../i18n/errorMessages.js';
import { languageDir } from '../../../shared/languages.js';
import { SHARE_ROOT, sweepSoon } from '../shares.js';

// Public, no-login download of a report PDF someone chose to share over
// WhatsApp or email. The token is the only credential (192 random bits),
// and the link stops working when it expires.
export const sharedRouter = Router();


const escapeHtml = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// These links are opened by people tapping them in WhatsApp or email, so a
// dead link gets a readable page in their browser's language rather than
// raw JSON. API clients asking for JSON still get JSON.
function refuse(req, res, status, message) {
  if (!req.accepts('html')) return res.status(status).json({ error: message });
  const lang = uiLanguageFromHeader(req.headers['accept-language']);
  const text = escapeHtml(translateError(message, lang));
  res.status(status).type('html').send(
    `<!doctype html><html lang="${lang}" dir="${languageDir(lang)}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>SOPY</title></head>` +
    `<body style="font-family:system-ui,sans-serif;background:#f4efe6;color:#1f2a24;margin:0;padding:48px 20px;text-align:center">` +
    `<p style="font:700 22px Georgia,serif;color:#1e3a2b;margin:0 0 16px">SOPY</p><p style="font-size:17px;margin:0">${text}</p></body></html>`
  );
}

sharedRouter.get('/:token', async (req, res) => {
  sweepSoon();
  const { token } = req.params;
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return refuse(req, res, 404, 'This link is not valid');

  const { rows } = await query(
    'SELECT file_name, expires_at FROM report_shares WHERE token = $1',
    [token]
  );
  const share = rows[0];
  if (!share) return refuse(req, res, 404, 'This link is not valid');
  if (new Date(share.expires_at) < new Date()) return refuse(req, res, 410, 'This link has expired');

  const file = path.join(SHARE_ROOT, `${token}.pdf`);
  if (!fs.existsSync(file)) return refuse(req, res, 404, 'This report is no longer available');

  res.setHeader('Content-Type', 'application/pdf');
  // inline: opens in the phone's PDF viewer instead of forcing a download.
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(share.file_name)}`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  fs.createReadStream(file).pipe(res);
});

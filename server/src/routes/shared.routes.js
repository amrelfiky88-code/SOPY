import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { query } from '../db.js';

// Public, no-login download of a report PDF someone chose to share over
// WhatsApp or email. The token is the only credential (192 random bits),
// and the link stops working when it expires.
export const sharedRouter = Router();

const SHARE_ROOT = path.resolve('storage', 'shares');

sharedRouter.get('/:token', async (req, res) => {
  const { token } = req.params;
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return res.status(404).json({ error: 'This link is not valid' });

  const { rows } = await query(
    'SELECT file_name, expires_at FROM report_shares WHERE token = $1',
    [token]
  );
  const share = rows[0];
  if (!share) return res.status(404).json({ error: 'This link is not valid' });
  if (new Date(share.expires_at) < new Date()) return res.status(410).json({ error: 'This link has expired' });

  const file = path.join(SHARE_ROOT, `${token}.pdf`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'This report is no longer available' });

  res.setHeader('Content-Type', 'application/pdf');
  // inline: opens in the phone's PDF viewer instead of forcing a download.
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(share.file_name)}`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  fs.createReadStream(file).pipe(res);
});

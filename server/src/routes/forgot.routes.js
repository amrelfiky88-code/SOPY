import { Router } from 'express';
import crypto from 'node:crypto';
import { query } from '../db.js';
import { deliveryChannels, sendEmail, sendSms } from '../delivery.js';
import { isLocked, recordFailure, clearFailures, LOCKED_MESSAGE } from '../auth/rateLimit.js';
import { normalizeEmail } from './auth.routes.js';
import { parsePhone, composePhone } from '../../../shared/phone.js';
import { countryCode } from '../../../shared/countries.js';
import { isSupportedLanguage, languageDir, LANGUAGE_CODES } from '../../../shared/languages.js';

// Forgot password, without a manager. The person types the email they log
// in with, or the mobile number saved in their profile, and gets a 6-digit
// code there (delivery.js). The right code hands back a reset token: the
// same one-time token a manager's reset link carries (users.invite_token),
// so setting the new password goes through POST /auth/accept-invite, which
// also signs out every other device.
//
// The reply to "send me a code" is the same whether or not an account
// matched, so the page can't be used to find out who has one.
export const forgotRouter = Router();

const CODE_MINUTES = 10;
const MAX_TRIES = 5;            // wrong codes before the live ones stop working
const RESET_MINUTES = 30;       // time to choose the new password after the code
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const SENDS_PER_HOUR = 5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Which ways of sending a code are set up, for the page to offer.
forgotRouter.get('/options', (req, res) => {
  res.json(deliveryChannels());
});

// A phone number as "+<digits>", or null when its country can't be told
// (a number saved without a code, for a business with no country).
function internationalNumber(value, fallbackIso) {
  const { iso, national } = parsePhone(value, fallbackIso);
  if (!iso) return null;
  const digits = composePhone(iso, national).replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

// Who a request is about, from { email } or { phone }.
async function findAccounts(body) {
  if (typeof body.email === 'string' && body.email.trim()) {
    const email = normalizeEmail(body.email);
    if (email.length > 200 || !EMAIL_RE.test(email)) return { error: 'Enter a valid email address' };
    const { rows } = await query(
      "SELECT id, full_name, email, language FROM users WHERE email = $1 AND status = 'active'",
      [email]
    );
    return { channel: 'email', key: `email:${email}`, to: email, users: rows };
  }
  if (typeof body.phone === 'string' && body.phone.trim()) {
    const number = body.phone.length <= 40 ? internationalNumber(body.phone, null) : null;
    if (!number) return { error: 'Enter your mobile number with its country code' };
    // Older numbers were saved without a code ("0122…") and take their
    // business's country, so the match is made here rather than in SQL;
    // the last digits narrow the search.
    const { rows } = await query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.language, t.country
       FROM users u JOIN tenants t ON t.id = u.tenant_id
       WHERE u.status = 'active' AND u.phone IS NOT NULL
         AND regexp_replace(u.phone, '[^0-9]', '', 'g') LIKE $1`,
      [`%${number.slice(-7)}`]
    );
    const users = rows.filter((u) => internationalNumber(u.phone, countryCode(u.country)) === number);
    return { channel: 'sms', key: `sms:${number}`, to: number, users };
  }
  return { error: 'Enter your email or mobile number' };
}

// How often one email or number may be sent a code: once a minute, five
// times an hour. Counted per address whether or not it has an account, so
// the limit gives nothing away either. In memory, like the login lock.
const recentSends = new Map(); // key -> [timestamps]
function sendRefusal(key) {
  const now = Date.now();
  const list = (recentSends.get(key) || []).filter((at) => now - at < HOUR);
  if (list.length && now - list[list.length - 1] < MINUTE) return 'Wait a minute before asking for another code.';
  if (list.length >= SENDS_PER_HOUR) return 'Too many codes asked for. Try again in an hour.';
  list.push(now);
  recentSends.set(key, list);
  if (recentSends.size > 10_000) recentSends.delete(recentSends.keys().next().value);
  return null;
}
// Tests only.
export function resetForgotLimits() { recentSends.clear(); }

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const codeHash = (userId, code) => crypto.createHmac('sha256', SECRET).update(`${userId}:${code}`).digest('hex');
const sameHash = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

const TEXT = {
  subject: ['{code} is your SOPY password code', 'رمز إعادة تعيين كلمة المرور في SOPY هو {code}', '{code} est votre code de mot de passe SOPY'],
  greeting: ['Hello {name},', 'مرحبًا {name}،', 'Bonjour {name},'],
  intro: ['Use this code to reset your SOPY password:', 'استخدم هذا الرمز لإعادة تعيين كلمة المرور في SOPY:', 'Utilisez ce code pour réinitialiser votre mot de passe SOPY :'],
  expiry: ['It works for 10 minutes. Never share it: SOPY will never ask you for it.', 'يعمل لمدة 10 دقائق. لا تشاركه مع أحد، فلن تطلبه SOPY منك أبدًا.', 'Il est valable 10 minutes. Ne le partagez jamais : SOPY ne vous le demandera jamais.'],
  ignore: ["If you didn't ask to reset your password, ignore this email. Your password stays the same.", 'إذا لم تطلب إعادة تعيين كلمة المرور، فتجاهل هذه الرسالة. تبقى كلمة المرور كما هي.', "Si vous n'avez pas demandé à réinitialiser votre mot de passe, ignorez cet e-mail. Votre mot de passe reste inchangé."],
  sms: ['SOPY: your password code is {code}. It works for 10 minutes. Never share it.', 'SOPY: رمز كلمة المرور هو {code}. يعمل لمدة 10 دقائق. لا تشاركه مع أحد.', 'SOPY : votre code de mot de passe est {code}. Valable 10 minutes. Ne le partagez jamais.'],
};
function say(lang, key, vars = {}) {
  let out = TEXT[key][Math.max(0, LANGUAGE_CODES.indexOf(lang))];
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, v);
  return out;
}
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function codeEmail(user, code, lang) {
  const name = user.full_name;
  const lines = [say(lang, 'greeting', { name }), say(lang, 'intro'), say(lang, 'expiry'), say(lang, 'ignore')];
  return {
    to: user.email,
    subject: say(lang, 'subject', { code }),
    text: `${lines[0]}\n\n${lines[1]}\n\n${code}\n\n${lines[2]}\n\n${lines[3]}\n\nSOPY`,
    html: `<div dir="${languageDir(lang)}" style="font-family:Arial,Helvetica,sans-serif;color:#1C3D2E;max-width:480px;line-height:1.5">
<p>${escapeHtml(lines[0])}</p>
<p>${escapeHtml(lines[1])}</p>
<p dir="ltr" style="font-family:'Courier New',monospace;font-size:32px;font-weight:bold;letter-spacing:6px;text-align:center;background:#F4EFE6;border-radius:8px;padding:12px">${code}</p>
<p>${escapeHtml(lines[2])}</p>
<p style="color:#5b6b63">${escapeHtml(lines[3])}</p>
<p>SOPY</p>
</div>`,
  };
}

// Step 1: send a code to { email } or { phone }.
forgotRouter.post('/', async (req, res) => {
  const found = await findAccounts(req.body);
  if (found.error) return res.status(400).json({ error: found.error });
  if (!deliveryChannels()[found.channel]) {
    return res.status(503).json({
      error: found.channel === 'email'
        ? "Codes by email aren't set up yet. Ask your manager for a reset link."
        : "Codes by text message aren't set up yet. Use your email, or ask your manager for a reset link.",
    });
  }
  const refusal = sendRefusal(found.key);
  if (refusal) return res.status(429).json({ error: refusal });

  // A number on several accounts can't say which one to reset: nothing is
  // sent (the page suggests the email instead).
  if (found.users.length === 1) {
    const user = found.users[0];
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    await query(
      `INSERT INTO password_reset_codes (user_id, channel, code_hash, expires_at)
       VALUES ($1, $2, $3, now() + make_interval(mins => $4))`,
      [user.id, found.channel, codeHash(user.id, code), CODE_MINUTES]
    );
    // In the language of the page they asked from, else their own.
    const lang = isSupportedLanguage(req.body.language) ? req.body.language : user.language;
    try {
      if (found.channel === 'email') await sendEmail(codeEmail(user, code, lang));
      else await sendSms({ to: found.to, text: say(lang, 'sms', { code }) });
    } catch (err) {
      console.error(`Forgot password: could not send the ${found.channel} code:`, err.message);
      return res.status(502).json({ error: "We couldn't send the code. Try again in a few minutes." });
    }
  }
  res.json({ sent: true });
});

// Step 2: check { email | phone, code }. Any live code sent to that person
// counts (a text can arrive after the next one was asked for); every wrong
// try counts against all of them.
forgotRouter.post('/verify', async (req, res) => {
  const code = typeof req.body.code === 'string' ? req.body.code.replace(/\s/g, '') : '';
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Enter the 6-digit code' });
  const found = await findAccounts(req.body);
  if (found.error) return res.status(400).json({ error: found.error });

  const lockKey = `forgot:${found.key}`;
  if (isLocked(lockKey)) return res.status(429).json({ error: LOCKED_MESSAGE });

  const user = found.users.length === 1 ? found.users[0] : null;
  const live = user
    ? (await query(
      `SELECT id, code_hash FROM password_reset_codes
       WHERE user_id = $1 AND used_at IS NULL AND expires_at > now() AND attempts < $2`,
      [user.id, MAX_TRIES]
    )).rows
    : [];
  const hash = user ? codeHash(user.id, code) : '';
  if (!live.some((row) => sameHash(row.code_hash, hash))) {
    recordFailure(lockKey);
    if (live.length) await query('UPDATE password_reset_codes SET attempts = attempts + 1 WHERE id = ANY($1::uuid[])', [live.map((row) => row.id)]);
    return res.status(400).json({ error: "That code isn't right, or it has expired. Check it, or ask for a new one." });
  }
  clearFailures(lockKey);

  // Every code sent so far is spent; the reset token takes over.
  await query('UPDATE password_reset_codes SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [user.id]);
  const resetToken = crypto.randomBytes(24).toString('hex');
  const { rowCount } = await query(
    `UPDATE users SET invite_token = $1, invite_expires_at = now() + make_interval(mins => $2)
     WHERE id = $3 AND status = 'active'`,
    [resetToken, RESET_MINUTES, user.id]
  );
  if (!rowCount) return res.status(400).json({ error: "That code isn't right, or it has expired. Check it, or ask for a new one." });
  res.json({ resetToken });
});

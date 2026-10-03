import nodemailer from 'nodemailer';

// Sends the few messages SOPY writes to people outside the app: for now,
// the code that resets a forgotten password, by email or text message.
//
// Email goes through any SMTP server (SMTP_* settings: Gmail or Google
// Workspace, Zoho, SendGrid, Brevo, Mailgun… all offer one); texts through
// Twilio (TWILIO_*). A channel without its settings is off, and the
// Forgot password page doesn't offer it. Outside production an unset
// channel prints the message in the server's console instead, so the flow
// can be tried locally. Tests swap the sender with setMessageSender().

const env = (name) => (process.env[name] || '').trim();
const devConsole = () => process.env.NODE_ENV !== 'production';

const emailConfigured = () => !!(env('SMTP_HOST') && env('SMTP_FROM'));
const smsConfigured = () => !!(env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN') && (env('TWILIO_FROM') || env('TWILIO_MESSAGING_SERVICE_SID')));

let testSender = null;
// Tests: capture messages instead of sending them (null restores sending).
export function setMessageSender(fn) { testSender = fn; }

export function deliveryChannels() {
  return {
    email: !!testSender || emailConfigured() || devConsole(),
    sms: !!testSender || smsConfigured() || devConsole(),
  };
}

let transport = null;
let transportKey = '';
function mailer() {
  const port = Number(env('SMTP_PORT')) || 587;
  const key = [env('SMTP_HOST'), port, env('SMTP_USER')].join('|');
  if (!transport || key !== transportKey) {
    transport = nodemailer.createTransport({
      host: env('SMTP_HOST'),
      port,
      secure: port === 465, // 465 is TLS from the start; 587 upgrades with STARTTLS
      auth: env('SMTP_USER') ? { user: env('SMTP_USER'), pass: env('SMTP_PASS') } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    transportKey = key;
  }
  return transport;
}

// Said once at start-up, so whoever runs the server sees it in the log: no
// email or text service means nobody can reset their own password (the
// Forgot password page then says reset is unavailable). With SMTP set, it
// also logs in to the mail server, so a wrong password shows up now rather
// than when a customer asks for a code.
export async function reportDeliverySetup(log = console) {
  if (process.env.NODE_ENV !== 'production') return;
  if (!emailConfigured() && !smsConfigured()) {
    log.warn('Forgot password: no email or text message service is set up (SMTP_HOST/SMTP_FROM, or TWILIO_*). People cannot reset their own password until one is.');
    return;
  }
  if (emailConfigured()) {
    try {
      await mailer().verify();
      log.log(`Forgot password: email codes will be sent through ${env('SMTP_HOST')} as ${env('SMTP_FROM')}`);
    } catch (err) {
      log.warn(`Forgot password: could not log in to the mail server ${env('SMTP_HOST')}: ${err.message}`);
    }
  }
  if (smsConfigured()) log.log('Forgot password: text message codes will be sent through Twilio');
}

// { to, subject, text, html } → sent, or throws.
export async function sendEmail(message) {
  if (testSender) return testSender({ channel: 'email', ...message });
  if (!emailConfigured()) {
    if (!devConsole()) throw new Error('Email is not set up (SMTP_HOST, SMTP_FROM)');
    console.log(`[dev email] to ${message.to} — ${message.subject}\n${message.text}`);
    return;
  }
  await mailer().sendMail({ from: env('SMTP_FROM'), to: message.to, subject: message.subject, text: message.text, html: message.html });
}

// { to: '+201222553971', text } → sent, or throws.
export async function sendSms(message) {
  if (testSender) return testSender({ channel: 'sms', ...message });
  if (!smsConfigured()) {
    if (!devConsole()) throw new Error('Text messages are not set up (TWILIO_*)');
    console.log(`[dev sms] to ${message.to} — ${message.text}`);
    return;
  }
  const sid = env('TWILIO_ACCOUNT_SID');
  const body = new URLSearchParams({ To: message.to, Body: message.text });
  if (env('TWILIO_MESSAGING_SERVICE_SID')) body.set('MessagingServiceSid', env('TWILIO_MESSAGING_SERVICE_SID'));
  else body.set('From', env('TWILIO_FROM'));
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${env('TWILIO_AUTH_TOKEN')}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(`Twilio ${res.status}: ${detail.message || res.statusText}`);
  }
}

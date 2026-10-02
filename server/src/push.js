import webpush from 'web-push';
import { query } from './db.js';
import { DEFAULT_LANGUAGE } from '../../shared/languages.js';

// Phone notifications through Web Push. Every in-app notification (and a
// new message in a direct or incident conversation) is also pushed to the
// browsers its people turned it on in. Without the VAPID_* settings
// (server/.env.example) nothing is pushed and the app hides the option.
//
// Sending never blocks the request that caused it and never throws: a push
// is a courtesy on top of the Inbox and the bell, which always have it.

export function pushPublicKey() {
  return process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ? process.env.VAPID_PUBLIC_KEY : null;
}

// Push services browsers use. The server sends to whatever endpoint the
// browser hands it, so anything else is refused, or a crafted
// subscription could make the server call an address of the attacker's choosing.
const PUSH_HOSTS = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'push.apple.com', 'notify.windows.com', 'push.services.mozilla.com'];
export function isPushEndpoint(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && PUSH_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

let sender = (subscription, payload, options) => webpush.sendNotification(subscription, payload, options);
// Tests swap in a fake push service.
export function setPushSender(fn) { sender = fn; }

const inFlight = new Set();
// Resolves when every push started so far has finished (tests use this).
export function pushesSettled() { return Promise.allSettled([...inFlight]); }

// --- Wording, in each person's own language --------------------------
const REPORT_NAMES = {
  kitchen_daily: ['Kitchen Daily Operation Report', 'تقرير التشغيل اليومي للمطبخ', "Rapport journalier d'exploitation cuisine"],
  bar_daily: ['Bar & Beverage Daily Operation Report', 'تقرير التشغيل اليومي للبار والمشروبات', "Rapport journalier d'exploitation bar et boissons"],
  opening_daily: ['Daily Opening Report', 'تقرير الافتتاح اليومي', "Rapport d'ouverture quotidien"],
  closing_daily: ['Daily Closing Report', 'تقرير الإغلاق اليومي', 'Rapport de fermeture quotidien'],
  qc_visit: ['QC Visit Report', 'تقرير زيارة مراقبة الجودة', 'Rapport de visite qualité'],
  area_manager_visit: ['Area Manager Visit Report', 'تقرير زيارة مدير المنطقة', 'Rapport de visite du responsable de secteur'],
  ops_manager_visit: ['Operations Manager Visit Report', 'تقرير زيارة مدير العمليات', "Rapport de visite du directeur d'exploitation"],
};
const LANG_INDEX = { en: 0, ar: 1, fr: 2 };

// Mirrors notif.* / inbox.* in web/src/i18n/appLabels.js.
const TEXT = {
  criticalTitle: ['Critical fail flagged', 'رُصد إخفاق حرج', 'Échec critique signalé'],
  incidentTitle: ['Incident flagged', 'رُصدت حادثة', 'Incident signalé'],
  incidentBody: ['{report} at {store}. Filed by {name}.', '{report} في {store}. قدّمه {name}.', '{report} à {store}. Déposé par {name}.'],
  submittedTitle: ['{report} submitted', 'تم تقديم {report}', '{report} envoyé'],
  dueTitle: ['{report} due at {time}', '{report} مستحق الساعة {time}', '{report} à faire avant {time}'],
  dueNotStarted: ['Not started yet', 'لم يبدأ بعد', 'Pas encore commencé'],
  dueStarted: ['Started, not signed off yet', 'بدأ ولم يُعتمد بعد', 'Commencé, pas encore validé'],
  allStores: ['All stores', 'جميع الفروع', 'Tous les établissements'],
  referralTitle: ['Referral credit earned', 'حصلت على رصيد إحالة', 'Crédit de parrainage obtenu'],
  referralBody: ['{name} made its first payment. {amount} comes off your next SOPY payment.', 'سدّد {name} أول دفعة. سيُخصم {amount} من دفعتك القادمة في SOPY.', '{name} a effectué son premier paiement. {amount} seront déduits de votre prochain paiement SOPY.'],
  incidentThread: ['Incident · {report}', 'حادثة · {report}', 'Incident · {report}'],
  storeTeam: ['{store} team', 'فريق {store}', 'Équipe {store}'],
};

function say(lang, key, vars = {}) {
  let out = TEXT[key][LANG_INDEX[lang] ?? 0];
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, v ?? '');
  return out;
}
const report = (lang, d) => REPORT_NAMES[d.kind]?.[LANG_INDEX[lang] ?? 0] || d.templateNames?.[lang] || d.templateName || '';

// A checklist started from the Library is named after its SOP or audit in
// English ("NFSA Site Visit"). Its name in each language is the part before
// " — " of its sections' translated category, as the app shows it
// (GET /checklists/library/groups); pushes used to give the English name to everyone.
async function libraryNames(templateName, langs) {
  const out = {};
  const like = `${templateName.replace(/[\\%_]/g, (c) => `\\${c}`)} — %`;
  for (const lang of langs) {
    if (lang === 'en') continue;
    const { rows } = await query('SELECT translated FROM content_translations WHERE lang = $1 AND source_text LIKE $2 LIMIT 1', [lang, like]);
    if (rows[0]) out[lang] = rows[0].translated.split(' — ')[0];
  }
  return out;
}
const clip = (s, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// kind + data (as stored on a notification) → { title, body } in `lang`.
export function pushText(kind, d, lang) {
  switch (kind) {
    case 'incident':
      return {
        title: say(lang, d.criticalFails > 0 ? 'criticalTitle' : 'incidentTitle'),
        body: say(lang, 'incidentBody', { report: report(lang, d), store: d.branchName, name: d.submittedByName }),
      };
    case 'report_submitted':
      return { title: say(lang, 'submittedTitle', { report: report(lang, d) }), body: `${d.submittedByName} · ${d.branchName}` };
    case 'checklist_due':
      return {
        title: say(lang, 'dueTitle', { report: report(lang, d), time: d.dueTime }),
        body: `${d.branchName || say(lang, 'allStores')} · ${say(lang, d.started ? 'dueStarted' : 'dueNotStarted')}`,
      };
    case 'referral_credit':
      return { title: say(lang, 'referralTitle'), body: say(lang, 'referralBody', { name: d.restaurantName, amount: `$${Number(d.amount || 0).toFixed(2)}` }) };
    case 'message':
      return {
        title: d.incident ? `${d.senderName} · ${say(lang, 'incidentThread', { report: report(lang, d) })}`
          : d.store ? `${d.senderName} · ${say(lang, 'storeTeam', { store: d.store })}` : d.senderName,
        body: clip(d.body || ''),
      };
    default:
      return { title: 'SOPY', body: '' };
  }
}

// Push one notification to every browser of these people.
// `url` is where tapping it opens; `tag` replaces an older push with the same tag.
export function pushToUsers(userIds, kind, data, { url = '/app/notifications', tag } = {}) {
  if (!pushPublicKey() || !userIds.length) return;
  const job = (async () => {
    const { rows } = await query(
      `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth, u.language FROM push_subscriptions ps
       JOIN users u ON u.id = ps.user_id AND u.status = 'active'
       WHERE ps.user_id = ANY($1::uuid[])`,
      [userIds]
    );
    const named = !REPORT_NAMES[data.kind] && data.templateName
      ? { ...data, templateNames: await libraryNames(data.templateName, [...new Set(rows.map((s) => s.language || DEFAULT_LANGUAGE))]) }
      : data;
    const vapidDetails = {
      subject: process.env.VAPID_SUBJECT || 'mailto:support@example.com',
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
    await Promise.all(rows.map(async (s) => {
      const lang = s.language || DEFAULT_LANGUAGE;
      const payload = JSON.stringify({ ...pushText(kind, named, lang), url, tag, lang, dir: lang === 'ar' ? 'rtl' : 'ltr' });
      try {
        await sender({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { vapidDetails, TTL: 6 * 3600 });
      } catch (err) {
        // Gone or not found: the browser dropped this subscription.
        if (err.statusCode === 404 || err.statusCode === 410) await query('DELETE FROM push_subscriptions WHERE id = $1', [s.id]);
        else console.error('Push failed:', err.statusCode || err.message);
      }
    }));
  })().catch((err) => console.error('Push failed:', err.message));
  inFlight.add(job);
  job.finally(() => inFlight.delete(job));
}

import { reportTitle } from '../../i18n/formLabels.js';

// Wording for SOPY's own messages and notifications. The server stores
// what happened (kind + data); the words are made here, so each person
// reads them in their own language.

export function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

const reportOf = (t, data) => reportTitle(t, data.kind, data.templateName);

// One line on why a report is an incident.
export function incidentReason(t, data) {
  if (data.criticalFails > 0) return t('inbox.criticalFailed', { n: data.criticalFails });
  if (data.temperatureIssues > 0) return t('inbox.tempsOut', { n: data.temperatureIssues });
  return t('inbox.flagged');
}

export function incidentMessage(t, data) {
  const parts = [
    t('inbox.incidentAt', { report: reportOf(t, data), store: data.branchName }),
    incidentReason(t, data),
    t('inbox.filedBy', { name: data.submittedByName }),
  ];
  if (data.notified) parts.push(t('inbox.notifiedCount', { n: data.notified }));
  return parts.join(' ');
}

export function threadTitle(t, thread) {
  if (thread.kind === 'store') return t('inbox.storeChat', { store: thread.branch_name || '' });
  if (thread.kind === 'incident') return t('inbox.incidentTitle', { report: reportTitle(t, thread.report_kind, thread.template_name) });
  return thread.other_name || t('inbox.formerMember');
}

export function threadSub(t, thread) {
  if (thread.kind === 'store') return t('inbox.memberCount', { n: thread.member_count });
  if (thread.kind === 'incident') return t('inbox.members', { store: thread.branch_name || '', n: thread.member_count });
  return thread.other_title || (thread.other_role ? t(`role.${thread.other_role}`) : '');
}

// The avatar text: initials of the person, of the store, or "!" for an incident.
export function threadAvatar(thread) {
  if (thread.kind === 'incident') return '!';
  if (thread.kind === 'store') return initials(thread.branch_name);
  return initials(thread.other_name);
}

export function lastPreview(t, thread, myId) {
  if (!thread.last_kind) return thread.kind === 'store' ? t('inbox.storeChatEmpty') : '';
  if (thread.last_kind === 'incident') return incidentReason(t, thread.last_data || {});
  const body = thread.last_body || '';
  if (thread.last_sender_id === myId) return t('inbox.you', { text: body });
  // In a group, say who wrote it.
  if (thread.kind !== 'direct' && thread.last_sender_name) return `${thread.last_sender_name.split(' ')[0]}: ${body}`;
  return body;
}

export function notificationText(t, n) {
  const d = n.data || {};
  switch (n.kind) {
    case 'incident':
      return {
        tone: 'red',
        title: d.criticalFails > 0 ? t('notif.criticalTitle') : t('notif.incidentTitle'),
        body: `${t('inbox.incidentAt', { report: reportOf(t, d), store: d.branchName })} ${incidentReason(t, d)} ${t('inbox.filedBy', { name: d.submittedByName })}`,
      };
    case 'report_submitted':
      return {
        tone: 'green',
        title: t('notif.submittedTitle', { report: reportOf(t, d) }),
        body: `${d.submittedByName} · ${d.branchName}`,
      };
    case 'checklist_due':
      return {
        tone: 'amber',
        title: t('notif.dueTitle', { report: reportOf(t, d), time: d.dueTime }),
        body: `${d.branchName || t('common.allStores')} · ${t(d.started ? 'notif.dueStarted' : 'notif.dueNotStarted')}`,
      };
    case 'referral_credit':
      return {
        tone: 'green',
        title: t('notif.referralTitle'),
        body: t('notif.referralBody', { name: d.restaurantName, amount: `$${Number(d.amount || 0).toFixed(2)}` }),
      };
    default:
      return { tone: 'green', title: t('app.notifications'), body: '' };
  }
}

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// "09:14" today, "Yesterday", then the weekday this week, then the date.
export function shortTime(t, lang, value) {
  if (!value) return '';
  const d = new Date(value);
  const now = new Date();
  if (sameDay(d, now)) return new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(d);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return t('inbox.yesterday');
  if (now - d < 6 * 86_400_000) return new Intl.DateTimeFormat(lang, { weekday: 'short' }).format(d);
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).format(d);
}

export function isToday(value) {
  return sameDay(new Date(value), new Date());
}

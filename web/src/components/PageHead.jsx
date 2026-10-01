import React from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../i18n/index.jsx';
import { BellIcon } from './icons.jsx';
import { useInboxBadges } from './inboxBadges.jsx';

// The big serif title at the top of a tab (Library, Reports, Inbox,
// Profile), with the notifications bell beside it.
export default function PageHead({ title, intro, bell = true }) {
  return (
    <div className="page-head">
      <div className="page-head-row">
        <h1>{title}</h1>
        {bell && <BellButton />}
      </div>
      {intro && <p className="page-head-intro">{intro}</p>}
    </div>
  );
}

export function BellButton({ onDark = false }) {
  const t = useT();
  const { unreadNotifications } = useInboxBadges();
  return (
    <Link
      to="/app/notifications"
      className={`bell-btn${onDark ? ' bell-btn-dark' : ''}`}
      aria-label={unreadNotifications ? t('app.notificationsUnread', { n: unreadNotifications }) : t('app.notifications')}
    >
      <BellIcon size={20} />
      {unreadNotifications > 0 && <span className="count-badge bell-badge">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}
    </Link>
  );
}

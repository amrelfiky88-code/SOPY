import React from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../i18n/index.jsx';
import { ShareIcon } from './icons.jsx';

// "View & share report" — shown right after a report or checklist is
// submitted, leading to its PDF/WhatsApp/email share options.
export default function ReportLink({ submissionId, style }) {
  const t = useT();
  if (!submissionId) return null;
  return (
    <Link to={`/app/reports/${submissionId}`} className="btn btn-primary" style={{ marginTop: 12, ...style }}>
      <ShareIcon size={18} /> {t('share.viewReport')}
    </Link>
  );
}

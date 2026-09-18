import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useI18n } from '../../i18n/index.jsx';
import { formatDateTime } from '../../lib/reportModel.js';
import { FileTextIcon, ClipboardEmptyIcon } from '../../components/icons.jsx';

// Submitted reports and checklists, newest first — the way back to a
// report to view or share it later. Staff see their own; managers see all.
export default function ReportsList() {
  const { t, lang } = useI18n();
  const [submissions, setSubmissions] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    api.get('/submissions?status=submitted')
      .then((d) => setSubmissions(d.submissions))
      .catch((err) => setError(err.message));
  };
  useEffect(load, []);

  return (
    <div>
      <h2>{t('reports.title')}</h2>
      <p>{t('reports.subtitle')}</p>
      {error && (
        <div className="error-banner">
          {error}{' '}
          <button type="button" className="link-btn" onClick={load}>{t('common.tryAgain')}</button>
        </div>
      )}
      {!submissions && !error && <p>{t('reports.loading')}</p>}
      {submissions && submissions.length === 0 && (
        <div className="card empty-state">
          <ClipboardEmptyIcon size={32} />
          <span>{t('reports.empty')}</span>
        </div>
      )}
      {submissions && submissions.length > 0 && (
        <div className="card report-list">
          {submissions.map((s) => (
            <Link key={s.id} to={`/app/reports/${s.id}`} className="report-list-row">
              <span className="report-list-icon"><FileTextIcon size={22} /></span>
              <span className="report-list-text">
                <strong>{s.template_name}</strong>
                <span className="hint">
                  {s.branch_name} · {formatDateTime(s.submitted_at || s.started_at, lang)} · {s.submitted_by_name}
                </span>
              </span>
              {s.has_incident && <span className="pill pill-red">{t('reports.incident')}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

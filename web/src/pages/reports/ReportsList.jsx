import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useI18n } from '../../i18n/index.jsx';
import { formatDateTime } from '../../lib/reportModel.js';
import { reportTitle } from '../../i18n/formLabels.js';
import { FileTextIcon, ClipboardEmptyIcon } from '../../components/icons.jsx';

// Submitted reports and checklists, newest first — the way back to a
// report to view or share it later. Staff see their own; managers see all.
export default function ReportsList() {
  const { t, lang } = useI18n();
  const [submissions, setSubmissions] = useState(null);
  const [nextBefore, setNextBefore] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  // Pages of 50, newest first; "Load more" fetches the next page.
  const load = (before) => {
    setError('');
    if (before) setLoadingMore(true);
    const params = new URLSearchParams({ status: 'submitted' });
    if (before) params.set('before', before);
    api.get(`/submissions?${params}`)
      .then((d) => {
        setSubmissions((prev) => (before ? [...(prev || []), ...d.submissions] : d.submissions));
        setNextBefore(d.nextBefore);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingMore(false));
  };
  useEffect(() => load(), []);

  return (
    <div>
      <h2>{t('reports.title')}</h2>
      <p>{t('reports.subtitle')}</p>
      {error && (
        <div className="error-banner">
          {error}{' '}
          <button type="button" className="link-btn" onClick={() => load(submissions?.length ? nextBefore : undefined)}>{t('common.tryAgain')}</button>
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
                <strong>{reportTitle(t, s.kind, s.template_name)}</strong>
                <span className="hint">
                  {s.branch_name} · {formatDateTime(s.submitted_at || s.started_at, lang)} · {s.submitted_by_name}
                </span>
              </span>
              {s.has_incident && <span className="pill pill-red">{t('reports.incident')}</span>}
            </Link>
          ))}
        </div>
      )}
      {nextBefore && (
        <button type="button" className="btn btn-secondary" onClick={() => load(nextBefore)} disabled={loadingMore}>
          {loadingMore ? t('reports.loading') : t('reports.loadMore')}
        </button>
      )}
    </div>
  );
}

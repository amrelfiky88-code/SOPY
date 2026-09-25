import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useI18n } from '../../i18n/index.jsx';
import { buildReportModel } from '../../lib/reportModel.js';
import ShareReport from '../../components/ShareReport.jsx';

const PILL = { good: 'pill-green', warn: 'pill-amber', bad: 'pill-red', muted: '' };

// A finished report as a readable page, plus the ways to share it. The
// PDF is drawn from the same blocks rendered here.
export default function ReportView() {
  const { submissionId } = useParams();
  const { t, lang, dir } = useI18n();
  const back = dir === 'rtl' ? '→' : '←'; // points toward the start of the line
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setReport(null);
    setError('');
    api.get(`/submissions/${submissionId}/report?lang=${lang}`)
      .then(setReport)
      .catch((err) => setError(err.message));
  }, [submissionId, lang]);

  const model = useMemo(() => (report ? buildReportModel(report, t, lang) : null), [report, t, lang]);

  if (error) {
    return (
      <div>
        <Link to="/app/reports" className="back-link">{back} {t('reports.title')}</Link>
        <div className="error-banner">{error}</div>
      </div>
    );
  }
  if (!model) return <p>{t('reports.loading')}</p>;

  const submitted = report.submission.status === 'submitted';

  return (
    <div className="report-view">
      <Link to="/app/reports" className="back-link">{back} {t('reports.title')}</Link>

      {submitted ? (
        <ShareReport submissionId={submissionId} model={model} />
      ) : (
        <div className="card"><p style={{ margin: 0 }}>{t('reports.notSubmitted')}</p></div>
      )}

      <div className="card report-doc">
        {model.blocks.map((block, i) => <ReportBlock key={i} block={block} t={t} />)}
      </div>
    </div>
  );
}

function ReportBlock({ block, t }) {
  switch (block.type) {
    case 'title':
      return (
        <div className="report-title">
          <h2 style={{ margin: 0 }}>{block.text}</h2>
          {block.subtitle && <p style={{ margin: '4px 0 0' }}>{block.subtitle}</p>}
        </div>
      );
    case 'meta':
      return (
        <dl className="report-meta">
          {block.rows.map(([label, value]) => (
            <React.Fragment key={label}>
              <dt>{label}</dt>
              <dd>{value || '—'}</dd>
            </React.Fragment>
          ))}
        </dl>
      );
    case 'alert':
      return <div className="error-banner">{block.text}</div>;
    case 'score':
      return (
        <div className="report-score">
          <div>
            <div className="report-score-value">{block.value}</div>
            <div className="hint">{block.detail}</div>
            {block.extra && <div className="hint" style={{ color: 'var(--red)', fontWeight: 600 }}>{block.extra}</div>}
          </div>
          <span className={`pill ${PILL[block.tone] || ''}`}>{block.badge}</span>
        </div>
      );
    case 'heading':
      return <h3 className="report-heading">{block.text}</h3>;
    case 'subheading':
      return <div className="report-subheading">{block.text}</div>;
    case 'row':
      return (
        <div className="report-row">
          <span className="report-row-label">{block.label}</span>
          <span className="report-row-value" style={block.tone === 'bad' ? { color: 'var(--red)' } : undefined}>{block.value}</span>
        </div>
      );
    case 'item':
      return (
        <div className="report-item">
          <div className="report-item-head">
            <span>{block.text}</span>
            {block.result && <span className={`pill ${PILL[block.tone] || ''}`}>{block.result}</span>}
          </div>
          {block.critical && <span className="pill pill-red">{t('report.critical')}</span>}
          {block.note && <div className="hint">{block.note}</div>}
          {block.photo && <img className="report-photo" src={block.photo} alt="" loading="lazy" />}
        </div>
      );
    default:
      return null;
  }
}

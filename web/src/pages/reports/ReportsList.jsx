import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useI18n } from '../../i18n/index.jsx';
import { formatDateTime } from '../../lib/reportModel.js';
import { reportTitle } from '../../i18n/formLabels.js';
import { FileTextIcon, ClipboardEmptyIcon, ClipboardCheckIcon, SearchIcon, StoveIcon, CoffeeIcon, DoorOpenIcon, DoorClosedIcon, MapPinIcon, BriefcaseIcon } from '../../components/icons.jsx';
import PageHead from '../../components/PageHead.jsx';
import { foldText } from '../../../../shared/searchText.js';

const DAILY = ['kitchen_daily', 'bar_daily', 'opening_daily', 'closing_daily'];
const VISITS = ['qc_visit', 'area_manager_visit', 'ops_manager_visit'];
const KIND_ICONS = { kitchen_daily: StoveIcon, bar_daily: CoffeeIcon, opening_daily: DoorOpenIcon, closing_daily: DoorClosedIcon, qc_visit: SearchIcon, area_manager_visit: MapPinIcon, ops_manager_visit: BriefcaseIcon, custom: ClipboardCheckIcon };
const FILTERS = {
  all: () => true,
  incidents: (s) => s.has_incident,
  checklists: (s) => s.kind === 'custom',
  daily: (s) => DAILY.includes(s.kind),
  visits: (s) => VISITS.includes(s.kind),
};

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

  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  // Searches and filters the reports loaded so far; "Load more" brings older ones in.
  const shown = useMemo(() => {
    const needle = foldText(q).trim();
    return (submissions || []).filter((s) => FILTERS[filter](s) && (!needle
      || [reportTitle(t, s.kind, s.template_name), s.branch_name, s.submitted_by_name].some((v) => foldText(v).includes(needle))));
  }, [submissions, q, filter, lang, t]);

  return (
    <div>
      <PageHead title={t('reports.title')} intro={t('reports.subtitle')} />
      <div className="search-box">
        <SearchIcon size={16} />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('reports.search')} aria-label={t('reports.search')} />
      </div>
      <div className="chip-row">
        {Object.keys(FILTERS).map((f) => (
          <button key={f} type="button" className={`chip${filter === f ? ' active' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>{t(`reports.filter.${f}`)}</button>
        ))}
      </div>
      {error && (
        <div className="error-banner">
          {error}{' '}
          <button type="button" className="link-btn" onClick={() => load(submissions?.length ? nextBefore : undefined)}>{t('common.tryAgain')}</button>
        </div>
      )}
      {!submissions && !error && <p>{t('reports.loading')}</p>}
      {submissions && shown.length === 0 && (
        <div className="empty-state">
          <ClipboardEmptyIcon size={32} />
          <span>{submissions.length ? t('reports.noMatch') : t('reports.empty')}</span>
        </div>
      )}
      {shown.length > 0 && (
        <div className="list-card report-list" style={{ marginBottom: 16 }}>
          {shown.map((s) => {
            const Icon = KIND_ICONS[s.kind] || FileTextIcon;
            return (
              <Link key={s.id} to={`/app/reports/${s.id}`} className="list-row">
                <span className={`icon-tile${s.has_incident ? ' tone-red' : ''}`}><Icon size={20} /></span>
                <span className="row-text report-list-text">
                  <span className="row-title">{reportTitle(t, s.kind, s.template_name)}</span>
                  <span className="row-meta report-list-meta">
                    {/* Each part isolated: a Latin store name beside an Arabic date scrambled the date. */}
                    <bdi>{s.branch_name}</bdi> · <bdi>{formatDateTime(s.submitted_at || s.started_at, lang)}</bdi> · <bdi>{s.submitted_by_name}</bdi>
                  </span>
                </span>
                {s.has_incident && <span className="pill pill-red" style={{ flexShrink: 0 }}>{t('reports.incident')}</span>}
              </Link>
            );
          })}
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

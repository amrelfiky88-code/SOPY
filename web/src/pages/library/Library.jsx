import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHead from '../../components/PageHead.jsx';
import { ClipboardCheckIcon, ClipboardEmptyIcon, SearchIcon, ChevronEndIcon, ShieldIcon, StorefrontIcon, LayersIcon, AlertTriangleIcon } from '../../components/icons.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { loadLibrary, groupTitle } from './libraryData.js';

const FILTERS = ['all', 'qc', 'nfsa', 'sop', 'health', 'starter', 'cstore', 'custom'];
const FILTER_ICONS = { qc: ClipboardCheckIcon, nfsa: ShieldIcon, sop: LayersIcon, health: AlertTriangleIcon, starter: ShieldIcon, cstore: StorefrontIcon, custom: ClipboardCheckIcon };

// Library: every SOP and audit in the checkpoint library, searchable by
// name or by any checkpoint's wording (in the language shown or English).
export default function Library() {
  const { t, lang } = useI18n();
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let current = true;
    setError('');
    loadLibrary(lang).then((g) => { if (current) setGroups(g); }).catch((err) => { if (current) setError(err.message); });
    return () => { current = false; };
  }, [lang, reload]);

  const shown = useMemo(() => {
    if (!groups) return [];
    const needle = q.trim().toLocaleLowerCase(lang);
    const has = (s) => !!s && s.toLocaleLowerCase(lang).includes(needle);
    return groups.filter((g) => {
      if (filter !== 'all' && g.filter !== filter) return false;
      if (!needle) return true;
      return has(groupTitle(t, g)) || has(g.code) || has(g.key)
        || g.items.some((i) => has(i.text) || has(i.text_en) || has(i.description) || has(i.category));
    });
  }, [groups, q, filter, lang, t]);

  const present = new Set((groups || []).map((g) => g.filter));
  const total = shown.reduce((n, g) => n + g.items.length, 0);

  return (
    <div>
      <PageHead title={t('app.tabLibrary')} intro={t('library.intro')} />
      <div className="search-box">
        <SearchIcon size={16} />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('library.search')} aria-label={t('library.search')} />
      </div>
      <div className="chip-row">
        {FILTERS.filter((f) => f === 'all' || present.has(f)).map((f) => (
          <button key={f} type="button" className={`chip${filter === f ? ' active' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {t(`library.filter.${f}`)}
          </button>
        ))}
      </div>

      {error && (
        <div className="error-banner">
          {error}{' '}
          <button type="button" className="link-btn" onClick={() => setReload((n) => n + 1)}>{t('common.tryAgain')}</button>
        </div>
      )}
      {!groups && !error && <p className="hint">{t('common.loading')}</p>}
      {groups && (
        <>
          <div className="hint" style={{ margin: '0 4px 8px' }}>{t('library.count', { groups: shown.length, items: total })}</div>
          {shown.length === 0 ? (
            <div className="empty-state"><ClipboardEmptyIcon size={32} /><span>{t('library.none')}</span></div>
          ) : (
            <div className="list-card">
              {shown.map((g) => {
                const Icon = FILTER_ICONS[g.filter] || ClipboardCheckIcon;
                return (
                  <Link key={g.key} to={`/app/library/${encodeURIComponent(g.key)}`} className="list-row">
                    <span className={`icon-tile${g.researched ? ' tone-amber' : ''}`}><Icon size={20} /></span>
                    <span className="row-text">
                      <span className="row-code" dir="ltr">{g.code}</span>
                      <span className="row-title">{groupTitle(t, g)}</span>
                      <span className="row-meta">
                        {t('library.checkpoints', { n: g.items.length })} · {t(`kpi.${g.frequency}`)}
                        {g.critical > 0 && <> · {t('library.criticalCount', { n: g.critical })}</>}
                      </span>
                    </span>
                    {g.researched && <span className="pill pill-amber" style={{ fontSize: 11 }}>{t('library.researched')}</span>}
                    <span className="row-chev"><ChevronEndIcon size={16} /></span>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

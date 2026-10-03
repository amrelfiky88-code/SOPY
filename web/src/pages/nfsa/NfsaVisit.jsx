import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { useReconnect } from '../../lib/useReconnect.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { formatDateTime } from '../../lib/reportModel.js';
import { loadLibrary } from '../library/libraryData.js';
import {
  ShieldIcon, UserIcon, StorefrontIcon, ThermometerIcon, TrashIcon, ClipboardCheckIcon,
  FileTextIcon, PlayIcon, ChevronEndIcon,
} from '../../components/icons.jsx';

// The library group the NFSA checkpoints form (server/db/seed_nfsa.sql).
export const NFSA_GROUP = 'NFSA Site Visit';

const AREAS = [
  { key: 'staff', icon: UserIcon },
  { key: 'premises', icon: StorefrontIcon },
  { key: 'storage', icon: ThermometerIcon },
  { key: 'pests', icon: TrashIcon },
  { key: 'haccp', icon: ClipboardCheckIcon },
];
const DOCUMENTS = ['doc1', 'doc2', 'doc3', 'doc4', 'doc5', 'doc6'];

// NFSA site visit: what the Egyptian National Food Safety Authority's
// inspectors check and how a visit is scored, and a self-inspection to run
// before one — the NFSA checkpoints from the library, through Library
// "Run now", so it gets photos, scoring and a report like any checklist.
export default function NfsaVisit() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState(undefined);
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState('');
  const [past, setPast] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  // Something failed to load (offline): all of it is fetched again when the
  // signal returns. Past runs used to read "none yet" and the store list
  // stayed empty.
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  useReconnect(() => { if (failed) { setFailed(false); setError(''); setReloadKey((k) => k + 1); } });

  useEffect(() => {
    let current = true;
    loadLibrary(lang)
      .then((groups) => { if (current) setGroup(groups.find((g) => g.key === NFSA_GROUP) || null); })
      .catch((err) => { if (current) { setFailed(true); setError(err.message); } });
    return () => { current = false; };
  }, [lang, reloadKey]);

  // The stores this person can run it at, as in the Library.
  useEffect(() => {
    Promise.all([api.get('/tenants/branches'), api.get('/checklists/my-assignments')])
      .then(([{ branches }, { myBranchIds }]) => {
        const all = ['business_owner', 'operations_manager'].includes(user?.role);
        const mine = branches.filter((b) => (myBranchIds || []).includes(b.id));
        const list = all || !mine.length ? branches : mine;
        setStores(list);
        setStoreId((s) => s || list.find((b) => b.works_here)?.id || list[0]?.id || '');
      })
      .catch((err) => { setFailed(true); setError(err.message); });
  }, [user?.role, reloadKey]);

  useEffect(() => {
    api.get(`/submissions?${new URLSearchParams({ libraryGroup: NFSA_GROUP, limit: '5' })}`)
      .then((d) => setPast(d.submissions))
      .catch(() => setFailed(true));
  }, [reloadKey]);

  const start = async () => {
    if (running || !storeId) return;
    setRunning(true);
    setError('');
    try {
      const { submission } = await api.post('/checklists/library/run', { group: NFSA_GROUP, branchId: storeId });
      navigate(`/app/checklists/run/${submission.id}`);
    } catch (err) {
      setError(err.message);
      setRunning(false);
    }
  };

  return (
    <div className="has-sticky-actions">
      <span className="code-pill" dir="ltr">NFSA</span>
      <h2 style={{ margin: '10px 0 8px', fontSize: 28, lineHeight: 1.15 }}>{t('nfsa.title')}</h2>
      <p style={{ marginTop: 0 }}>{t('nfsa.intro')}</p>

      {group && (
        <div className="stat-grid" style={{ margin: '14px 0' }}>
          <div className="stat-box"><div className="stat-value">{group.items.length}</div><div className="stat-label">{t('library.statCheckpoints')}</div></div>
          <div className="stat-box"><div className="stat-value" style={{ color: 'var(--red)' }}>{group.critical}</div><div className="stat-label">{t('library.statCritical')}</div></div>
          <div className="stat-box"><div className="stat-value" style={{ fontSize: 16 }}>{t(`kpi.${group.frequency}`)}</div><div className="stat-label">{t('library.statFrequency')}</div></div>
        </div>
      )}

      <div className="section-label">{t('nfsa.scoringTitle')}</div>
      <div className="list-card">
        <div className="list-row">
          <span className="pill pill-red">{t('nfsa.tierCritical')}</span>
          <span className="row-text"><span className="row-meta" style={{ whiteSpace: 'normal' }}>{t('nfsa.tierCriticalNote')}</span></span>
        </div>
        <div className="list-row">
          <span className="pill pill-amber">{t('nfsa.tierImportant')}</span>
          <span className="row-text"><span className="row-meta" style={{ whiteSpace: 'normal' }}>{t('nfsa.someAccepted')}</span></span>
        </div>
        <div className="list-row">
          <span className="pill">{t('nfsa.tierNecessary')}</span>
          <span className="row-text"><span className="row-meta" style={{ whiteSpace: 'normal' }}>{t('nfsa.someAccepted')}</span></span>
        </div>
      </div>

      <div className="section-label">{t('nfsa.checksTitle')}</div>
      <div className="list-card">
        {AREAS.map(({ key, icon: Icon }) => (
          <div key={key} className="list-row">
            <span className="icon-tile icon-tile-sm"><Icon size={18} /></span>
            <span className="row-text">
              <span className="row-title">{t(`nfsa.area.${key}`)}</span>
              <span className="row-meta" style={{ whiteSpace: 'normal' }}>{t(`nfsa.area.${key}Note`)}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="section-label">{t('nfsa.docsTitle')}</div>
      <div className="list-card">
        {DOCUMENTS.map((key) => (
          <div key={key} className="list-row">
            <span className="icon-tile icon-tile-sm"><FileTextIcon size={18} /></span>
            <span className="row-text"><span className="row-title" style={{ fontWeight: 400, whiteSpace: 'normal' }}>{t(`nfsa.${key}`)}</span></span>
          </div>
        ))}
      </div>

      <div className="section-label">{t('nfsa.pastTitle')}</div>
      <div className="list-card">
        {past === null && !failed && <div className="list-row"><span className="hint">{t('common.loading')}</span></div>}
        {past && past.length === 0 && <div className="list-row"><span className="hint">{t('nfsa.noneYet')}</span></div>}
        {past && past.map((s) => {
          const done = s.status === 'submitted';
          return (
            <Link key={s.id} to={done ? `/app/reports/${s.id}` : `/app/checklists/run/${s.id}`} className="list-row">
              <span className="icon-tile icon-tile-sm"><ShieldIcon size={18} /></span>
              <span className="row-text">
                <span className="row-title"><bdi>{s.branch_name}</bdi></span>
                <span className="row-meta"><bdi>{formatDateTime(s.submitted_at || s.started_at, lang)}</bdi> · <bdi>{s.submitted_by_name}</bdi></span>
              </span>
              {!done && <span className="pill pill-amber">{t('nfsa.inProgress')}</span>}
              {done && s.has_incident && <span className="pill pill-red">{t('reports.incident')}</span>}
              <span className="row-chev"><ChevronEndIcon size={16} /></span>
            </Link>
          );
        })}
      </div>

      <div className="source-note" style={{ marginTop: 16 }}>{t('library.sourceNfsa')}</div>
      <p style={{ margin: '12px 0 0' }}>
        <Link to={`/app/library/${encodeURIComponent(NFSA_GROUP)}`}>{t('nfsa.allCheckpoints')}</Link>
      </p>

      <div className="sticky-action-bar">
        {error && <div className="error-banner" style={{ marginBottom: 8 }}>{error}</div>}
        {group === null && <div className="error-banner" style={{ marginBottom: 8 }}>{t('library.notFound')}</div>}
        {stores.length > 1 && (
          <select aria-label={t('common.store')} value={storeId} onChange={(e) => setStoreId(e.target.value)} className="sticky-store-select">
            {stores.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={start} disabled={running || !storeId || !group}>
          <PlayIcon size={14} />{running ? t('common.saving') : t('nfsa.start')}
        </button>
        {!stores.length && <p className="hint" style={{ textAlign: 'center' }}>{t('dashboard.noStore')}</p>}
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { CameraIcon, PlayIcon } from '../../components/icons.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { librarySection } from '../../../../shared/libraryGroups.js';
import { loadLibrary, groupTitle } from './libraryData.js';

const BUILDERS = ['business_owner', 'operations_manager', 'area_manager'];

// One SOP or audit: its checkpoints by section, where the content came
// from, and two actions — run it now (anyone, at one of their stores) or,
// for managers, add it to a checklist in the Builder.
export default function SopDetail() {
  const { group: key } = useParams();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState(undefined);
  const [error, setError] = useState('');
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState('');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let current = true;
    loadLibrary(lang)
      .then((groups) => { if (current) setGroup(groups.find((g) => g.key === key) || null); })
      .catch((err) => { if (current) setError(err.message); });
    return () => { current = false; };
  }, [key, lang]);

  // The stores this person can run it at: their own, or every store for
  // owners, operations managers and anyone not tied to one.
  useEffect(() => {
    Promise.all([api.get('/tenants/branches'), api.get('/checklists/my-assignments')])
      .then(([{ branches }, { myBranchIds }]) => {
        const all = ['business_owner', 'operations_manager'].includes(user?.role);
        const mine = branches.filter((b) => (myBranchIds || []).includes(b.id));
        const list = all || !mine.length ? branches : mine;
        setStores(list);
        setStoreId((s) => s || list[0]?.id || '');
      })
      .catch(() => {});
  }, [user?.role]);

  const rows = useMemo(() => {
    if (!group) return [];
    let last = null;
    return group.items.map((item, i) => {
      const section = librarySection(item);
      const showSection = section && section !== last && section !== item.category;
      last = section;
      return { item, n: i + 1, section: showSection ? section : null };
    });
  }, [group]);

  const runNow = async () => {
    if (running || !storeId) return;
    setRunning(true);
    setError('');
    try {
      const { submission } = await api.post('/checklists/library/run', { group: key, branchId: storeId });
      navigate(`/app/checklists/run/${submission.id}`);
    } catch (err) {
      setError(err.message);
      setRunning(false);
    }
  };

  const addToChecklist = () => {
    navigate('/app/checklists', {
      state: { preset: { itemIds: group.items.map((i) => i.id), name: group.key, frequency: group.frequency, standard: group.standard } },
    });
  };

  if (group === null) return <div className="empty-state">{t('library.notFound')}</div>;
  if (!group) return error ? <div className="error-banner">{error}</div> : <p className="hint">{t('common.loading')}</p>;

  return (
    <div className="has-sticky-actions">
      <span className="code-pill" dir="ltr">{group.code}</span>
      <h2 style={{ margin: '10px 0 8px', fontSize: 28, lineHeight: 1.15 }}>{groupTitle(t, group)}</h2>
      <div className="stat-grid" style={{ margin: '14px 0' }}>
        <div className="stat-box"><div className="stat-value">{group.items.length}</div><div className="stat-label">{t('library.statCheckpoints')}</div></div>
        <div className="stat-box"><div className="stat-value" style={{ color: 'var(--red)' }}>{group.critical}</div><div className="stat-label">{t('library.statCritical')}</div></div>
        <div className="stat-box"><div className="stat-value" style={{ fontSize: 16 }}>{t(`kpi.${group.frequency}`)}</div><div className="stat-label">{t('library.statFrequency')}</div></div>
      </div>
      <div className={`source-note${group.researched ? ' researched' : ''}`}>
        {t(group.researched ? 'library.sourceResearched' : group.clientOwn ? 'library.sourceClient' : 'library.sourceCustom')}
      </div>

      <div className="section-label">{t('library.statCheckpoints')}</div>
      <div className="list-card">
        {rows.map(({ item, n, section }) => (
          <React.Fragment key={item.id}>
            {section && <div className="step-section">{section}</div>}
            <div className="step-row">
              <span className="num-dot">{n}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15 }}>{item.text}</div>
                {item.description && <div className="hint" style={{ lineHeight: 1.45 }}>{item.description}</div>}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, fontSize: 12, color: 'var(--ink-soft)', flexWrap: 'wrap' }}>
                  {item.is_critical && <span className="pill pill-red" style={{ padding: '1px 8px' }}>{t('library.critical')}</span>}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CameraIcon size={14} />{t('library.photoRequired')}</span>
                </div>
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>

      <div className="sticky-action-bar">
        {error && <div className="error-banner" style={{ marginBottom: 8 }}>{error}</div>}
        {stores.length > 1 && (
          <select aria-label={t('common.store')} value={storeId} onChange={(e) => setStoreId(e.target.value)} style={{ width: '100%', minHeight: 44, marginBottom: 8 }}>
            {stores.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          {BUILDERS.includes(user?.role) && (
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={addToChecklist}>{t('library.addToChecklist')}</button>
          )}
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={runNow} disabled={running || !storeId}>
            <PlayIcon size={14} />{t('library.runNow')}
          </button>
        </div>
        {!stores.length && <p className="hint" style={{ textAlign: 'center' }}>{t('dashboard.noStore')}</p>}
      </div>
    </div>
  );
}

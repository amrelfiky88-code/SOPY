import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { api } from '../../api.js';
import { BellButton } from '../../components/PageHead.jsx';
import {
  ClipboardCheckIcon, ClipboardEmptyIcon, CheckIcon, PlayIcon, StoveIcon, CoffeeIcon, DoorOpenIcon, DoorClosedIcon,
  SearchIcon, MapPinIcon, BriefcaseIcon, ChevronEndIcon, ChevronDownIcon, StorefrontIcon,
  CheckCircleIcon, ThermometerIcon, TrashIcon, AlertTriangleIcon,
} from '../../components/icons.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { reportTitle } from '../../i18n/formLabels.js';

const MANAGERS = ['business_owner', 'operations_manager', 'area_manager'];
const PERIODS = ['daily', 'weekly', 'monthly', 'quarterly'];
const STORE_KEY = 'sopy_today_store';

const DAILY_REPORTS = [
  { to: '/app/forms/kitchen', label: 'tab.kitchen', icon: StoveIcon },
  { to: '/app/forms/bar', label: 'tab.bar', icon: CoffeeIcon },
  { to: '/app/forms/opening', label: 'app.opening', icon: DoorOpenIcon },
  { to: '/app/forms/closing', label: 'app.closing', icon: DoorClosedIcon },
];
const VISIT_REPORTS = [
  { to: '/app/forms/qc-visit', label: 'nav.qcVisit', icon: SearchIcon },
  { to: '/app/forms/area-manager-visit', label: 'nav.areaVisit', icon: MapPinIcon },
  { to: '/app/forms/ops-manager-visit', label: 'nav.opsVisit', icon: BriefcaseIcon },
];

const ASSIGNMENT_ICONS = { opening_daily: DoorOpenIcon, closing_daily: DoorClosedIcon, kitchen_daily: StoveIcon, bar_daily: CoffeeIcon };

function greetingKey(hour) {
  if (hour < 12) return 'app.goodMorning';
  if (hour < 18) return 'app.goodAfternoon';
  return 'app.goodEvening';
}

function readStore() {
  try { return localStorage.getItem(STORE_KEY) || ''; } catch { return ''; }
}

// Today: the shift at a glance. A green header with the store, a greeting
// and how many of today's checklists are done; the checklists themselves;
// shortcuts to the daily (and, for managers, visit) reports; and the
// period's KPIs for managers.
export default function DashboardRouter() {
  const { user, tenant } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const firstVisit = !!useLocation().state?.firstVisit;
  const [assignments, setAssignments] = useState(null);
  const [myBranchIds, setMyBranchIds] = useState([]);
  const [branches, setBranches] = useState([]);
  const [store, setStore] = useState(readStore);
  const [starting, setStarting] = useState(null);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('daily');
  const [kpi, setKpi] = useState(null);
  const [kpiScope, setKpiScope] = useState(null);

  const isManager = MANAGERS.includes(user?.role);
  const seesKpi = !!user && user.role !== 'employee';

  useEffect(() => {
    api.get('/checklists/my-assignments')
      .then((d) => { setAssignments(d.assignments); setMyBranchIds(d.myBranchIds || []); })
      .catch((err) => { setAssignments([]); setError(err.message); });
    api.get('/tenants/branches').then((d) => setBranches(d.branches)).catch(() => {});
  }, []);

  // The stores this person works at; owners and operations managers (or
  // anyone not tied to a store) see every store.
  const myStores = useMemo(() => {
    const mine = branches.filter((b) => myBranchIds.includes(b.id));
    return mine.length ? mine : branches;
  }, [branches, myBranchIds]);
  const currentStore = myStores.find((b) => b.id === store) || null;

  const pickStore = (id) => {
    setStore(id);
    try { localStorage.setItem(STORE_KEY, id); } catch { /* not fatal */ }
  };

  useEffect(() => {
    if (!seesKpi) return undefined;
    let current = true;
    const params = new URLSearchParams({ period });
    // Only a store the KPIs cover (area and store managers see their own).
    if (currentStore && (!kpiScope || kpiScope.includes(currentStore.id))) params.set('branchId', currentStore.id);
    api.get(`/dashboard/kpi?${params}`)
      .then((d) => { if (current) { setKpi(d); setKpiScope((prev) => prev || d.scopedBranchIds || null); } })
      .catch(() => {}); // the glance is optional
    return () => { current = false; };
  }, [seesKpi, period, currentStore, kpiScope]);

  // With a store chosen: that store's checklists plus the "All stores" ones.
  const shown = (assignments || []).filter((a) => !currentStore || !a.branch_id || a.branch_id === currentStore.id);
  const done = shown.filter((a) => a.done).length;
  const pct = shown.length ? Math.round((done / shown.length) * 100) : 0;

  const storeChoices = (a) => (a.branch_id ? branches.filter((b) => b.id === a.branch_id) : myStores);

  const start = async (a) => {
    if (starting) return;
    setError('');
    // "Continue" goes straight back to the run underway.
    if (a.open_submission_id) { navigate(`/app/checklists/run/${a.open_submission_id}`); return; }
    const choices = storeChoices(a);
    const chosen = choices.find((b) => b.id === store);
    const branchId = a.branch_id || chosen?.id || choices[0]?.id;
    if (!branchId) { setError(t('dashboard.noStore')); return; }
    setStarting(a.id);
    try {
      const { submission } = await api.post('/submissions', { templateId: a.template_id, branchId, assignmentId: a.id });
      navigate(`/app/checklists/run/${submission.id}`);
    } catch (err) {
      setError(err.message);
      setStarting(null);
    }
  };

  const firstName = (user?.fullName || '').trim().split(/\s+/)[0] || '';
  const today = new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date());
  const pctLabel = new Intl.NumberFormat(lang, { style: 'percent' }).format(pct / 100);

  return (
    <div>
      <div className="today-hero">
        <div className="hero-top">
          {myStores.length > 1 ? (
            <label className="store-pill">
              <StorefrontIcon size={16} />
              <select aria-label={t('common.store')} value={currentStore?.id || ''} onChange={(e) => pickStore(e.target.value)} className="store-select">
                <option value="">{t('common.allStores')}</option>
                {myStores.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <ChevronDownIcon size={16} />
            </label>
          ) : (
            <span className="store-pill"><StorefrontIcon size={16} /><bdi>{myStores[0]?.name || tenant?.restaurant_name}</bdi></span>
          )}
          <BellButton onDark />
        </div>
        <div className="hero-greeting">
          {firstVisit ? t('dashboard.welcomeFirst', { name: tenant?.restaurant_name || '' }) : t(greetingKey(new Date().getHours()), { name: firstName })}
        </div>
        <div className="hero-sub"><bdi>{tenant?.restaurant_name}</bdi> · {t(`role.${user?.role}`)} · {today}</div>
        {shown.length > 0 && (
          <>
            <div className="hero-progress-label">
              <span>{t('app.checklistsDone', { done, total: shown.length })}</span><span>{pctLabel}</span>
            </div>
            <div className="hero-progress"><div style={{ width: `${pct}%` }} /></div>
          </>
        )}
      </div>

      <div className="stack">
        {error && <div className="error-banner" style={{ marginBottom: 0 }}>{error}</div>}

        <div className="card" style={{ marginBottom: 0, padding: '16px 16px 4px' }}>
          <h3 style={{ margin: '0 0 4px' }}>{t('dashboard.myChecklists')}</h3>
          {assignments && shown.length === 0 && (
            <div className="empty-state">
              <ClipboardEmptyIcon size={32} />
              <span>{t('dashboard.nothingAssigned')}</span>
              {isManager && <Link className="btn btn-primary btn-small" to="/app/checklists">{t('dashboard.buildFirst')}</Link>}
            </div>
          )}
          {shown.map((a, i) => {
            const Icon = ASSIGNMENT_ICONS[a.kind] || ClipboardCheckIcon;
            const choices = storeChoices(a);
            const askStore = !a.branch_id && !a.done && !a.open_submission_id && !currentStore && choices.length > 1;
            return (
              <div key={a.id} className="list-row" style={{ borderTop: i ? '1px solid var(--line)' : 'none', cursor: 'default' }}>
                <span className={`icon-tile${a.done ? '' : ' tone-solid'}`}><Icon size={20} /></span>
                <span className="row-text">
                  <span className="row-title">{reportTitle(t, a.kind, a.template_name)}</span>
                  <span className="row-meta"><bdi>{a.branch_name || t('common.allStores')}</bdi> · {t(`kpi.${a.frequency}`)}</span>
                  {askStore && (
                    <select
                      aria-label={t('common.store')}
                      value={choices.some((b) => b.id === store) ? store : choices[0].id}
                      onChange={(e) => setStore(e.target.value)}
                      style={{ marginTop: 6, minHeight: 40, maxWidth: '100%' }}
                    >
                      {choices.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  )}
                </span>
                {a.done ? (
                  <Link className="done-pill" to={`/app/reports/${a.last_submission_id}`}><CheckIcon size={14} />{t('dashboard.done')}</Link>
                ) : (
                  <button type="button" className="go-btn" onClick={() => start(a)} disabled={starting === a.id}>
                    <PlayIcon size={14} />{a.open_submission_id ? t('dashboard.continue') : t('common.start')}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div>
          <div className="section-label">{t('app.dailyReports')}</div>
          <div className="tile-grid">
            {DAILY_REPORTS.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} className="tile-btn">
                <span className="icon-tile icon-tile-sm"><Icon size={18} /></span>
                <span className="row-text"><span className="row-title">{t(label)}</span><span className="row-meta">{t('kpi.daily')}</span></span>
              </Link>
            ))}
          </div>
        </div>

        {isManager && (
          <div>
            <div className="section-label">{t('app.visitReports')}</div>
            <div className="list-card">
              {VISIT_REPORTS.map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to} className="list-row">
                  <span className="icon-tile icon-tile-sm"><Icon size={18} /></span>
                  <span className="row-text"><span className="row-title">{t(label)}</span></span>
                  <span className="row-chev"><ChevronEndIcon size={16} /></span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {seesKpi && kpi && (
          <div>
            <div className="section-label">{t('dashboard.glance')} · <bdi>{currentStore && (!kpiScope || kpiScope.includes(currentStore.id)) ? currentStore.name : t('common.allStores')}</bdi></div>
            <div className="chip-row" style={{ paddingTop: 0 }}>
              {PERIODS.map((p) => (
                <button key={p} type="button" className={`chip${period === p ? ' active' : ''}`} aria-pressed={period === p} onClick={() => setPeriod(p)}>{t(`kpi.${p}`)}</button>
              ))}
            </div>
            <div className="kpi-grid" style={{ marginBottom: 8 }}>
              <Tile icon={CheckCircleIcon} tone="green" label={t('kpi.complianceShort')} value={kpi.compliancePct !== null ? `${kpi.compliancePct}%` : t('common.none')} />
              <Tile icon={ThermometerIcon} tone="amber" label={t('kpi.tempDeviationsShort')} value={kpi.temperatureDeviations} />
              <Tile icon={TrashIcon} tone="amber" label={t('kpi.wasteValue')} value={kpi.wasteValue.toFixed(2)} />
              <Tile icon={AlertTriangleIcon} tone="red" label={t('kpi.incidentsShort')} value={kpi.incidentCount} />
            </div>
            <p className="hint" style={{ margin: '0 2px' }}>
              {t('kpi.basedOn', { n: kpi.submissionsCount })}{' '}
              <Link to="/app/kpi">{t('dashboard.fullKpi')}</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({ icon: Icon, tone, label, value }) {
  return (
    <div className="kpi-tile">
      <div className={`icon-circle icon-circle-${tone}`}><Icon size={18} /></div>
      <div>
        <div className="label">{label}</div>
        <div className="value">{value}</div>
      </div>
    </div>
  );
}

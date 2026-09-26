import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';
import { ROLES, roleName } from '../onboarding/roles.js';
import { ClipboardEmptyIcon } from '../../components/icons.jsx';
import { useT } from '../../i18n/index.jsx';
import { reportTitle } from '../../i18n/formLabels.js';

// Filter chips; names are std.* in i18n/pageLabels.js ('' = all).
const STANDARDS = ['', 'HACCP', 'ISO_22000', 'LOCAL_CODE', 'INTERNAL_QC', 'SOP', 'C_STORE', 'CUSTOM'];
const FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly'];

export default function ChecklistBuilder() {
  const t = useT();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [standard, setStandard] = useState('');
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [selected, setSelected] = useState([]);
  const [expanded, setExpanded] = useState(new Set());
  const [templates, setTemplates] = useState([]);
  const [templateName, setTemplateName] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [assignError, setAssignError] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadingItems, setLoadingItems] = useState(true);
  const [saving, setSaving] = useState(false);

  const [assignTemplateId, setAssignTemplateId] = useState('');
  const [assignBranchId, setAssignBranchId] = useState('');
  const [assignRole, setAssignRole] = useState('');
  const [branches, setBranches] = useState([]);
  const [assignments, setAssignments] = useState([]);

  // The library response is the biggest in the app (~160KB for 403
  // checkpoints), so it's the one most likely to be cut short by a flaky
  // connection. Without this catch a failed load left `items` empty and
  // the page rendered "No checkpoints match your filters" forever — no
  // error, no way back except a manual refresh.
  //
  // While a load is in flight the list shows a loading state — it used to
  // show "No checkpoints match" instead, which on a slow phone connection
  // looked like the library was empty. Each keystroke starts a new load;
  // only the latest one's answer is used, so a slow reply for an older
  // search can't overwrite the current results.
  const loadSeq = useRef(0);
  const loadItems = async () => {
    const seq = ++loadSeq.current;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (standard) params.set('standard', standard);
    if (criticalOnly) params.set('critical', 'true');
    setLoadFailed(false);
    setLoadingItems(true);
    try {
      const { items } = await api.get(`/checklists/library?${params.toString()}`);
      if (seq !== loadSeq.current) return;
      setItems(items);
      setError('');
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setItems([]);
      setLoadFailed(true);
      setError(err.message);
    } finally {
      if (seq === loadSeq.current) setLoadingItems(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const { templates } = await api.get('/checklists/templates');
      setTemplates(templates);
    } catch (err) {
      setAssignError(err.message);
    }
  };

  const loadAssignments = async () => {
    try {
      const { assignments } = await api.get('/checklists/assignments');
      setAssignments(assignments);
    } catch (err) {
      setAssignError(err.message);
    }
  };

  // Wait for a pause in typing before searching, rather than sending one
  // library request per keystroke over a mobile connection.
  useEffect(() => {
    const id = setTimeout(loadItems, q ? 300 : 0);
    return () => clearTimeout(id);
  }, [q, standard, criticalOnly]);
  useEffect(() => {
    loadTemplates();
    loadAssignments();
    api.get('/tenants/branches').then((d) => setBranches(d.branches)).catch(() => {});
  }, []);

  const toggleItem = (id) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const toggleExpanded = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllShown = () => {
    setSelected((s) => Array.from(new Set([...s, ...items.map((i) => i.id)])));
  };

  const clearSelection = () => setSelected([]);

  const createTemplate = async (e) => {
    e.preventDefault();
    setError('');
    if (!templateName || selected.length === 0) {
      setError(t('builder.needNameAndItems'));
      return;
    }
    setSaving(true);
    try {
      const { template } = await api.post('/checklists/templates', { name: templateName, frequency, itemIds: selected });
      setTemplateName('');
      setSelected([]);
      await loadTemplates();
      // Ready for step 3 straight away.
      setAssignTemplateId(template.id);
      setNotice(t('builder.savedNotice', { name: template.name }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const assign = async (e) => {
    e.preventDefault();
    if (!assignTemplateId || assigning) return;
    setAssignError('');
    setNotice('');
    setAssigning(true);
    try {
      const res = await api.post('/checklists/assignments', {
        templateId: assignTemplateId,
        branchId: assignBranchId || null,
        role: assignRole || null,
      });
      setAssignBranchId('');
      setAssignRole('');
      setNotice(res.existing
        ? t('builder.alreadyAssigned')
        : t('builder.assignedNotice'));
      await loadAssignments();
    } catch (err) {
      setAssignError(err.message);
    } finally {
      setAssigning(false);
    }
  };

  const unassign = async (id) => {
    setAssignError('');
    setNotice('');
    try {
      await api.del(`/checklists/assignments/${id}`);
      await loadAssignments();
    } catch (err) {
      setAssignError(err.message);
    }
  };

  // The pinned daily/visit reports create their own templates behind the
  // scenes; they have no checkpoints, so they aren't assignable checklists.
  const assignableTemplates = templates.filter((tpl) => !tpl.kind || tpl.kind === 'custom');

  return (
    <div>
      <h2>{t('builder.title')}</h2>
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>{t('builder.pickCheckpoints')}</h3>
        <div className="field">
          <input type="search" aria-label={t('builder.search')} placeholder={t('builder.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="filter-row">
          {STANDARDS.map((code) => (
            <button key={code} className={standard === code ? 'active' : ''} onClick={() => setStandard(code)}>
              {t(code ? `std.${code}` : 'std.all')}
            </button>
          ))}
          <button className={criticalOnly ? 'active' : ''} onClick={() => setCriticalOnly((c) => !c)}>
            {t('builder.criticalOnly')}
          </button>
        </div>

        {items.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <button type="button" className="btn btn-secondary btn-small" onClick={selectAllShown}>
              {t('builder.selectAllShown')} ({items.length})
            </button>
            {selected.length > 0 && (
              <button type="button" className="btn btn-secondary btn-small" onClick={clearSelection}>
                {t('builder.clearSelection')} ({selected.length})
              </button>
            )}
          </div>
        )}

        <div style={{ maxHeight: 380, overflowY: 'auto', opacity: loadingItems && items.length ? 0.5 : 1, transition: 'opacity 0.15s' }} aria-busy={loadingItems}>
          {items.map((item, idx) => {
            const showHeader = item.category && item.category !== items[idx - 1]?.category;
            return (
              <React.Fragment key={item.id}>
                {showHeader && (
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-soft)', marginTop: 12, marginBottom: 4 }}>
                    {item.category}
                  </div>
                )}
                {/* htmlFor is load-bearing, not decorative: a label binds to
                    the first *labelable* element in tree order, and the
                    "Show detail" <button> below qualifies — so with implicit
                    association the row's tap target became that button and
                    tapping the row no longer selected the checkpoint. */}
                <label className="checklist-row" htmlFor={`pick-${item.id}`} style={{ cursor: 'pointer' }}>
                  <div>
                    <div>{item.text}</div>
                    <div className="hint">
                      <span className="pill">{t(`std.${item.standard}`)}</span>{' '}
                      {item.requires_photo && <span className="pill pill-amber">{t('builder.photoRequired')}</span>}{' '}
                      {item.is_critical && <span className="pill pill-red">{t('run.critical')}</span>}
                      {item.description && (
                        <button
                          type="button"
                          className="link-btn"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleExpanded(item.id); }}
                          style={{ marginLeft: 8 }}
                        >
                          {expanded.has(item.id) ? t('builder.hideDetail') : t('builder.showDetail')}
                        </button>
                      )}
                    </div>
                    {item.description && expanded.has(item.id) && (
                      <p style={{ marginTop: 6, marginBottom: 0 }}>{item.description}</p>
                    )}
                  </div>
                  <input id={`pick-${item.id}`} type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleItem(item.id)} />
                </label>
              </React.Fragment>
            );
          })}
          {items.length === 0 && loadingItems && (
            <div className="empty-state" role="status">
              <ClipboardEmptyIcon size={32} />
              <span>{t('builder.loading')}</span>
            </div>
          )}
          {items.length === 0 && !loadingItems && (
            <div className="empty-state">
              <ClipboardEmptyIcon size={32} />
              <span>{loadFailed ? t('builder.loadFailed') : t('builder.noMatch')}</span>
              {loadFailed && (
                <button type="button" className="btn btn-secondary btn-small" onClick={loadItems}>
                  {t('common.tryAgain')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <form onSubmit={createTemplate} className="card">
        <h3 style={{ marginBottom: 12 }}>{t('builder.saveTitle', { n: selected.length })}</h3>
        <div className="field">
          <label htmlFor="tname">{t('builder.name')}</label>
          <input id="tname" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder={t('builder.namePlaceholder')} />
        </div>
        <div className="field">
          <label htmlFor="freq">{t('builder.frequency')}</label>
          <select id="freq" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            {FREQUENCIES.map((f) => <option key={f} value={f}>{t(`freq.${f}`)}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? t('common.saving') : t('builder.save')}</button>
      </form>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>{t('builder.assignTitle')}</h3>
        {notice && <div className="success-banner" role="status">{notice}</div>}
        {assignError && <div className="error-banner">{assignError}</div>}
        <form onSubmit={assign}>
          <div className="field">
            <label htmlFor="atpl">{t('builder.checklist')}</label>
            <select id="atpl" value={assignTemplateId} onChange={(e) => setAssignTemplateId(e.target.value)} required>
              <option value="" disabled>{t('builder.selectChecklist')}</option>
              {assignableTemplates.map((tpl) => <option key={tpl.id} value={tpl.id}>{reportTitle(t, tpl.kind, tpl.name)}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="abranch">{t('page.store')}</label>
            <select id="abranch" value={assignBranchId} onChange={(e) => setAssignBranchId(e.target.value)}>
              <option value="">{t('page.allStores')}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="arole">{t('page.role')}</label>
            <select id="arole" value={assignRole} onChange={(e) => setAssignRole(e.target.value)}>
              <option value="">{t('page.anyRole')}</option>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{roleName(t, r.value)}</option>)}
            </select>
          </div>
          <button className="btn btn-secondary" type="submit" disabled={assigning}>{assigning ? t('builder.assigning') : t('builder.assign')}</button>
        </form>

        <div className="table-scroll" style={{ marginTop: 16 }}>
        <table>
          <thead><tr><th>{t('builder.checklist')}</th><th>{t('page.store')}</th><th>{t('page.role')}</th><th aria-label={t('builder.actions')} /></tr></thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id}>
                <td>{reportTitle(t, a.kind, a.template_name)}</td>
                <td>{a.branch_name || t('page.allStores')}</td>
                <td>{a.role ? roleName(t, a.role) : t('page.anyRole')}</td>
                <td>
                  <button type="button" className="btn btn-small btn-secondary" onClick={() => unassign(a.id)} aria-label={t('builder.unassignLabel', { name: reportTitle(t, a.kind, a.template_name) })}>
                    {t('builder.unassign')}
                  </button>
                </td>
              </tr>
            ))}
            {assignments.length === 0 && (
              <tr><td colSpan={4} className="hint">{t('builder.nothingAssigned')}</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

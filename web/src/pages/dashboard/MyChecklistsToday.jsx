import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { PlayIcon, ClipboardEmptyIcon, CheckCircleIcon } from '../../components/icons.jsx';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { reportTitle } from '../../i18n/formLabels.js';

export default function MyChecklistsToday() {
  const [assignments, setAssignments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [myBranchIds, setMyBranchIds] = useState([]);
  const [chosenStore, setChosenStore] = useState({}); // assignment id -> branch id
  const [starting, setStarting] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const t = useT();
  const { user } = useAuth();
  const canBuild = ['business_owner', 'operations_manager', 'area_manager'].includes(user?.role);

  useEffect(() => {
    api.get('/checklists/my-assignments')
      .then((d) => { setAssignments(d.assignments); setMyBranchIds(d.myBranchIds || []); })
      .catch((err) => setError(err.message));
    api.get('/tenants/branches').then((d) => setBranches(d.branches)).catch(() => {});
  }, []);

  // For an "All stores" checklist: the stores this person works at, or —
  // for owners/ops managers, who aren't tied to one — every store.
  const storeChoices = (assignment) => {
    if (assignment.branch_id) return branches.filter((b) => b.id === assignment.branch_id);
    const mine = branches.filter((b) => myBranchIds.includes(b.id));
    return mine.length ? mine : branches;
  };

  const start = async (assignment) => {
    if (starting) return;
    setError('');
    // "Continue" goes straight back to the run underway. Asking the server
    // to start one at the first store in the list opened a second, empty
    // run when the first had been started at another store.
    if (assignment.open_submission_id) {
      navigate(`/app/checklists/run/${assignment.open_submission_id}`);
      return;
    }
    const choices = storeChoices(assignment);
    const branchId = assignment.branch_id || chosenStore[assignment.id] || choices[0]?.id;
    if (!branchId) { setError(t('dashboard.noStore')); return; }
    setStarting(assignment.id);
    try {
      const { submission } = await api.post('/submissions', {
        templateId: assignment.template_id,
        branchId,
        assignmentId: assignment.id,
      });
      navigate(`/app/checklists/run/${submission.id}`);
    } catch (err) {
      setError(err.message);
      setStarting(null);
    }
  };

  return (
    <div className="card">
      <h3 style={{ marginBottom: 12 }}>{t('dashboard.myChecklists')}</h3>
      {error && <div className="error-banner">{error}</div>}
      {assignments.length === 0 && (
        <div className="empty-state">
          <ClipboardEmptyIcon size={32} />
          <span>{t('dashboard.nothingAssigned')}</span>
          {/* A new business has nothing yet: point managers at the first step. */}
          {canBuild && (
            <Link className="btn btn-primary btn-small" to="/app/checklists">{t('dashboard.buildFirst')}</Link>
          )}
        </div>
      )}
      {assignments.map((a) => {
        const choices = storeChoices(a);
        const pickStore = !a.branch_id && !a.done && !a.open_submission_id && choices.length > 1;
        return (
          <div className="checklist-row" key={a.id}>
            <div style={{ minWidth: 0 }}>
              <strong>{reportTitle(t, a.kind, a.template_name)}</strong>
              <div className="hint">{a.branch_name || t('common.allStores')} · {t(`kpi.${a.frequency}`)}</div>
              {pickStore && (
                <select
                  aria-label={t('common.store')}
                  value={chosenStore[a.id] || choices[0].id}
                  onChange={(e) => setChosenStore((s) => ({ ...s, [a.id]: e.target.value }))}
                  style={{ marginTop: 6, minHeight: 40 }}
                >
                  {choices.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
            </div>
            {a.done ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <span className="pill pill-green"><CheckCircleIcon size={12} /> {t('dashboard.done')}</span>
                <Link className="btn btn-small btn-secondary" to={`/app/reports/${a.last_submission_id}`}>{t('dashboard.viewReport')}</Link>
              </div>
            ) : (
              <button className="btn btn-small btn-primary" onClick={() => start(a)} disabled={starting === a.id}>
                <PlayIcon size={14} /> {a.open_submission_id ? t('dashboard.continue') : t('common.start')}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

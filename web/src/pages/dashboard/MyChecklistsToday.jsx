import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { PlayIcon, ClipboardEmptyIcon } from '../../components/icons.jsx';
import { useT } from '../../i18n/index.jsx';

export default function MyChecklistsToday() {
  const [assignments, setAssignments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const t = useT();

  useEffect(() => {
    api.get('/checklists/my-assignments').then((d) => setAssignments(d.assignments));
    api.get('/tenants/branches').then((d) => setBranches(d.branches));
  }, []);

  const start = async (assignment) => {
    setError('');
    try {
      const branchId = assignment.branch_id || branches[0]?.id;
      if (!branchId) { setError('No store available to run this checklist against.'); return; }
      const { submission } = await api.post('/submissions', {
        templateId: assignment.template_id,
        branchId,
        assignmentId: assignment.id,
      });
      navigate(`/app/checklists/run/${submission.id}`);
    } catch (err) {
      setError(err.message);
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
        </div>
      )}
      {assignments.map((a) => (
        <div className="checklist-row" key={a.id}>
          <div>
            <strong>{a.template_name}</strong>
            <div className="hint">{a.branch_name || t('common.allStores')} · {t(`kpi.${a.frequency}`)}</div>
          </div>
          <button className="btn btn-small btn-primary" onClick={() => start(a)}><PlayIcon size={14} /> {t('common.start')}</button>
        </div>
      ))}
    </div>
  );
}

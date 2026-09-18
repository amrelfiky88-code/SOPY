import { useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';

// Shared start/save/submit lifecycle for the Kitchen Daily and Bar &
// Beverage Daily Operation Report pages — everything about them that
// ISN'T the specific fields (those diverge enough between KDR-001 and
// BDR-001 that each page owns its own field layout and form_data shape).
//
// onResume(formData) is called when the user picks up a draft they saved
// earlier today, so the page can put its fields back.
// Postgres jsonb doesn't keep object key order, so a saved report came
// back with its sections shuffled (notes before shift, "End" before
// "Start"). Record the form's own field order as a list — lists keep
// their order — so the report and its PDF read top to bottom like the form.
function withFieldOrder(formData) {
  const order = [];
  const seen = new Set();
  const walk = (value, prefix) => {
    if (Array.isArray(value)) {
      value.forEach((row) => walk(row, `${prefix}[].`));
    } else if (value && typeof value === 'object') {
      for (const key of Object.keys(value)) {
        if (key === '_fieldOrder') continue;
        const path = prefix + key;
        if (!seen.has(path)) { seen.add(path); order.push(path); }
        walk(value[key], `${path}.`);
      }
    }
  };
  walk(formData, '');
  return { ...formData, _fieldOrder: order };
}

export function useOpsReport({ kind, title, onResume }) {
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [submissionId, setSubmissionId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | started | saving | submitted
  const [error, setError] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const savedTimer = useRef(null);
  useEffect(() => () => clearTimeout(savedTimer.current), []);

  useEffect(() => {
    api.get('/tenants/branches')
      .then((d) => {
        setBranches(d.branches);
        if (d.branches.length) setBranchId(d.branches[0].id);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    setDraft(null);
    if (!branchId) return undefined;
    let cancelled = false;
    api.get(`/submissions/draft?kind=${encodeURIComponent(kind)}&branchId=${encodeURIComponent(branchId)}`)
      .then((d) => { if (!cancelled) setDraft(d.submission); })
      .catch(() => {}); // no draft lookup just means starting fresh
    return () => { cancelled = true; };
  }, [branchId, kind]);

  const ensureTemplate = async () => {
    const { templates } = await api.get('/checklists/templates');
    const existing = templates.find((t) => t.kind === kind);
    if (existing) return existing.id;
    const { template } = await api.post('/checklists/templates', { name: title, kind, frequency: 'daily', itemIds: [] });
    return template.id;
  };

  const start = async () => {
    setError('');
    if (draft) {
      setSubmissionId(draft.id);
      onResume?.(draft.form_data || {});
      setStatus('started');
      return;
    }
    try {
      const templateId = await ensureTemplate();
      const { submission } = await api.post('/submissions', { templateId, branchId });
      setSubmissionId(submission.id);
      setStatus('started');
    } catch (err) {
      setError(err.message);
    }
  };

  const save = async (formData, hasIncident) => {
    setError('');
    setStatus('saving');
    try {
      await api.patch(`/submissions/${submissionId}`, { formData: withFieldOrder(formData), hasIncident: !!hasIncident });
      setStatus('started');
      // Brief confirmation — without it a successful save looked like nothing happened.
      setJustSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setJustSaved(false), 2500);
    } catch (err) {
      setError(err.message);
      setStatus('started');
    }
  };

  const submit = async (formData, hasIncident) => {
    setError('');
    setStatus('saving');
    try {
      await api.patch(`/submissions/${submissionId}`, { formData: withFieldOrder(formData), hasIncident: !!hasIncident });
      const { lat, lng } = await new Promise((resolve) => {
        if (!navigator.geolocation) return resolve({});
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve({}),
          { timeout: 4000 }
        );
      });
      await api.post(`/submissions/${submissionId}/submit`, { gpsLat: lat, gpsLng: lng });
      setStatus('submitted');
    } catch (err) {
      setError(err.message);
      setStatus('started');
    }
  };

  return { branches, branchId, setBranchId, status, error, setError, start, save, submit, hasDraft: !!draft, justSaved, submissionId };
}

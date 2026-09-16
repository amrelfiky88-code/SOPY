import { useEffect, useState } from 'react';
import { api } from '../../api.js';

// Shared start/save/submit lifecycle for the Kitchen Daily and Bar &
// Beverage Daily Operation Report pages — everything about them that
// ISN'T the specific fields (those diverge enough between KDR-001 and
// BDR-001 that each page owns its own field layout and form_data shape).
export function useOpsReport({ kind, title }) {
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [submissionId, setSubmissionId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | started | saving | submitted
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/tenants/branches').then((d) => {
      setBranches(d.branches);
      if (d.branches.length) setBranchId(d.branches[0].id);
    });
  }, []);

  const ensureTemplate = async () => {
    const { templates } = await api.get('/checklists/templates');
    const existing = templates.find((t) => t.kind === kind);
    if (existing) return existing.id;
    const { template } = await api.post('/checklists/templates', { name: title, kind, frequency: 'daily', itemIds: [] });
    return template.id;
  };

  const start = async () => {
    setError('');
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
    setStatus('saving');
    try {
      await api.patch(`/submissions/${submissionId}`, { formData, hasIncident: !!hasIncident });
      setStatus('started');
    } catch (err) {
      setError(err.message);
      setStatus('started');
    }
  };

  const submit = async (formData, hasIncident) => {
    setError('');
    setStatus('saving');
    try {
      await api.patch(`/submissions/${submissionId}`, { formData, hasIncident: !!hasIncident });
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

  return { branches, branchId, setBranchId, status, error, setError, start, save, submit };
}

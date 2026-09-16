import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, getToken } from '../../api.js';
import CameraCapture from '../../components/CameraCapture.jsx';

export default function ChecklistRun() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [template, setTemplate] = useState(null);
  const [items, setItems] = useState([]);
  const [responses, setResponses] = useState({}); // itemId -> { isCompliant, valueText, photoBlob, savedResponseId }
  const [activeCameraItem, setActiveCameraItem] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { submission } = await api.get(`/submissions/${submissionId}`);
      setSubmission(submission);
      const { template, items } = await api.get(`/checklists/templates/${submission.template_id}`);
      setTemplate(template);
      setItems(items);
    })();
  }, [submissionId]);

  const setResponse = (itemId, patch) => {
    setResponses((r) => ({ ...r, [itemId]: { ...r[itemId], ...patch } }));
  };

  const savePhoto = async (itemId, blob) => {
    setResponse(itemId, { photoBlob: blob });
    if (!blob) return;
    const form = new FormData();
    form.append('itemId', itemId);
    form.append('photo', blob, 'evidence.jpg');
    if (responses[itemId]?.isCompliant !== undefined) form.append('isCompliant', responses[itemId].isCompliant);
    await withGps(async (lat, lng) => {
      if (lat) form.append('gpsLat', lat);
      if (lng) form.append('gpsLng', lng);
      await fetch(`/api/submissions/${submissionId}/responses`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
    });
    setActiveCameraItem(null);
  };

  const saveTextResponse = async (item) => {
    const r = responses[item.id] || {};
    const form = new FormData();
    form.append('itemId', item.id);
    if (r.isCompliant !== undefined) form.append('isCompliant', r.isCompliant);
    if (r.valueText !== undefined) form.append('valueText', r.valueText);
    await fetch(`/api/submissions/${submissionId}/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
    });
  };

  const withGps = (fn) =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return fn().then(resolve);
      navigator.geolocation.getCurrentPosition(
        (pos) => fn(pos.coords.latitude, pos.coords.longitude).then(resolve),
        () => fn().then(resolve),
        { timeout: 4000 }
      );
    });

  const allAnswered = items.every((item) => {
    const r = responses[item.id];
    if (!r || r.isCompliant === undefined) return false;
    if (item.requires_photo && !r.photoBlob) return false;
    return true;
  });

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      await withGps(async (lat, lng) => {
        await api.post(`/submissions/${submissionId}/submit`, { gpsLat: lat, gpsLng: lng });
      });
      navigate('/app/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!template) return <p>Loading checklist…</p>;

  return (
    <div>
      <h2>{template.name}</h2>
      {error && <div className="error-banner">{error}</div>}

      {items.map((item) => {
        const r = responses[item.id] || {};
        return (
          <div className="card" key={item.id}>
            <p style={{ margin: '0 0 10px', color: 'var(--ink)' }}>{item.text}</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button
                type="button"
                className={`btn btn-small ${r.isCompliant === true ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setResponse(item.id, { isCompliant: true }); }}
              >
                Compliant
              </button>
              <button
                type="button"
                className={`btn btn-small ${r.isCompliant === false ? 'btn-danger' : 'btn-secondary'}`}
                style={r.isCompliant === false ? { background: 'var(--red)', color: 'white' } : undefined}
                onClick={() => { setResponse(item.id, { isCompliant: false }); }}
              >
                Not compliant
              </button>
            </div>

            {item.category === 'temperature' && (
              <div className="field" style={{ maxWidth: 160 }}>
                <label>Reading (°C)</label>
                <input
                  type="number"
                  value={r.valueText || ''}
                  onChange={(e) => setResponse(item.id, { valueText: e.target.value })}
                  onBlur={() => saveTextResponse(item)}
                />
              </div>
            )}

            {item.requires_photo && (
              <div style={{ marginTop: 10 }}>
                {activeCameraItem === item.id ? (
                  <CameraCapture onCapture={(blob) => savePhoto(item.id, blob)} captured={!!r.photoBlob} />
                ) : r.photoBlob ? (
                  <span className="pill pill-green">Photo captured</span>
                ) : (
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => setActiveCameraItem(item.id)}>
                    Open camera to capture evidence
                  </button>
                )}
              </div>
            )}

            {!item.requires_photo && r.isCompliant !== undefined && (
              <button type="button" className="btn btn-secondary btn-small" style={{ marginTop: 4 }} onClick={() => saveTextResponse(item)}>
                Save
              </button>
            )}
          </div>
        );
      })}

      <button className="btn btn-primary" onClick={handleSubmit} disabled={!allAnswered || submitting}>
        {submitting ? 'Submitting…' : 'Submit & sign off'}
      </button>
      {!allAnswered && <p className="hint">Answer every checkpoint (and capture required photos) to submit.</p>}
    </div>
  );
}

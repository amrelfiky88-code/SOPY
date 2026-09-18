import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, getToken } from '../../api.js';
import CameraCapture from '../../components/CameraCapture.jsx';
import { CameraIcon } from '../../components/icons.jsx';
import { useT } from '../../i18n/index.jsx';

const isObservationItem = (item) => item.category?.includes('Consumer Behavior');
const isTemperatureItem = (item) => item.category?.toLowerCase().includes('temperature');

export default function ChecklistRun() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const t = useT();
  const [submission, setSubmission] = useState(null);
  const [template, setTemplate] = useState(null);
  const [items, setItems] = useState([]);
  // itemId -> { isCompliant, valueText, hasPhoto }
  const [responses, setResponses] = useState({});
  const [activeCameraItem, setActiveCameraItem] = useState(null);
  const [uploadingItem, setUploadingItem] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scorecard, setScorecard] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { submission, responses: saved } = await api.get(`/submissions/${submissionId}`);
        setSubmission(submission);
        // Already signed off: show the result, not an editable form.
        if (submission.status === 'submitted') {
          setScorecard(await api.get(`/submissions/${submissionId}/scorecard`));
        }
        // Put back anything answered before a reload or a dropped connection.
        const restored = {};
        for (const r of saved || []) {
          restored[r.item_id] = {
            ...(r.is_compliant === null ? {} : { isCompliant: r.is_compliant }),
            ...(r.value_text === null ? {} : { valueText: r.value_text }),
            hasPhoto: !!r.photo_path,
          };
        }
        setResponses(restored);
        const { template, items } = await api.get(`/checklists/templates/${submission.template_id}`);
        setTemplate(template);
        setItems(items);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [submissionId]);

  const setResponse = (itemId, patch) => {
    setResponses((r) => ({ ...r, [itemId]: { ...r[itemId], ...patch } }));
  };

  // Each save sends only its own fields; the server merges them into the
  // checkpoint's single response. Throws on failure so callers can tell
  // the user instead of showing the checkpoint as done.
  const postResponse = async (fields) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && value !== null) form.append(key, value);
    }
    const res = await fetch(`/api/submissions/${submissionId}/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || t('run.saveFailed'));
    }
  };

  const savePhoto = async (itemId, blob) => {
    if (!blob) return;
    setError('');
    setUploadingItem(itemId);
    try {
      await withGps((lat, lng) => postResponse({ itemId, photo: blob, gpsLat: lat, gpsLng: lng }));
      setResponse(itemId, { hasPhoto: true });
      setActiveCameraItem(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingItem(null);
    }
  };

  const saveAnswer = async (itemId, isCompliant) => {
    const previous = responses[itemId]?.isCompliant;
    setResponse(itemId, { isCompliant });
    setError('');
    try {
      await postResponse({ itemId, isCompliant: String(isCompliant) });
    } catch (err) {
      setResponse(itemId, { isCompliant: previous });
      setError(err.message);
    }
  };

  const saveTextResponse = async (item) => {
    const r = responses[item.id] || {};
    if (r.valueText === undefined) return;
    setError('');
    try {
      await postResponse({ itemId: item.id, valueText: r.valueText });
    } catch (err) {
      setError(err.message);
    }
  };

  // Location is best-effort. Chained with .then so a failure inside fn
  // reaches the caller — before, a failed upload left the promise pending forever.
  const withGps = (fn) =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({});
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({}),
        { timeout: 4000 }
      );
    }).then(({ lat, lng }) => fn(lat, lng));

  // Photo evidence is mandatory for every checkpoint, not just the ones
  // the library flags requires_photo — a checkpoint isn't "answered"
  // until a photo has been captured for it.
  const allAnswered = items.every((item) => {
    const r = responses[item.id];
    if (!r?.hasPhoto) return false;
    if (isObservationItem(item)) return !!r?.valueText?.trim();
    if (r.isCompliant === undefined) return false;
    return true;
  });

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      await withGps(async (lat, lng) => {
        await api.post(`/submissions/${submissionId}/submit`, { gpsLat: lat, gpsLng: lng });
      });
      const card = await api.get(`/submissions/${submissionId}/scorecard`);
      setScorecard(card);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!template) return error ? <div className="error-banner">{error}</div> : <p>{t('run.loadingChecklist')}</p>;

  if (scorecard) {
    return <Scorecard scorecard={scorecard} onDone={() => navigate('/app/dashboard')} />;
  }

  const renderPhotoControl = (item, r) => (
    <div style={{ marginTop: 10 }}>
      {uploadingItem === item.id ? (
        <span className="hint">{t('run.uploadingPhoto')}</span>
      ) : activeCameraItem === item.id ? (
        <>
          <CameraCapture onCapture={(blob) => savePhoto(item.id, blob)} />
          <button type="button" className="btn btn-secondary btn-small" style={{ marginTop: 8 }} onClick={() => setActiveCameraItem(null)}>
            {t('run.closeCamera')}
          </button>
        </>
      ) : r.hasPhoto ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="pill pill-green">{t('run.photoCaptured')}</span>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => setActiveCameraItem(item.id)}>
            <CameraIcon size={14} /> {t('run.retakePhoto')}
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-secondary btn-small" onClick={() => setActiveCameraItem(item.id)}>
          <CameraIcon size={14} /> {t('run.openCamera')}
        </button>
      )}
    </div>
  );

  return (
    <div className="has-sticky-actions">
      <h2>{template.name}</h2>
      {error && <div className="error-banner">{error}</div>}

      {items.map((item) => {
        const r = responses[item.id] || {};
        const observation = isObservationItem(item);

        return (
          <div className="card" key={item.id}>
            <p style={{ margin: '0 0 10px', color: 'var(--ink)' }}>
              {item.text}{' '}
              {item.is_critical && <span className="pill pill-red">{t('run.critical')}</span>}
            </p>
            {item.description && <p className="hint" style={{ marginTop: -6 }}>{item.description}</p>}

            {observation ? (
              <div className="field">
                <textarea
                  rows={2}
                  placeholder={t('run.finding')}
                  value={r.valueText || ''}
                  onChange={(e) => setResponse(item.id, { valueText: e.target.value })}
                  onBlur={() => saveTextResponse(item)}
                />
                {renderPhotoControl(item, r)}
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <button
                    type="button"
                    className={`btn btn-small ${r.isCompliant === true ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => saveAnswer(item.id, true)}
                  >
                    {t('run.compliant')}
                  </button>
                  <button
                    type="button"
                    className={`btn btn-small ${r.isCompliant === false ? 'btn-danger' : 'btn-secondary'}`}
                    style={r.isCompliant === false ? { background: 'var(--red)', color: 'white' } : undefined}
                    onClick={() => saveAnswer(item.id, false)}
                  >
                    {t('run.notCompliant')}
                  </button>
                </div>

                {item.is_critical && r.isCompliant === false && (
                  <div className="error-banner" style={{ marginBottom: 10 }}>
                    {t('run.criticalWarning')}
                  </div>
                )}

                {isTemperatureItem(item) && (
                  <div className="field" style={{ maxWidth: 160 }}>
                    <label>{t('run.reading')}</label>
                    <input
                      type="number"
                      value={r.valueText || ''}
                      onChange={(e) => setResponse(item.id, { valueText: e.target.value })}
                      onBlur={() => saveTextResponse(item)}
                    />
                  </div>
                )}

                {renderPhotoControl(item, r)}
              </>
            )}
          </div>
        );
      })}

      <div className="sticky-action-bar">
        <button className="btn btn-primary" onClick={handleSubmit} disabled={!allAnswered || submitting}>
          {submitting ? t('common.submitting') : t('common.submitSignOff')}
        </button>
        {!allAnswered && <p className="hint" style={{ marginTop: 6, marginBottom: 0 }}>{t('run.answerAll')}</p>}
      </div>
    </div>
  );
}

const RAG_LABEL = { green: 'Green — on standard', amber: 'Amber — action plan required', red: 'Red — escalate now' };
const RAG_PILL_CLASS = { green: 'pill-green', amber: 'pill-amber', red: 'pill-red' };

function Scorecard({ scorecard, onDone }) {
  return (
    <div>
      <h2>Score summary</h2>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>
              {scorecard.percentage !== null ? `${scorecard.percentage}%` : '—'}
            </div>
            <div className="hint">{scorecard.totalCompliant} / {scorecard.totalScored} checkpoints compliant</div>
          </div>
          <span className={`pill ${RAG_PILL_CLASS[scorecard.ragStatus]}`} style={{ fontSize: 14, padding: '6px 14px' }}>
            {RAG_LABEL[scorecard.ragStatus]}
          </span>
        </div>
        {scorecard.criticalFails > 0 && (
          <div className="error-banner">
            {scorecard.criticalFails} critical checkpoint{scorecard.criticalFails === 1 ? '' : 's'} failed — this
            run is flagged as an incident.
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>By section</h3>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Section</th><th>Score</th><th>Critical fails</th></tr></thead>
            <tbody>
              {scorecard.sections.map((s) => (
                <tr key={s.category}>
                  <td>{s.category}</td>
                  <td>{s.compliant} / {s.total} ({s.percentage}%)</td>
                  <td>{s.criticalFails || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button className="btn btn-primary" onClick={onDone}>Back to dashboard</button>
    </div>
  );
}

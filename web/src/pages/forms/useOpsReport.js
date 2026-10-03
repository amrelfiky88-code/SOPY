import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';
import { bestEffortPosition } from '../../lib/location.js';
import { useReconnect } from '../../lib/useReconnect.js';
import { FORM_LABELS } from '../../i18n/formLabels.js';

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

export function useOpsReport({ kind, onResume }) {
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [submissionId, setSubmissionId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | started | saving | submitted
  const [error, setError] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const savedTimer = useRef(null);
  useEffect(() => () => clearTimeout(savedTimer.current), []);

  // Autosave: a long report used to live only in the page until someone
  // tapped "Save progress", so a locked phone, a reload or iOS closing the
  // app in the background threw the whole thing away. Changes now save a
  // couple of seconds after the last edit, and at once when the app is
  // hidden. Saves go out one at a time so an older one can't land last.
  const saveChain = useRef(Promise.resolve());
  const autosaveTimer = useRef(null);
  const pendingAutosave = useRef(null); // () => Promise, while one is waiting
  const [autosaved, setAutosaved] = useState(false);

  const queueSave = (formData, hasIncident) => {
    const run = saveChain.current.then(() => api.patch(`/submissions/${submissionId}`, { formData: withFieldOrder(formData), hasIncident: !!hasIncident }));
    saveChain.current = run.catch(() => {});
    return run;
  };
  // Changes that couldn't be saved (no signal) are kept on the phone too,
  // so closing the app offline doesn't lose them: the report picks them up
  // the next time it's opened. Removed once a save gets through.
  const backupKey = (id) => `sopy_unsaved_${id}`;
  const keepBackup = (id, formData) => { try { localStorage.setItem(backupKey(id), JSON.stringify({ formData, at: Date.now() })); } catch { /* storage full or blocked */ } };
  const dropBackup = (id) => { try { localStorage.removeItem(backupKey(id)); } catch { /* blocked */ } };
  const readBackup = (id) => { try { return JSON.parse(localStorage.getItem(backupKey(id)) || 'null'); } catch { return null; } };

  // An autosave that failed used to be dropped without a word ("Changes save
  // automatically" stayed on screen) and wasn't tried again until the next
  // edit. Now the page says so, and it's retried when the signal returns
  // and every 20 seconds meanwhile.
  const [autosaveFailed, setAutosaveFailed] = useState(false);
  const failedSave = useRef(null); // { formData, hasIncident } that didn't get through
  const saveWorked = () => { failedSave.current = null; setAutosaveFailed(false); dropBackup(submissionId); };
  const saveFailed = (formData, hasIncident) => { failedSave.current = { formData, hasIncident }; setAutosaveFailed(true); keepBackup(submissionId, formData); };
  const retryFailed = () => {
    const failed = failedSave.current;
    if (!failed || pendingAutosave.current) return;
    queueSave(failed.formData, failed.hasIncident)
      .then(() => { if (failedSave.current === failed) { saveWorked(); setAutosaved(true); } })
      .catch(() => {});
  };
  useReconnect(retryFailed);
  useEffect(() => {
    if (!autosaveFailed) return undefined;
    const timer = setInterval(retryFailed, 20_000);
    return () => clearInterval(timer);
  }, [autosaveFailed]); // eslint-disable-line react-hooks/exhaustive-deps

  const flushAutosave = () => {
    clearTimeout(autosaveTimer.current);
    const pending = pendingAutosave.current;
    pendingAutosave.current = null;
    return pending ? pending() : saveChain.current;
  };
  const autosave = useCallback((formData, hasIncident) => {
    if (!submissionId || status !== 'started') return;
    clearTimeout(autosaveTimer.current);
    setAutosaved(false);
    pendingAutosave.current = () => queueSave(formData, hasIncident)
      .then(() => { saveWorked(); if (!pendingAutosave.current) setAutosaved(true); })
      .catch(() => saveFailed(formData, hasIncident));
    autosaveTimer.current = setTimeout(flushAutosave, 2000);
  }, [submissionId, status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flushAutosave(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushAutosave);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flushAutosave);
      flushAutosave();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Stores, fetched again when the signal returns if they failed (the page
  // otherwise said "add a store first" to someone who was just offline).
  const [branchesFailed, setBranchesFailed] = useState(false);
  const loadBranches = () => {
    setBranchesFailed(false);
    api.get('/tenants/branches')
      .then((d) => {
        // The person's own stores first, and one of those picked by default —
        // it used to default to the business's first store, so staff at
        // another branch filed reports against the wrong one.
        const sorted = [...d.branches].sort((a, b) => Number(!!b.works_here) - Number(!!a.works_here));
        setBranches(sorted);
        setError('');
        if (sorted.length) setBranchId((current) => current || sorted[0].id);
      })
      .catch((err) => { setBranchesFailed(true); setError(err.message); });
  };
  useEffect(loadBranches, []); // eslint-disable-line react-hooks/exhaustive-deps
  useReconnect(() => { if (branchesFailed) loadBranches(); });

  useEffect(() => {
    setDraft(null);
    if (!branchId) return undefined;
    let cancelled = false;
    api.get(`/submissions/draft?kind=${encodeURIComponent(kind)}&branchId=${encodeURIComponent(branchId)}`)
      .then((d) => { if (!cancelled) setDraft(d.submission); })
      .catch(() => {}); // no draft lookup just means starting fresh
    return () => { cancelled = true; };
  }, [branchId, kind]);

  // The template row keeps the English name; every screen shows the
  // report's title in the viewer's language by its kind instead.
  const templateName = FORM_LABELS.en[`f.${kind}.title`];

  const ensureTemplate = async () => {
    const { templates } = await api.get('/checklists/templates');
    const existing = templates.find((t) => t.kind === kind);
    if (existing) return existing.id;
    const { template } = await api.post('/checklists/templates', { name: templateName, kind, frequency: 'daily', itemIds: [] });
    return template.id;
  };

  // A second tap while the first is still starting is ignored: two taps
  // used to open two drafts, and the page kept only the last.
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const start = async () => {
    if (startingRef.current) return;
    setError('');
    startingRef.current = true;
    setStarting(true);
    // Ask again for today's draft if the lookup didn't get an answer
    // (flaky signal): Start used to open a new, empty report then, and the
    // draft with the morning's readings disappeared behind it.
    let existing = draft;
    if (!existing) {
      try {
        existing = (await api.get(`/submissions/draft?kind=${encodeURIComponent(kind)}&branchId=${encodeURIComponent(branchId)}`)).submission;
      } catch { /* creating one below reports the problem */ }
    }
    if (existing) {
      setSubmissionId(existing.id);
      // Changes kept on this phone because they couldn't be saved are newer
      // than the server's copy (a save that gets through removes them).
      const backup = readBackup(existing.id);
      onResume?.(backup?.formData || existing.form_data || {});
      setStatus('started');
      startingRef.current = false;
      setStarting(false);
      return;
    }
    try {
      const templateId = await ensureTemplate();
      const { submission } = await api.post('/submissions', { templateId, branchId });
      setSubmissionId(submission.id);
      setStatus('started');
    } catch (err) {
      setError(err.message);
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  const save = async (formData, hasIncident) => {
    setError('');
    setStatus('saving');
    try {
      clearTimeout(autosaveTimer.current);
      pendingAutosave.current = null;
      await queueSave(formData, hasIncident);
      saveWorked();
      setStatus('started');
      // Brief confirmation — without it a successful save looked like nothing happened.
      setJustSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setJustSaved(false), 2500);
    } catch (err) {
      saveFailed(formData, hasIncident);
      setError(err.message);
      setStatus('started');
    }
  };

  const submit = async (formData, hasIncident) => {
    setError('');
    setStatus('saving');
    try {
      clearTimeout(autosaveTimer.current);
      pendingAutosave.current = null;
      try {
        await queueSave(formData, hasIncident);
        saveWorked();
      } catch (err) {
        saveFailed(formData, hasIncident); // kept on the phone until it can be saved
        throw err;
      }
      const { lat, lng } = await bestEffortPosition();
      await api.post(`/submissions/${submissionId}/submit`, { gpsLat: lat, gpsLng: lng });
      setStatus('submitted');
    } catch (err) {
      setError(err.message);
      setStatus('started');
    }
  };

  return { branches, branchesFailed, branchId, setBranchId, status, error, setError, start, starting, save, submit, hasDraft: !!draft, justSaved, submissionId, autosave, autosaved, autosaveFailed };
}

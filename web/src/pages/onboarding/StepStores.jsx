import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';

export default function StepStores({ onNext, onBack }) {
  const { tenant } = useAuth();
  const [branches, setBranches] = useState([]);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const { branches } = await api.get('/tenants/branches');
    setBranches(branches);
  };
  useEffect(() => { load(); }, []);

  const addBranch = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/tenants/branches', { name, city });
      setName('');
      setCity('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const removeBranch = async (id) => {
    setError('');
    try {
      await api.del(`/tenants/branches/${id}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h2>Set up your stores</h2>
      <p>You planned for {tenant?.branch_count} branch{tenant?.branch_count === 1 ? '' : 'es'}. Add them below.</p>

      {error && <div className="error-banner">{error}</div>}

      {branches.map((b) => (
        <div className="checklist-row" key={b.id}>
          <div><strong>{b.name}</strong>{b.city ? ` — ${b.city}` : ''}</div>
          <button className="btn btn-small btn-danger" onClick={() => removeBranch(b.id)}>Remove</button>
        </div>
      ))}

      <form onSubmit={addBranch} style={{ marginTop: 16 }}>
        <div className="field">
          <label htmlFor="branchName">Branch name</label>
          <input id="branchName" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Downtown" />
        </div>
        <div className="field">
          <label htmlFor="branchCity">City</label>
          <input id="branchCity" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <button className="btn btn-secondary" type="submit" disabled={submitting}>Add branch</button>
      </form>

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
        <button className="btn btn-primary" onClick={onNext} disabled={branches.length === 0}>
          Continue
        </button>
      </div>
      {branches.length === 0 && <p className="hint">Add at least one branch to continue.</p>}
    </div>
  );
}

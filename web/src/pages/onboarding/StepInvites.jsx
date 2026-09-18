import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ROLES } from './roles.js';
import InviteLink from '../../components/InviteLink.jsx';

export default function StepInvites({ onNext, onBack }) {
  const { tenant } = useAuth();
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ fullName: '', email: '', role: 'employee', branchIds: [] });
  const [lastInviteLink, setLastInviteLink] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const [u, b] = await Promise.all([api.get('/tenants/users'), api.get('/tenants/branches')]);
    setUsers(u.users);
    setBranches(b.branches);
  };
  useEffect(() => { load(); }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const toggleBranch = (id) => {
    setForm((f) => ({
      ...f,
      branchIds: f.branchIds.includes(id) ? f.branchIds.filter((b) => b !== id) : [...f.branchIds, id],
    }));
  };

  const invite = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await api.post('/tenants/users/invite', form);
      setLastInviteLink({ path: res.inviteLink, email: form.email });
      setForm({ fullName: '', email: '', role: 'employee', branchIds: [] });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2>Invite your team</h2>
      <p>You planned for {tenant?.user_count} user{tenant?.user_count === 1 ? '' : 's'} (you're already one of them).</p>

      {error && <div className="error-banner">{error}</div>}
      {lastInviteLink && <InviteLink path={lastInviteLink.path} email={lastInviteLink.email} />}

      {users.map((u) => (
        <div className="checklist-row" key={u.id}>
          <div>
            <strong>{u.full_name}</strong> — {u.email}
            <div className="hint">{ROLES.find((r) => r.value === u.role)?.label} · {u.status}</div>
          </div>
        </div>
      ))}

      <form onSubmit={invite} style={{ marginTop: 16 }}>
        <div className="field">
          <label htmlFor="fullName">Full name</label>
          <input id="fullName" required value={form.fullName} onChange={set('fullName')} />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="off" autoCapitalize="none" spellCheck={false} required value={form.email} onChange={set('email')} />
        </div>
        <div className="field">
          <label htmlFor="role">Role</label>
          <select id="role" value={form.role} onChange={set('role')}>
            {ROLES.filter((r) => r.value !== 'business_owner').map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Assign to branches</label>
          {branches.length === 0 && <p className="hint">Add a branch first to assign one.</p>}
          {branches.map((b) => (
            <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400, marginBottom: 6 }}>
              <input type="checkbox" checked={form.branchIds.includes(b.id)} onChange={() => toggleBranch(b.id)} />
              {b.name}
            </label>
          ))}
        </div>
        <button className="btn btn-secondary" type="submit" disabled={submitting}>Send invite</button>
      </form>

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
        <button className="btn btn-primary" onClick={onNext}>Continue</button>
      </div>
    </div>
  );
}

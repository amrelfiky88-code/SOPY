import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { ACCESS_LEVELS, ROLES } from '../onboarding/roles.js';

export default function Team() {
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);
  const [branchForm, setBranchForm] = useState({ name: '', city: '' });
  const [inviteForm, setInviteForm] = useState({ fullName: '', email: '', role: 'employee' });
  const [error, setError] = useState('');
  const [tab, setTab] = useState('stores');

  const load = async () => {
    const [b, u] = await Promise.all([api.get('/tenants/branches'), api.get('/tenants/users')]);
    setBranches(b.branches);
    setUsers(u.users);
  };
  useEffect(() => { load(); }, []);

  const addBranch = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/tenants/branches', branchForm);
      setBranchForm({ name: '', city: '' });
      await load();
    } catch (err) { setError(err.message); }
  };

  const removeBranch = async (id) => {
    await api.del(`/tenants/branches/${id}`);
    await load();
  };

  const invite = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/tenants/users/invite', { ...inviteForm, branchIds: [] });
      setInviteForm({ fullName: '', email: '', role: 'employee' });
      await load();
    } catch (err) { setError(err.message); }
  };

  const updateUser = async (id, patch) => {
    setUsers((u) => u.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    await api.patch(`/tenants/users/${id}`, patch);
  };

  return (
    <div>
      <h2>Team &amp; stores</h2>
      {error && <div className="error-banner">{error}</div>}

      <div className="filter-row">
        <button className={tab === 'stores' ? 'active' : ''} onClick={() => setTab('stores')}>Stores ({branches.length})</button>
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Users ({users.length})</button>
      </div>

      {tab === 'stores' && (
        <div>
          <div className="card">
            {branches.map((b) => (
              <div className="checklist-row" key={b.id}>
                <div><strong>{b.name}</strong>{b.city ? ` — ${b.city}` : ''}</div>
                <button className="btn btn-small btn-danger" onClick={() => removeBranch(b.id)}>Remove</button>
              </div>
            ))}
            {branches.length === 0 && <div className="empty-state">No stores yet.</div>}
          </div>
          <form onSubmit={addBranch} className="card">
            <div className="field">
              <label htmlFor="bname">Branch name</label>
              <input id="bname" required value={branchForm.name} onChange={(e) => setBranchForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="bcity">City</label>
              <input id="bcity" value={branchForm.city} onChange={(e) => setBranchForm((f) => ({ ...f, city: e.target.value }))} />
            </div>
            <button className="btn btn-secondary" type="submit">Add branch</button>
          </form>
        </div>
      )}

      {tab === 'users' && (
        <div>
          <div className="card">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Access</th><th>Status</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.full_name}</td>
                    <td>{u.email}</td>
                    <td>
                      <select value={u.role} onChange={(e) => updateUser(u.id, { role: e.target.value })}>
                        {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <select value={u.access_level} onChange={(e) => updateUser(u.id, { accessLevel: e.target.value })}>
                        {ACCESS_LEVELS.map((a) => <option key={a.value} value={a.value}>{a.label.split(' —')[0]}</option>)}
                      </select>
                    </td>
                    <td><span className="pill">{u.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form onSubmit={invite} className="card">
            <div className="field">
              <label htmlFor="ifn">Full name</label>
              <input id="ifn" required value={inviteForm.fullName} onChange={(e) => setInviteForm((f) => ({ ...f, fullName: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="iem">Email</label>
              <input id="iem" type="email" required value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="irole">Role</label>
              <select id="irole" value={inviteForm.role} onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}>
                {ROLES.filter((r) => r.value !== 'business_owner').map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <button className="btn btn-secondary" type="submit">Invite user</button>
          </form>
        </div>
      )}
    </div>
  );
}

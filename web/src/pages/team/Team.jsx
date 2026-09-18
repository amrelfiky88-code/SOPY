import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ACCESS_LEVELS, ROLES } from '../onboarding/roles.js';
import { canAssignRole, canManageUser } from '../../../../shared/roles.js';
import { StorefrontIcon } from '../../components/icons.jsx';
import InviteLink from '../../components/InviteLink.jsx';

const roleLabel = (role) => ROLES.find((r) => r.value === role)?.label || role;

export default function Team() {
  const { user: me } = useAuth();
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);
  const [branchForm, setBranchForm] = useState({ name: '', city: '' });
  const [inviteForm, setInviteForm] = useState({ fullName: '', email: '', role: 'employee' });
  const [lastInvite, setLastInvite] = useState(null);
  const [confirmingRemove, setConfirmingRemove] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('stores');

  // Only offer roles the server will accept from this user.
  const assignableRoles = ROLES.filter((r) => canAssignRole(me?.role, r.value));

  const load = async () => {
    try {
      const [b, u] = await Promise.all([api.get('/tenants/branches'), api.get('/tenants/users')]);
      setBranches(b.branches);
      setUsers(u.users);
    } catch (err) {
      setError(err.message);
    }
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
    setError('');
    try {
      await api.del(`/tenants/branches/${id}`);
      setConfirmingRemove(null);
      await load();
    } catch (err) { setError(err.message); }
  };

  const invite = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/tenants/users/invite', { ...inviteForm, branchIds: [] });
      setLastInvite({ path: res.inviteLink, email: inviteForm.email });
      setInviteForm({ fullName: '', email: '', role: assignableRoles.at(-1)?.value || 'employee' });
      await load();
    } catch (err) { setError(err.message); }
  };

  // Optimistic, but rolled back if the server refuses — previously a
  // refused change stayed on screen as if it had saved.
  const updateUser = async (id, patch) => {
    setError('');
    const previous = users;
    setUsers((u) => u.map((x) => (x.id === id ? { ...x, ...(patch.accessLevel ? { access_level: patch.accessLevel } : patch) } : x)));
    try {
      await api.patch(`/tenants/users/${id}`, patch);
    } catch (err) {
      setUsers(previous);
      setError(err.message);
    }
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
                {confirmingRemove === b.id ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button className="btn btn-small btn-danger" onClick={() => removeBranch(b.id)}>Remove store</button>
                    <button className="btn btn-small btn-secondary" onClick={() => setConfirmingRemove(null)}>Keep</button>
                  </div>
                ) : (
                  <button className="btn btn-small btn-danger" onClick={() => setConfirmingRemove(b.id)}>Remove</button>
                )}
              </div>
            ))}
            {branches.length === 0 && (
              <div className="empty-state">
                <StorefrontIcon size={32} />
                <span>No stores yet.</span>
              </div>
            )}
            {confirmingRemove && (
              <p className="hint">Past checklists and reports for this store are kept; it just stops appearing in store lists.</p>
            )}
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
          {lastInvite && <InviteLink path={lastInvite.path} email={lastInvite.email} />}

          <div className="card">
            <div className="table-scroll">
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Access</th><th>Status</th></tr></thead>
                <tbody>
                  {users.map((u) => {
                    const isMe = u.id === me?.id;
                    const editable = !isMe && canManageUser(me?.role, u.role);
                    return (
                      <tr key={u.id}>
                        <td>{u.full_name}{isMe ? ' (you)' : ''}</td>
                        <td>{u.email}</td>
                        <td>
                          {editable ? (
                            <select value={u.role} onChange={(e) => updateUser(u.id, { role: e.target.value })} aria-label={`Role for ${u.full_name}`}>
                              {assignableRoles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                          ) : roleLabel(u.role)}
                        </td>
                        <td>
                          {editable ? (
                            <select value={u.access_level} onChange={(e) => updateUser(u.id, { accessLevel: e.target.value })} aria-label={`Access for ${u.full_name}`}>
                              {ACCESS_LEVELS.map((a) => <option key={a.value} value={a.value}>{a.label.split(' —')[0]}</option>)}
                            </select>
                          ) : ACCESS_LEVELS.find((a) => a.value === u.access_level)?.label.split(' —')[0]}
                        </td>
                        <td><span className="pill">{u.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {assignableRoles.length > 0 && (
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
                  {assignableRoles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <button className="btn btn-secondary" type="submit">Invite user</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

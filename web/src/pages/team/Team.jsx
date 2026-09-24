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
  const [inviteForm, setInviteForm] = useState({ fullName: '', email: '', role: 'employee', branchIds: [] });
  const [lastInvite, setLastInvite] = useState(null);
  const [confirmingRemove, setConfirmingRemove] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('stores');
  // One request at a time per form: a double tap on a slow connection
  // used to add the store (or send the invite) twice.
  const [busy, setBusy] = useState('');
  // Inline "which stores does this person work at" editor.
  const [editingStores, setEditingStores] = useState(null); // user id
  const [storeDraft, setStoreDraft] = useState([]);

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
    if (busy) return;
    setError('');
    setBusy('branch');
    try {
      await api.post('/tenants/branches', branchForm);
      setBranchForm({ name: '', city: '' });
      await load();
    } catch (err) { setError(err.message); } finally { setBusy(''); }
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
    if (busy) return;
    setError('');
    setBusy('invite');
    try {
      // The store choice used to be dropped (always []), so people invited
      // here belonged to no store and never received store checklists.
      const res = await api.post('/tenants/users/invite', inviteForm);
      setLastInvite({ path: res.inviteLink, email: inviteForm.email });
      setInviteForm({ fullName: '', email: '', role: assignableRoles.at(-1)?.value || 'employee', branchIds: [] });
      await load();
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  };

  const toggle = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const storeNames = (ids = []) => branches.filter((b) => ids.includes(b.id)).map((b) => b.name).join(', ');

  const resetPassword = async (u) => {
    setError('');
    setBusy(`reset:${u.id}`);
    try {
      const res = await api.post(`/tenants/users/${u.id}/reset-link`, {});
      setLastInvite({ path: res.resetLink, email: u.email, kind: 'reset' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  };

  const saveStores = async (userId) => {
    setError('');
    setBusy(`stores:${userId}`);
    try {
      await api.patch(`/tenants/users/${userId}`, { branchIds: storeDraft });
      setUsers((list) => list.map((u) => (u.id === userId ? { ...u, branch_ids: storeDraft } : u)));
      setEditingStores(null);
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  };

  // Optimistic, but rolled back if the server refuses — previously a
  // refused change stayed on screen as if it had saved.
  const updateUser = async (id, patch) => {
    setError('');
    const previous = users;
    setUsers((u) => u.map((x) => (x.id === id ? { ...x, ...(patch.accessLevel ? { access_level: patch.accessLevel } : patch) } : x)));
    try {
      const { user } = await api.patch(`/tenants/users/${id}`, patch);
      // Take the server's version: re-enabling someone who never accepted
      // their invite comes back as 'invited', not 'active'.
      if (user) setUsers((u) => u.map((x) => (x.id === id ? { ...x, ...user } : x)));
    } catch (err) {
      setUsers(previous);
      setError(err.message);
    }
  };

  const [confirmingDisable, setConfirmingDisable] = useState(null);

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
            <button className="btn btn-secondary" type="submit" disabled={busy === 'branch'}>
              {busy === 'branch' ? 'Adding…' : 'Add branch'}
            </button>
          </form>
        </div>
      )}

      {tab === 'users' && (
        <div>
          {lastInvite && <InviteLink path={lastInvite.path} email={lastInvite.email} kind={lastInvite.kind} />}

          <div className="card">
            <div className="table-scroll">
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Stores</th><th>Access</th><th>Status</th></tr></thead>
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
                        <td style={{ minWidth: 150 }}>
                          {editingStores === u.id ? (
                            <div>
                              {branches.map((b) => (
                                <label key={b.id} className="inline-check" htmlFor={`st-${u.id}-${b.id}`}>
                                  <input
                                    id={`st-${u.id}-${b.id}`}
                                    type="checkbox"
                                    checked={storeDraft.includes(b.id)}
                                    onChange={() => setStoreDraft((d) => toggle(d, b.id))}
                                  />
                                  {b.name}
                                </label>
                              ))}
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                                <button type="button" className="btn btn-small btn-primary" style={{ width: 'auto' }} disabled={busy === `stores:${u.id}`} onClick={() => saveStores(u.id)}>
                                  {busy === `stores:${u.id}` ? 'Saving…' : 'Save'}
                                </button>
                                <button type="button" className="btn btn-small btn-secondary" onClick={() => setEditingStores(null)}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span className={u.branch_ids?.length ? '' : 'hint'}>
                                {['business_owner', 'operations_manager'].includes(u.role)
                                  ? 'All stores'
                                  : storeNames(u.branch_ids) || 'No store'}
                              </span>
                              {editable && !['business_owner', 'operations_manager'].includes(u.role) && branches.length > 0 && (
                                <button type="button" className="btn btn-small btn-secondary" onClick={() => { setEditingStores(u.id); setStoreDraft(u.branch_ids || []); }}>
                                  Edit
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          {editable ? (
                            <select value={u.access_level} onChange={(e) => updateUser(u.id, { accessLevel: e.target.value })} aria-label={`Access for ${u.full_name}`}>
                              {ACCESS_LEVELS.map((a) => <option key={a.value} value={a.value}>{a.label.split(' —')[0]}</option>)}
                            </select>
                          ) : ACCESS_LEVELS.find((a) => a.value === u.access_level)?.label.split(' —')[0]}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span className={`pill ${u.status === 'disabled' ? 'pill-red' : u.status === 'active' ? 'pill-green' : ''}`}>{u.status}</span>
                            {editable && u.status !== 'disabled' && (
                              confirmingDisable === u.id ? (
                                <>
                                  <button type="button" className="btn btn-small btn-danger" onClick={() => { setConfirmingDisable(null); updateUser(u.id, { status: 'disabled' }); }}>
                                    {u.status === 'invited' ? 'Cancel invite' : 'Disable'}
                                  </button>
                                  <button type="button" className="btn btn-small btn-secondary" onClick={() => setConfirmingDisable(null)}>Keep</button>
                                </>
                              ) : (
                                <button type="button" className="btn btn-small btn-secondary" onClick={() => setConfirmingDisable(u.id)}>
                                  {u.status === 'invited' ? 'Cancel invite' : 'Disable'}
                                </button>
                              )
                            )}
                            {editable && u.status === 'disabled' && (
                              <button type="button" className="btn btn-small btn-secondary" onClick={() => updateUser(u.id, { status: 'active' })}>Enable</button>
                            )}
                            {editable && u.status === 'active' && confirmingDisable !== u.id && (
                              <button type="button" className="btn btn-small btn-secondary" disabled={busy === `reset:${u.id}`} onClick={() => resetPassword(u)}>
                                {busy === `reset:${u.id}` ? 'Creating…' : 'Reset password'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="hint">Disabled people can't sign in and don't count toward your plan's users. Their past reports are kept.</p>

          {assignableRoles.length > 0 && (
            <form onSubmit={invite} className="card">
              <div className="field">
                <label htmlFor="ifn">Full name</label>
                <input id="ifn" required value={inviteForm.fullName} onChange={(e) => setInviteForm((f) => ({ ...f, fullName: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="iem">Email</label>
                <input id="iem" type="email" autoComplete="off" autoCapitalize="none" spellCheck={false} required value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="irole">Role</label>
                <select id="irole" value={inviteForm.role} onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}>
                  {assignableRoles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              {branches.length > 0 && !['operations_manager'].includes(inviteForm.role) && (
                <fieldset className="field" style={{ border: 0, padding: 0, margin: '0 0 18px' }}>
                  <legend style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Works at</legend>
                  {branches.map((b) => (
                    <label key={b.id} className="inline-check" htmlFor={`inv-${b.id}`}>
                      <input
                        id={`inv-${b.id}`}
                        type="checkbox"
                        checked={inviteForm.branchIds.includes(b.id)}
                        onChange={() => setInviteForm((f) => ({ ...f, branchIds: toggle(f.branchIds, b.id) }))}
                      />
                      {b.name}
                    </label>
                  ))}
                  <p className="hint" style={{ margin: 0 }}>Store checklists reach people at the stores they work at.</p>
                </fieldset>
              )}
              <button className="btn btn-secondary" type="submit" disabled={busy === 'invite'}>
                {busy === 'invite' ? 'Sending…' : 'Invite user'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

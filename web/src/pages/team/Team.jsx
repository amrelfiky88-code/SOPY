import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useT } from '../../i18n/index.jsx';
import { ROLES, roleName } from '../onboarding/roles.js';
import { canAssignRole, canManageUser } from '../../../../shared/roles.js';
import { StorefrontIcon } from '../../components/icons.jsx';
import InviteLink from '../../components/InviteLink.jsx';
import CityField from '../../components/CityField.jsx';
import JobTitleSelect, { withRole, titleForRole, jobTitleLabel } from '../../components/JobTitleSelect.jsx';

export default function Team() {
  const t = useT();
  const { user: me } = useAuth();
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);
  const [branchForm, setBranchForm] = useState({ name: '', city: '' });
  const [inviteForm, setInviteForm] = useState({ fullName: '', email: '', role: 'employee', title: titleForRole('employee'), branchIds: [] });
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
      const nextRole = assignableRoles.at(-1)?.value || 'employee';
      setInviteForm({ fullName: '', email: '', role: nextRole, title: titleForRole(nextRole), branchIds: [] });
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
      setLastInvite({ path: res.resetLink, email: u.email, kind: res.kind || 'reset' });
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
    setUsers((u) => u.map((x) => (x.id === id ? { ...x, ...patch } : x)));
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
      <h2>{t('team.title')}</h2>
      {error && <div className="error-banner">{error}</div>}

      <div className="filter-row">
        <button className={tab === 'stores' ? 'active' : ''} onClick={() => setTab('stores')}>{t('team.storesTab', { n: branches.length })}</button>
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>{t('team.usersTab', { n: users.length })}</button>
      </div>

      {tab === 'stores' && (
        <div>
          <div className="card">
            {branches.map((b) => (
              <div className="checklist-row" key={b.id}>
                <div><strong>{b.name}</strong>{b.city ? ` — ${b.city}` : ''}</div>
                {confirmingRemove === b.id ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button className="btn btn-small btn-danger" onClick={() => removeBranch(b.id)}>{t('team.removeStore')}</button>
                    <button className="btn btn-small btn-secondary" onClick={() => setConfirmingRemove(null)}>{t('page.keep')}</button>
                  </div>
                ) : (
                  <button className="btn btn-small btn-danger" onClick={() => setConfirmingRemove(b.id)}>{t('page.remove')}</button>
                )}
              </div>
            ))}
            {branches.length === 0 && (
              <div className="empty-state">
                <StorefrontIcon size={32} />
                <span>{t('team.noStores')}</span>
              </div>
            )}
            {confirmingRemove && <p className="hint">{t('team.removeHint')}</p>}
          </div>
          <form onSubmit={addBranch} className="card">
            <div className="field">
              <label htmlFor="bname">{t('page.branchName')}</label>
              <input id="bname" required value={branchForm.name} onChange={(e) => setBranchForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <CityField id="bcity" label={t('page.city')} value={branchForm.city} onChange={(v) => setBranchForm((f) => ({ ...f, city: v }))} />
            <button className="btn btn-secondary" type="submit" disabled={busy === 'branch'}>
              {busy === 'branch' ? t('page.adding') : t('page.addBranch')}
            </button>
          </form>
        </div>
      )}

      {tab === 'users' && (
        <div>
          {lastInvite && <InviteLink path={lastInvite.path} email={lastInvite.email} kind={lastInvite.kind} />}

          <div className="card">
            <div className="table-scroll">
              <table className="team-table">
                <thead>
                  <tr>
                    <th>{t('page.name')}</th><th>{t('page.email')}</th><th>{t('page.role')}</th><th>{t('account.jobTitle')}</th>
                    <th>{t('page.stores')}</th><th>{t('page.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isMe = u.id === me?.id;
                    const editable = !isMe && canManageUser(me?.role, u.role);
                    return (
                      <tr key={u.id}>
                        <td className="team-name">{u.full_name}{isMe ? ` ${t('page.you')}` : ''}</td>
                        <td className="team-email">{u.email}</td>
                        <td data-label={t('page.role')}>
                          {editable ? (
                            <select value={u.role} onChange={(e) => updateUser(u.id, { role: e.target.value })} aria-label={t('team.roleFor', { name: u.full_name })}>
                              {assignableRoles.map((r) => <option key={r.value} value={r.value}>{roleName(t, r.value)}</option>)}
                            </select>
                          ) : roleName(t, u.role)}
                        </td>
                        <td data-label={t('account.jobTitle')}>
                          {editable ? (
                            <JobTitleSelect value={u.title} onChange={(v) => updateUser(u.id, { title: v })} ariaLabel={t('team.titleFor', { name: u.full_name })} />
                          ) : jobTitleLabel(t, u.title)}
                        </td>
                        <td data-label={t('page.stores')} style={{ minWidth: 150 }}>
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
                                  {busy === `stores:${u.id}` ? t('common.saving') : t('common.save')}
                                </button>
                                <button type="button" className="btn btn-small btn-secondary" onClick={() => setEditingStores(null)}>{t('common.cancel')}</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span className={u.branch_ids?.length ? '' : 'hint'}>
                                {['business_owner', 'operations_manager'].includes(u.role)
                                  ? t('page.allStores')
                                  : storeNames(u.branch_ids) || t('page.noStore')}
                              </span>
                              {editable && !['business_owner', 'operations_manager'].includes(u.role) && branches.length > 0 && (
                                <button type="button" className="btn btn-small btn-secondary" onClick={() => { setEditingStores(u.id); setStoreDraft(u.branch_ids || []); }}>
                                  {t('page.edit')}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td data-label={t('page.status')}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span className={`pill ${u.status === 'disabled' ? 'pill-red' : u.status === 'active' ? 'pill-green' : ''}`}>{t(`userStatus.${u.status}`)}</span>
                            {editable && u.status !== 'disabled' && (
                              confirmingDisable === u.id ? (
                                <>
                                  <button type="button" className="btn btn-small btn-danger" onClick={() => { setConfirmingDisable(null); updateUser(u.id, { status: 'disabled' }); }}>
                                    {u.status === 'invited' ? t('team.cancelInvite') : t('team.disable')}
                                  </button>
                                  <button type="button" className="btn btn-small btn-secondary" onClick={() => setConfirmingDisable(null)}>{t('page.keep')}</button>
                                </>
                              ) : (
                                <button type="button" className="btn btn-small btn-secondary" onClick={() => setConfirmingDisable(u.id)}>
                                  {u.status === 'invited' ? t('team.cancelInvite') : t('team.disable')}
                                </button>
                              )
                            )}
                            {editable && u.status === 'disabled' && (
                              <button type="button" className="btn btn-small btn-secondary" onClick={() => updateUser(u.id, { status: 'active' })}>{t('team.enable')}</button>
                            )}
                            {editable && u.status !== 'disabled' && confirmingDisable !== u.id && (
                              <button type="button" className="btn btn-small btn-secondary" disabled={busy === `reset:${u.id}`} onClick={() => resetPassword(u)}>
                                {busy === `reset:${u.id}` ? t('team.creating') : u.status === 'invited' ? t('team.newInviteLink') : t('team.resetPassword')}
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

          <p className="hint">{t('team.disabledHint')}</p>

          {assignableRoles.length > 0 && (
            <form onSubmit={invite} className="card">
              <div className="field">
                <label htmlFor="ifn">{t('page.fullName')}</label>
                <input id="ifn" required value={inviteForm.fullName} onChange={(e) => setInviteForm((f) => ({ ...f, fullName: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="iem">{t('page.email')}</label>
                <input id="iem" type="email" autoComplete="off" autoCapitalize="none" spellCheck={false} required value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="irole">{t('page.role')}</label>
                <select id="irole" value={inviteForm.role} onChange={(e) => setInviteForm((f) => withRole(f, e.target.value))}>
                  {assignableRoles.map((r) => <option key={r.value} value={r.value}>{roleName(t, r.value)}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="ititle">{t('account.jobTitle')}</label>
                <JobTitleSelect id="ititle" value={inviteForm.title} onChange={(v) => setInviteForm((f) => ({ ...f, title: v }))} />
              </div>
              {branches.length > 0 && !['operations_manager'].includes(inviteForm.role) && (
                <fieldset className="field" style={{ border: 0, padding: 0, margin: '0 0 18px' }}>
                  <legend style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{t('team.worksAt')}</legend>
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
                  <p className="hint" style={{ margin: 0 }}>{t('team.worksAtHint')}</p>
                </fieldset>
              )}
              <button className="btn btn-secondary" type="submit" disabled={busy === 'invite'}>
                {busy === 'invite' ? t('team.sending') : t('team.inviteUser')}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

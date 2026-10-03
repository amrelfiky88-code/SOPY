import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useT } from '../../i18n/index.jsx';
import { ROLES, roleName } from './roles.js';
import InviteLink from '../../components/InviteLink.jsx';
import JobTitleSelect, { withRole, titleForRole } from '../../components/JobTitleSelect.jsx';

export default function StepInvites({ onNext, onBack, finishing }) {
  const t = useT();
  const { tenant } = useAuth();
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ fullName: '', email: '', role: 'employee', title: titleForRole('employee'), branchIds: [] });
  const [lastInviteLink, setLastInviteLink] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const [u, b] = await Promise.all([api.get('/tenants/users'), api.get('/tenants/branches')]);
      setUsers(u.users);
      setBranches(b.branches);
    } catch (err) {
      setError(err.message);
    }
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
      setForm({ fullName: '', email: '', role: 'employee', title: titleForRole('employee'), branchIds: [] });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2>{t('onb.invites.title')}</h2>
      <p>{t('onb.invites.intro', { n: tenant?.user_count ?? '' })}</p>

      {error && <div className="error-banner">{error}</div>}
      {lastInviteLink && <InviteLink path={lastInviteLink.path} email={lastInviteLink.email} />}

      {users.map((u) => (
        <div className="checklist-row" key={u.id}>
          <div>
            <strong><bdi>{u.full_name}</bdi></strong> — <bdi>{u.email}</bdi>
            <div className="hint">{roleName(t, u.role)} · {t(`userStatus.${u.status}`)}</div>
          </div>
        </div>
      ))}

      <form onSubmit={invite} style={{ marginTop: 16 }}>
        <div className="field">
          <label htmlFor="fullName">{t('page.fullName')}</label>
          <input id="fullName" required value={form.fullName} onChange={set('fullName')} />
        </div>
        <div className="field">
          <label htmlFor="email">{t('page.email')}</label>
          <input id="email" type="email" autoComplete="off" autoCapitalize="none" spellCheck={false} required value={form.email} onChange={set('email')} />
        </div>
        <div className="field">
          <label htmlFor="role">{t('page.role')}</label>
          <select id="role" value={form.role} onChange={(e) => setForm((f) => withRole(f, e.target.value))}>
            {ROLES.filter((r) => r.value !== 'business_owner').map((r) => (
              <option key={r.value} value={r.value}>{roleName(t, r.value)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="jobTitle">{t('account.jobTitle')}</label>
          <JobTitleSelect id="jobTitle" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} />
        </div>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: '0 0 18px' }}>
          <legend style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{t('onb.invites.assignBranches')}</legend>
          {branches.length === 0 && <p className="hint">{t('onb.invites.addBranchFirst')}</p>}
          {branches.map((b) => (
            <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400, marginBottom: 6 }}>
              <input type="checkbox" checked={form.branchIds.includes(b.id)} onChange={() => toggleBranch(b.id)} />
              {b.name}
            </label>
          ))}
        </fieldset>
        <button className="btn btn-secondary" type="submit" disabled={submitting}>{t('onb.invites.send')}</button>
      </form>

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <button className="btn btn-secondary" onClick={onBack}>{t('page.back')}</button>
        <button className="btn btn-primary" onClick={onNext} disabled={finishing}>
          {finishing ? t('onb.finishing') : t('onb.finish')}
        </button>
      </div>
    </div>
  );
}

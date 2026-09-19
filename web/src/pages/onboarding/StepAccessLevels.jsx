import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ACCESS_LEVELS, ROLES } from './roles.js';

export default function StepAccessLevels({ onNext, onBack, finishing }) {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const { users } = await api.get('/tenants/users');
      setUsers(users);
    } catch (err) {
      setError(err.message);
    }
  };
  useEffect(() => { load(); }, []);

  const updateAccess = async (id, accessLevel) => {
    setError('');
    const previous = users;
    setUsers((u) => u.map((x) => (x.id === id ? { ...x, access_level: accessLevel } : x)));
    try {
      await api.patch(`/tenants/users/${id}`, { accessLevel });
    } catch (err) {
      setUsers(previous);
      setError(err.message);
    }
  };

  return (
    <div>
      <h2>Set access levels</h2>
      <p>Decide how much each person can manage beyond completing their own checklists.</p>
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Name</th><th>Role</th><th>Access level</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.full_name}{u.id === me?.id ? ' (you)' : ''}</td>
                  <td>{ROLES.find((r) => r.value === u.role)?.label}</td>
                  <td>
                    {u.id === me?.id ? (
                      ACCESS_LEVELS.find((a) => a.value === u.access_level)?.label.split(' —')[0]
                    ) : (
                      <select value={u.access_level} onChange={(e) => updateAccess(u.id, e.target.value)} aria-label={`Access for ${u.full_name}`}>
                        {ACCESS_LEVELS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
        <button className="btn btn-primary" onClick={onNext} disabled={finishing}>
          {finishing ? 'Finishing…' : 'Finish onboarding'}
        </button>
      </div>
    </div>
  );
}

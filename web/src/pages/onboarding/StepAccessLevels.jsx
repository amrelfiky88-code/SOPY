import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { ACCESS_LEVELS, ROLES } from './roles.js';

export default function StepAccessLevels({ onNext, onBack, finishing }) {
  const [users, setUsers] = useState([]);

  const load = async () => {
    const { users } = await api.get('/tenants/users');
    setUsers(users);
  };
  useEffect(() => { load(); }, []);

  const updateAccess = async (id, accessLevel) => {
    setUsers((u) => u.map((x) => (x.id === id ? { ...x, access_level: accessLevel } : x)));
    await api.patch(`/tenants/users/${id}`, { accessLevel });
  };

  return (
    <div>
      <h2>Set access levels</h2>
      <p>Decide how much each person can manage beyond completing their own checklists.</p>

      <div className="card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Name</th><th>Role</th><th>Access level</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.full_name}</td>
                  <td>{ROLES.find((r) => r.value === u.role)?.label}</td>
                  <td>
                    <select value={u.access_level} onChange={(e) => updateAccess(u.id, e.target.value)}>
                      {ACCESS_LEVELS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
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

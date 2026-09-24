import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useT } from '../../i18n/index.jsx';
import { ACCESS_LEVELS, roleName, accessName, accessWithDescription } from './roles.js';

export default function StepAccessLevels({ onNext, onBack, finishing }) {
  const t = useT();
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
      <h2>{t('onb.access.title')}</h2>
      <p>{t('onb.access.intro')}</p>
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>{t('page.name')}</th><th>{t('page.role')}</th><th>{t('onb.access.level')}</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.full_name}{u.id === me?.id ? ` ${t('page.you')}` : ''}</td>
                  <td>{roleName(t, u.role)}</td>
                  <td>
                    {u.id === me?.id ? (
                      accessName(t, u.access_level)
                    ) : (
                      <select value={u.access_level} onChange={(e) => updateAccess(u.id, e.target.value)} aria-label={t('team.accessFor', { name: u.full_name })}>
                        {ACCESS_LEVELS.map((a) => <option key={a.value} value={a.value}>{accessWithDescription(t, a.value)}</option>)}
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
        <button className="btn btn-secondary" onClick={onBack}>{t('page.back')}</button>
        <button className="btn btn-primary" onClick={onNext} disabled={finishing}>
          {finishing ? t('onb.access.finishing') : t('onb.access.finish')}
        </button>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, setToken } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await api.post('/auth/accept-invite', { inviteToken: token, password });
      setToken(data.token);
      await refresh();
      navigate('/app/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return <div className="screen-narrow"><p>This invite link is missing its token.</p></div>;
  }

  return (
    <div className="screen-narrow">
      <h2>Set your password</h2>
      <p>Finish setting up your SOPY account.</p>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Set password and log in'}
        </button>
      </form>
    </div>
  );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

const COUNTRIES = [
  'United States', 'United Kingdom', 'United Arab Emirates', 'Saudi Arabia', 'Egypt',
  'Canada', 'Australia', 'India', 'Germany', 'France', 'Other',
];

export default function WhoAreYou() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [form, setForm] = useState({
    fullName: '', title: '', email: '', phone: '', password: '',
    restaurantName: '', country: '', branchCount: 1, userCount: 1,
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signup(form);
      navigate('/configure');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="screen-narrow">
      <div className="stepper">
        <div className="dot done" /><div className="dot" /><div className="dot" /><div className="dot" /><div className="dot" />
      </div>
      <h2>Who are you?</h2>
      <p>Tell us a bit about you and your restaurant so we can set things up.</p>

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="fullName">Full name</label>
          <input id="fullName" required value={form.fullName} onChange={set('fullName')} />
        </div>
        <div className="field">
          <label htmlFor="title">Title</label>
          <input id="title" placeholder="e.g. Owner, Operations Manager" value={form.title} onChange={set('title')} />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required value={form.email} onChange={set('email')} />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone</label>
          <input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
        </div>
        <div className="field">
          <label htmlFor="password">Create a password</label>
          <input id="password" type="password" autoComplete="new-password" minLength={8} required value={form.password} onChange={set('password')} />
          <div className="hint">At least 8 characters.</div>
        </div>
        <div className="field">
          <label htmlFor="restaurantName">Restaurant name</label>
          <input id="restaurantName" required value={form.restaurantName} onChange={set('restaurantName')} />
        </div>
        <div className="field">
          <label htmlFor="country">Country</label>
          <select id="country" required value={form.country} onChange={set('country')}>
            <option value="" disabled>Select a country</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="branchCount">Number of branches</label>
          <input id="branchCount" type="number" min={1} required value={form.branchCount} onChange={set('branchCount')} />
        </div>
        <div className="field">
          <label htmlFor="userCount">Number of users</label>
          <input id="userCount" type="number" min={1} required value={form.userCount} onChange={set('userCount')} />
        </div>

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Creating your account…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}

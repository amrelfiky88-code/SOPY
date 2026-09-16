import React from 'react';
import { ROLES } from './roles.js';

export default function StepRoles({ onNext }) {
  return (
    <div>
      <h2>Roles in SOPY</h2>
      <p>Every person you add gets one of these roles. You'll assign them when you invite your team next.</p>

      {ROLES.map((r) => (
        <div className="card" key={r.value} style={{ marginBottom: 10 }}>
          <strong>{r.label}</strong>
          <p style={{ margin: '4px 0 0' }}>{r.description}</p>
        </div>
      ))}

      <button className="btn btn-primary" onClick={onNext}>Continue</button>
    </div>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div>
      <div className="top-bar">
        <span className="brand">SOPY</span>
        <Link to="/login" className="btn btn-secondary btn-small">Log in</Link>
      </div>

      <div className="screen" style={{ paddingTop: 64 }}>
        <h1 style={{ fontSize: 34, maxWidth: 560 }}>
          SOPY: Restaurant Perfect Operating Procedure System
        </h1>

        <div className="card" style={{ marginTop: 24 }}>
          <p style={{ margin: 0 }}>Paper SOP binders get lost, skipped, and never checked twice.</p>
          <p style={{ margin: 0 }}>SOPY puts every checklist, log, and sign-off on the device your team already carries.</p>
          <p style={{ margin: 0 }}>You see compliance in real time — not after an inspection finds the gap.</p>
        </div>

        <Link to="/get-started" className="btn btn-primary" style={{ display: 'inline-block', width: 'auto', marginTop: 12 }}>
          Get Started
        </Link>
      </div>
    </div>
  );
}

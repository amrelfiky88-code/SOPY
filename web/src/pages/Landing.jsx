import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldIcon, GraduationCapIcon, CopyIcon, DoorOpenIcon, TrendingUpIcon, LayersIcon } from '../components/icons.jsx';

const WHY_SOPS = [
  {
    icon: ShieldIcon,
    tone: 'green',
    title: 'Food safety and health compliance',
    body: 'Health inspections are mandatory, and a critical violation can mean immediate closure and fines past $50,000. SOPs make sure every shift follows the same food-safety steps — whether or not you\'re watching.',
  },
  {
    icon: GraduationCapIcon,
    tone: 'amber',
    title: 'The training crisis',
    body: 'At roughly 75% annual turnover, restaurants are always training someone new. Written procedures get new hires productive about 50% faster than word-of-mouth training that changes with every trainer.',
  },
  {
    icon: CopyIcon,
    tone: 'green',
    title: 'Consistency across shifts and locations',
    body: 'Customers expect the same dish and the same service Tuesday lunch or Saturday dinner, whoever is on the floor. SOPs are what keep quality from depending on who happens to be working.',
  },
  {
    icon: DoorOpenIcon,
    tone: 'amber',
    title: 'Owner freedom',
    body: 'When "only I know how to do X" is true, you can\'t take a day off. Documented procedures let staff open, close, and handle vendors without you in the building.',
  },
  {
    icon: TrendingUpIcon,
    tone: 'green',
    title: 'Operational efficiency',
    body: 'Restaurants run on 3–6% margins, so small leaks sink you. SOPs cut food waste through proper storage, reduce remakes, and speed up service by standardizing the workflow.',
  },
  {
    icon: LayersIcon,
    tone: 'amber',
    title: 'Scalability',
    body: 'A second location can only run like the first one if the first one is actually written down. SOPs are what makes your success repeatable, not personality-dependent.',
  },
];

export default function Landing() {
  return (
    <div>
      <div className="top-bar">
        <span className="brand">SOPY</span>
        <Link to="/login" className="btn btn-secondary btn-small">Log in</Link>
      </div>

      <div className="screen" style={{ paddingTop: 64 }}>
        <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--green)' }}>
          For restaurants and cafés
        </p>
        <h1 style={{ fontSize: 36, maxWidth: 580 }}>
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

        <h2 style={{ marginTop: 64 }}>Why restaurants need SOPs</h2>
        <p style={{ maxWidth: 560 }}>SOPs aren't a nice-to-have — they're what stands between a restaurant and the six things that actually put one out of business.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 8 }}>
          {WHY_SOPS.map((item) => (
            <div className="card" key={item.title} style={{ marginBottom: 0 }}>
              <div className={`icon-circle icon-circle-${item.tone}`} style={{ marginBottom: 12 }}>
                <item.icon size={18} />
              </div>
              <strong>{item.title}</strong>
              <p style={{ margin: '6px 0 0' }}>{item.body}</p>
            </div>
          ))}
        </div>

        <Link to="/get-started" className="btn btn-primary" style={{ display: 'inline-block', width: 'auto', marginTop: 24 }}>
          Get Started
        </Link>
      </div>
    </div>
  );
}

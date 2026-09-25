import React from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../i18n/index.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';
import { ShieldIcon, GraduationCapIcon, CopyIcon, DoorOpenIcon, TrendingUpIcon, LayersIcon } from '../components/icons.jsx';

// Wording lives in i18n/pageLabels.js as landing.why1…why6.
const WHY_SOPS = [
  { icon: ShieldIcon, tone: 'green' },
  { icon: GraduationCapIcon, tone: 'amber' },
  { icon: CopyIcon, tone: 'green' },
  { icon: DoorOpenIcon, tone: 'amber' },
  { icon: TrendingUpIcon, tone: 'green' },
  { icon: LayersIcon, tone: 'amber' },
];

export default function Landing() {
  const t = useT();
  return (
    <div>
      <div className="top-bar">
        <span className="brand">SOPY</span>
        <div className="top-bar-actions">
          <LanguageSwitcher />
          <Link to="/login" className="btn btn-secondary btn-small">{t('landing.login')}</Link>
        </div>
      </div>

      <div className="screen" style={{ paddingTop: 64 }}>
        <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--green)' }}>
          {t('landing.kicker')}
        </p>
        <h1 style={{ fontSize: 36, maxWidth: 580 }}>
          {t('landing.headline')}
        </h1>

        <div className="card" style={{ marginTop: 24 }}>
          <p style={{ margin: '0 0 10px' }}>{t('landing.pitch1')}</p>
          <p style={{ margin: '0 0 10px' }}>{t('landing.pitch2')}</p>
          <p style={{ margin: 0 }}>{t('landing.pitch3')}</p>
        </div>

        <Link to="/get-started" className="btn btn-primary cta-btn" style={{ marginTop: 12 }}>
          {t('landing.getStarted')}
        </Link>

        <h2 style={{ marginTop: 64 }}>{t('landing.whyTitle')}</h2>
        <p style={{ maxWidth: 560 }}>{t('landing.whyIntro')}</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 8 }}>
          {WHY_SOPS.map((item, i) => (
            <div className="card" key={i} style={{ marginBottom: 0 }}>
              {/* Icon beside the title, so a title that wraps lines up with
                  itself instead of running back under the icon. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className={`icon-circle icon-circle-${item.tone}`} style={{ flexShrink: 0 }}>
                  <item.icon size={18} />
                </div>
                <strong>{t(`landing.why${i + 1}.title`)}</strong>
              </div>
              <p style={{ margin: '6px 0 0' }}>{t(`landing.why${i + 1}.body`)}</p>
            </div>
          ))}
        </div>

        <Link to="/get-started" className="btn btn-primary cta-btn" style={{ marginTop: 24 }}>
          {t('landing.getStarted')}
        </Link>
      </div>
    </div>
  );
}

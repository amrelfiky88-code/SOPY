import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { LANGUAGES } from '../../../shared/languages.js';
import { ShieldIcon, GraduationCapIcon, CopyIcon, DoorOpenIcon, TrendingUpIcon, LayersIcon, CameraIcon, CheckCircleIcon } from '../components/icons.jsx';
import Logo from '../components/Logo.jsx';

// Wording lives in i18n/pageLabels.js as landing.why1…why6.
const WHY_SOPS = [
  { icon: ShieldIcon, tone: 'green' },
  { icon: GraduationCapIcon, tone: 'amber' },
  { icon: CopyIcon, tone: 'green' },
  { icon: DoorOpenIcon, tone: 'amber' },
  { icon: TrendingUpIcon, tone: 'green' },
  { icon: LayersIcon, tone: 'amber' },
];
const SHORT = { en: 'EN', ar: 'ع', fr: 'FR' };

// Welcome: the brand's dark Forest page (marketing, so the Signal accent
// is allowed here). A sample score card and photo-evidence card show what
// SOPY does; the pitch, the six reasons, then Get started / Log in, which
// stay at the bottom of the screen on a phone.
export default function Landing() {
  const { t, lang, setLang } = useI18n();
  return (
    <div className="welcome">
      <div className="welcome-scroll">
        <div className="welcome-top">
          <Logo size={30} theme="reverse" />
          <div className="welcome-langs" role="radiogroup" aria-label={t('page.languageLabel')}>
            {LANGUAGES.map((l) => (
              <button key={l.code} type="button" role="radio" aria-checked={lang === l.code} aria-label={l.nativeLabel} lang={l.code}
                className={lang === l.code ? 'active' : ''} onClick={() => setLang(l.code)}>
                {SHORT[l.code] || l.code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="welcome-hero">
          <div className="welcome-cards" aria-hidden="true">
            <div className="welcome-score">
              <div className="welcome-score-head">
                <span>{t('welcome.sampleReport')}</span>
                <span className="pill pill-green">{t('welcome.green')}</span>
              </div>
              <div className="welcome-score-value">97%</div>
              <div className="welcome-score-sub">{t('welcome.sampleCompliant')}</div>
            </div>
            <div className="welcome-photo">
              <span className="icon-circle icon-circle-green"><CameraIcon size={16} /></span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t('welcome.photoCaptured')}</div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{t('welcome.photoMeta')}</div>
              </div>
            </div>
          </div>

          <div>
            <div className="welcome-kicker">{t('landing.kicker')}</div>
            <h1 className="welcome-title">{t('landing.tagline')}</h1>
            <p className="welcome-sub">{t('landing.headline')}</p>
            <div className="welcome-pitch">
              {['pitch1', 'pitch2', 'pitch3'].map((k) => (
                <div key={k}><CheckCircleIcon size={16} /><span>{t(`landing.${k}`)}</span></div>
              ))}
            </div>
          </div>
        </div>

        <div className="welcome-why">
          <h2>{t('landing.whyTitle')}</h2>
          <p>{t('landing.whyIntro')}</p>
          <div className="welcome-why-cards">
            {WHY_SOPS.map((item, i) => (
              <div className="welcome-why-card" key={i}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`icon-circle icon-circle-${item.tone}`}><item.icon size={16} /></span>
                  <strong>{t(`landing.why${i + 1}.title`)}</strong>
                </div>
                <div className="welcome-why-body">{t(`landing.why${i + 1}.body`)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="welcome-actions">
        <Link to="/get-started" className="btn welcome-start">{t('landing.getStarted')}</Link>
        <Link to="/login" className="btn welcome-login">{t('landing.login')}</Link>
      </div>
    </div>
  );
}

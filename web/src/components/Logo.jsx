import React from 'react';
import { useI18n } from '../i18n/index.jsx';

// The SOPY logo from the brand guidelines (design/brand-kit): the
// Checkpoint mark (three bars on a rounded tile, the last ending in a
// dot) and the wordmark, "SOPY" in Source Serif 4 Bold or "سوبي" in IBM
// Plex Sans Arabic Bold on Arabic pages. Proportions follow the kit: tile
// radius 22%, bars 9.5% thick with 7.5% gaps, dot 17% of the tile.
//
// theme: 'primary' (Forest on Paper or white) or 'reverse' (Paper on Forest).
// layout: 'lockup' (mark + wordmark), 'mark' or 'wordmark'.
// The minimum size is 28px for the lockup and 16px for the mark alone.
const THEMES = {
  primary: { tile: 'var(--green)', fg: 'var(--paper)', word: 'var(--green)' },
  reverse: { tile: 'var(--paper)', fg: 'var(--green)', word: 'var(--paper)' },
};

export default function Logo({ size = 28, theme = 'primary', layout = 'lockup', className }) {
  const { lang } = useI18n();
  const arabic = lang === 'ar';
  const t = THEMES[theme] || THEMES.primary;
  const bar = { height: '.095em', borderRadius: '.05em', background: t.fg };
  return (
    <span
      className={`sopy-logo${className ? ` ${className}` : ''}`}
      role="img"
      aria-label="SOPY"
      style={{ fontSize: size, gap: '.32em' }}
    >
      {layout !== 'wordmark' && (
        <span className="sopy-logo-mark" style={{ background: t.tile }} aria-hidden="true">
          <span style={bar} />
          <span style={bar} />
          <span style={{ display: 'flex', alignItems: 'center', gap: '.07em' }}>
            <span style={{ ...bar, width: '.26em' }} />
            <span style={{ width: '.17em', height: '.17em', borderRadius: '50%', background: t.fg }} />
          </span>
        </span>
      )}
      {layout !== 'mark' && (
        <span
          className={`sopy-logo-word${arabic ? ' sopy-logo-word-ar' : ''}`}
          style={{ color: t.word }}
          aria-hidden="true"
        >
          {arabic ? 'سوبي' : 'SOPY'}
        </span>
      )}
    </span>
  );
}

import React from 'react';
import { clampPlanCount } from '../../../shared/pricing.js';
import { useT } from '../i18n/index.jsx';

// Slider for a quick sweep, plus a −/+ stepper that stays usable with a
// fingertip and can't be pushed outside the plan limits. Shared by the
// signup Pricing page and the in-app plan editor on the account page.
export default function QuantityField({ id, label, value, onChange, limits, sliderMax }) {
  const t = useT();
  const commit = (next) => {
    const clamped = clampPlanCount(next, limits);
    if (clamped !== null) onChange(clamped);
  };

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="qty-stepper">
        <button
          type="button"
          onClick={() => commit(value - 1)}
          disabled={value <= limits.min}
          aria-label={t('qty.fewer', { label })}
        >
          −
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={limits.min}
          max={limits.max}
          value={value}
          onChange={(e) => {
            // Let the field go empty mid-edit; clamp on blur instead of
            // fighting the keyboard on every keystroke.
            if (e.target.value === '') return onChange('');
            commit(e.target.value);
          }}
          onBlur={(e) => commit(e.target.value === '' ? limits.min : e.target.value)}
        />
        <button
          type="button"
          onClick={() => commit(Number(value || 0) + 1)}
          disabled={value >= limits.max}
          aria-label={t('qty.more', { label })}
        >
          +
        </button>
      </div>
      <input
        type="range"
        className="qty-range"
        min={limits.min}
        max={sliderMax}
        value={Math.min(Number(value) || limits.min, sliderMax)}
        onChange={(e) => commit(e.target.value)}
        aria-label={t('qty.slider', { label })}
      />
    </div>
  );
}

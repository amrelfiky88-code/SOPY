import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { COUNTRY_GROUPS, countryOptions, countryCode } from '../../../shared/countries.js';
import { composePhone, parsePhone, dialLabel } from '../../../shared/phone.js';

// The country a new number most likely belongs to: the business's country
// when there is one, else the region in the browser's language ("ar-EG"),
// else Egypt.
function guessCountry(countryName) {
  const fromCountry = countryCode(countryName);
  if (fromCountry) return fromCountry;
  try {
    for (const tag of navigator.languages || [navigator.language]) {
      const region = new Intl.Locale(tag).region;
      if (region && dialLabel(region)) return region;
    }
  } catch { /* old browser */ }
  return 'EG';
}

// A phone number with its country code picked from a list of every
// country, saved as "+20 1222553971". `value` is that saved form (or an
// older number without a code); `country` is the business's country, used
// for numbers that don't say. Until someone picks a code themselves, it
// follows `country` as that changes (the sign-up form asks for it later).
export default function PhoneField({ id, label, value, onChange, country }) {
  const { t, lang } = useI18n();
  const parsed = useMemo(() => parsePhone(value, guessCountry(country)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [iso, setIso] = useState(parsed.iso || guessCountry(country));
  const [national, setNational] = useState(parsed.national);
  const pickedCode = useRef(!!value);
  const lastSent = useRef(value || '');

  // The saved number arrived after the box was drawn (Profile loads it).
  useEffect(() => {
    if ((value || '') === lastSent.current) return;
    const p = parsePhone(value, guessCountry(country));
    if (p.iso) setIso(p.iso);
    setNational(p.national);
    lastSent.current = value || '';
    pickedCode.current = pickedCode.current || !!value;
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the business's country until a code has been chosen.
  useEffect(() => {
    if (!pickedCode.current && countryCode(country)) setIso(countryCode(country));
  }, [country]);

  const send = (nextIso, nextNational) => {
    const composed = composePhone(nextIso, nextNational);
    lastSent.current = composed;
    onChange(composed);
  };

  // Every country, grouped by region like the country list, each shown as
  // "+20 Egypt" so the code is what's visible in the narrow closed box.
  const groups = useMemo(() => {
    const names = new Map(countryOptions(lang).flatMap((g) => g.countries.map((c) => [c.value, c.label])));
    return COUNTRY_GROUPS.map(([key, list]) => ({
      key,
      options: list
        // The code is isolated (LRI…PDI) or, beside an Arabic name, it showed as "20+".
        .map(([code, english]) => ({ code, label: `⁦${dialLabel(code)}⁩ ${names.get(english) || english}`, name: names.get(english) || english }))
        .sort((a, b) => a.name.localeCompare(b.name, lang)),
    }));
  }, [lang]);

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {/* Numbers read left to right in every language. */}
      <div className="phone-field" dir="ltr">
        <select
          aria-label={t('field.countryCode')}
          value={iso}
          onChange={(e) => { pickedCode.current = true; setIso(e.target.value); send(e.target.value, national); }}
        >
          {groups.map((g) => (
            <optgroup key={g.key} label={t(`countryGroup.${g.key}`)}>
              {g.options.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
            </optgroup>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={national}
          onChange={(e) => {
            // A whole number pasted from contacts ("+20 100 123 4567" or
            // "0020…") brings its own code: pick it in the list rather than
            // saving "+20 20100…".
            const typed = e.target.value;
            const intl = /^\s*(\+|00)/.test(typed) ? parsePhone(typed.trim().replace(/^00/, '+')) : null;
            if (intl?.iso && intl.national.replace(/\D/g, '')) {
              pickedCode.current = true;
              setIso(intl.iso);
              setNational(intl.national);
              send(intl.iso, intl.national);
              return;
            }
            setNational(typed);
            send(iso, typed);
          }}
        />
      </div>
    </div>
  );
}

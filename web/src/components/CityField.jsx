import React, { useEffect, useId, useMemo, useState } from 'react';
import { api, getToken } from '../api.js';
import { useI18n } from '../i18n/index.jsx';
import { countryOptions } from '../../../shared/countries.js';
import { foldText } from '../../../shared/searchText.js';

// A business's country doesn't change while it's signed in, so its city
// list is fetched once and shared by every City box. Kept per session:
// after signing out, another business on the same phone kept seeing the
// first one's cities.
let citiesRequest = null;
let citiesFor = null;
function loadCities() {
  const session = getToken();
  if (!citiesRequest || citiesFor !== session) {
    citiesFor = session;
    citiesRequest = api.get('/tenants/cities').catch((err) => {
      citiesRequest = null; // try again next time rather than caching a failure
      throw err;
    });
  }
  return citiesRequest;
}

// For matching what's typed: no accents or Arabic diacritics, and one form
// of the Arabic letters people type interchangeably (أ إ آ → ا, ة → ه, ى → ي),
// so "الاسكندرية" finds الإسكندرية and "Shubra" finds Shubrā.
const fold = (s) => foldText(s).trim();

const SHOWN = 8;

// A store's City box: the cities of the business's country (Arabic names on
// an Arabic page, where known), biggest first. Tapping the box lists them
// and typing filters the list; a town that isn't listed can still be typed.
// SOPY draws the list itself: the browser's own suggestion list (datalist)
// shows nothing in several phone browsers, so the box looked unrelated to
// the business's country.
export default function CityField({ id, label, value, onChange }) {
  const { t, lang } = useI18n();
  const listId = useId();
  const [data, setData] = useState({ country: null, cities: [] });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    let live = true;
    loadCities().then((d) => { if (live) setData({ country: d.country, cities: d.cities || [] }); }).catch(() => {});
    return () => { live = false; };
  }, []);

  // [{ shown, keys }], biggest first: the name for this page's language, and
  // every form it can be found by.
  const cities = useMemo(() => {
    const seen = new Set();
    return data.cities.map(([en, ar]) => ({ shown: lang === 'ar' && ar ? ar : en, keys: [fold(en), fold(ar)].filter(Boolean) }))
      .filter((c) => (seen.has(c.shown) ? false : seen.add(c.shown)));
  }, [data.cities, lang]);

  const matches = useMemo(() => {
    const q = fold(value);
    if (!q) return cities.slice(0, SHOWN);
    const starts = cities.filter((c) => c.keys.some((k) => k.startsWith(q)));
    const contains = cities.filter((c) => !starts.includes(c) && c.keys.some((k) => k.includes(q)));
    return [...starts, ...contains].slice(0, SHOWN);
  }, [cities, value]);

  const countryName = useMemo(() => {
    const all = countryOptions(lang).flatMap((g) => g.countries);
    return all.find((c) => c.value === data.country)?.label || data.country;
  }, [data.country, lang]);

  const showList = open && cities.length > 0 && matches.length > 0
    && !(matches.length === 1 && matches[0].shown === value);
  const choose = (name) => { onChange(name); setOpen(false); setActive(-1); };

  const onKeyDown = (e) => {
    if (!showList) { if (e.key === 'ArrowDown') setOpen(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(matches[active].shown); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="field city-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        // Closing on blur waits a moment, so a tap on a city still lands.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul className="city-options" id={listId} role="listbox">
          {matches.map((c, i) => (
            <li
              key={c.shown}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              // mousedown, not click: it fires before the box loses focus.
              onMouseDown={(e) => { e.preventDefault(); choose(c.shown); }}
            >
              {c.shown}
            </li>
          ))}
        </ul>
      )}
      {cities.length > 0 && <div className="hint">{t('page.cityHint', { country: countryName })}</div>}
    </div>
  );
}

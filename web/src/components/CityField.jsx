import React, { useEffect, useId, useMemo, useState } from 'react';
import { api, getToken } from '../api.js';
import { useI18n } from '../i18n/index.jsx';

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

// A store's City box: every city of the business's country as suggestions
// (Arabic names on an Arabic page, where known), biggest first; typing
// filters the list. A town that isn't listed can still be typed in.
export default function CityField({ id, label, value, onChange }) {
  const { t, lang } = useI18n();
  const listId = useId();
  const [cities, setCities] = useState([]);

  useEffect(() => {
    let live = true;
    loadCities().then((d) => { if (live) setCities(d.cities || []); }).catch(() => {});
    return () => { live = false; };
  }, []);

  const names = useMemo(
    () => [...new Set(cities.map(([en, ar]) => (lang === 'ar' && ar ? ar : en)))],
    [cities, lang]
  );

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        list={names.length ? listId : undefined}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {names.length > 0 && (
        <>
          <datalist id={listId}>
            {names.map((n) => <option key={n} value={n} />)}
          </datalist>
          <div className="hint">{t('page.cityHint')}</div>
        </>
      )}
    </div>
  );
}

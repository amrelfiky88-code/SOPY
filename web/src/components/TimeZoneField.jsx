import React, { useMemo } from 'react';
import { useI18n } from '../i18n/index.jsx';

// A store's time zone: checklist reminders go out on its clock. Grouped
// by region, each zone shown with its current UTC offset. New stores start
// on this device's own zone, which is right for whoever is setting up in
// the store.

export function deviceTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

function allZones() {
  try { return Intl.supportedValuesOf('timeZone'); } catch { return [deviceTimeZone()]; }
}

function offset(zone) {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
      .formatToParts(new Date()).find((p) => p.type === 'timeZoneName');
    return (part?.value || 'GMT').replace('GMT', 'UTC');
  } catch {
    return '';
  }
}

export const zoneLabel = (zone) => (zone.includes('/') ? `${zone.split('/').slice(1).join(' / ').replaceAll('_', ' ')} (${offset(zone)})` : zone);

// The <optgroup>s, for a select styled elsewhere (Team's store rows).
export function TimeZoneOptions({ current }) {
  const groups = useMemo(() => {
    const zones = allZones();
    if (current && !zones.includes(current)) zones.push(current);
    const byRegion = new Map();
    for (const zone of zones) {
      const region = zone.includes('/') ? zone.split('/')[0] : 'UTC';
      if (!byRegion.has(region)) byRegion.set(region, []);
      byRegion.get(region).push(zone);
    }
    return [...byRegion.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [current]);
  return groups.map(([region, zones]) => (
    <optgroup key={region} label={region}>
      {zones.map((z) => <option key={z} value={z}>{region === 'UTC' ? z : zoneLabel(z)}</option>)}
    </optgroup>
  ));
}

export default function TimeZoneField({ id, value, onChange, disabled }) {
  const { t } = useI18n();
  return (
    <div className="field">
      <label htmlFor={id}>{t('tz.label')}</label>
      <select id={id} value={value || 'UTC'} onChange={(e) => onChange(e.target.value)} disabled={disabled} dir="ltr">
        <TimeZoneOptions current={value} />
      </select>
      <div className="hint">{t('tz.hint')}</div>
    </div>
  );
}

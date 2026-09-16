import React, { useId } from 'react';

export function LabeledInput({ label, value, onChange, type }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} type={type || 'text'} />
    </div>
  );
}

export function LabeledSelect({ label, value, onChange, options }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

export function LabeledTextarea({ label, value, onChange }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function Section({ title, children }) {
  return (
    <div className="card">
      <h3 style={{ marginBottom: 12, fontSize: 16 }}>{title}</h3>
      {children}
    </div>
  );
}

// Shared by both reports: a fixed list of equipment, each with a safe
// range and Start/Mid/End readings. `na` marks a row's Mid column as not
// applicable (e.g. fryer oil temp isn't read mid-shift in KDR-001).
export function TemperatureLogTable({ rows, values, onChange }) {
  return (
    <table>
      <thead>
        <tr><th>Equipment / Unit</th><th>Safe range</th><th>Start</th><th>Mid</th><th>End</th></tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const v = values[row.key] || {};
          return (
            <tr key={row.key}>
              <td>{row.label}</td>
              <td className="hint">{row.safeRange}</td>
              <td><input type="number" style={{ width: 70 }} value={v.s || ''} onChange={(e) => onChange(row.key, 's', e.target.value)} /></td>
              <td>
                {row.midNA ? 'N/A' : (
                  <input type="number" style={{ width: 70 }} value={v.m || ''} onChange={(e) => onChange(row.key, 'm', e.target.value)} />
                )}
              </td>
              <td><input type="number" style={{ width: 70 }} value={v.e || ''} onChange={(e) => onChange(row.key, 'e', e.target.value)} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function OpeningClosingChecklist({ opening, closing, values, onToggle }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      <div>
        <strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Opening tasks</strong>
        {opening.map((task, i) => (
          <label key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontWeight: 400, marginBottom: 8 }}>
            <input type="checkbox" checked={!!values.opening?.[i]} onChange={() => onToggle('opening', i)} />
            {task}
          </label>
        ))}
      </div>
      <div>
        <strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Closing tasks</strong>
        {closing.map((task, i) => (
          <label key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontWeight: 400, marginBottom: 8 }}>
            <input type="checkbox" checked={!!values.closing?.[i]} onChange={() => onToggle('closing', i)} />
            {task}
          </label>
        ))}
      </div>
    </div>
  );
}

export function RepeatableTable({ columns, rows, onChangeRow, onAddRow, onRemoveRow }) {
  return (
    <div>
      <table>
        <thead>
          <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}<th /></tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key}>
                  {c.type === 'checkbox' ? (
                    <input type="checkbox" checked={!!row[c.key]} onChange={(e) => onChangeRow(i, c.key, e.target.checked)} />
                  ) : (
                    <input
                      type={c.type || 'text'}
                      style={{ minWidth: c.width || 90 }}
                      value={row[c.key] ?? ''}
                      onChange={(e) => onChangeRow(i, c.key, e.target.value)}
                    />
                  )}
                </td>
              ))}
              <td><button type="button" className="btn btn-small btn-danger" onClick={() => onRemoveRow(i)}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-secondary btn-small" style={{ marginTop: 8 }} onClick={onAddRow}>+ Add row</button>
    </div>
  );
}

// Fixed row labels (e.g. 17 named beverage items, or cleaning tasks),
// each with several editable data columns. `na` on a row lists column
// keys that don't apply to that row (rendered as "N/A" — e.g. a cleaning
// task that's only done at open and close, never mid-shift).
export function FixedRowDataTable({ rows, columns, values, onChange }) {
  return (
    <table>
      <thead>
        <tr><th>Item</th>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const v = values[row.key] || {};
          return (
            <tr key={row.key}>
              <td>{row.label}</td>
              {columns.map((c) => {
                const isNA = row.na?.includes(c.key);
                return (
                  <td key={c.key}>
                    {isNA ? 'N/A' : c.type === 'checkbox' ? (
                      <input type="checkbox" checked={!!v[c.key]} onChange={(e) => onChange(row.key, c.key, e.target.checked)} />
                    ) : (
                      <input
                        type={c.type || 'text'}
                        style={{ width: c.width || 70 }}
                        value={v[c.key] ?? ''}
                        onChange={(e) => onChange(row.key, c.key, e.target.value)}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function FixedRowStatusTable({ rows, values, onChange, statusOptions }) {
  return (
    <table>
      <thead><tr><th>Item</th><th>Status</th><th>Notes</th></tr></thead>
      <tbody>
        {rows.map((row) => {
          const v = values[row.key] || {};
          return (
            <tr key={row.key}>
              <td>{row.label}</td>
              <td>
                <select value={v.status || statusOptions[0].value} onChange={(e) => onChange(row.key, 'status', e.target.value)}>
                  {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </td>
              <td><input value={v.note || ''} onChange={(e) => onChange(row.key, 'note', e.target.value)} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

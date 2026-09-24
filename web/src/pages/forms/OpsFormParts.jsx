import React, { useId } from 'react';
import { useT } from '../../i18n/index.jsx';
import ReportLink from '../../components/ReportLink.jsx';
import { CheckCircleIcon } from '../../components/icons.jsx';

// Labels come from i18n/formLabels.js, keyed by the same form_data path the
// field saves to, so each form builds a scoped lookup: L('shift.reportNo')
// → t('f.kitchen_daily.shift.reportNo').
export function useFormLabels(kind) {
  const t = useT();
  return { t, L: (path, vars) => t(`f.${kind}.${path}`, vars) };
}

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

// The same start screen, "submitted" card and save/submit bar sit on every
// pinned report; only the wording differs per kind.
export function ReportStart({ report, title, startLabel }) {
  const t = useT();
  return (
    <div>
      <h2>{title}</h2>
      {report.error && <div className="error-banner">{report.error}</div>}
      <div className="card">
        <div className="field">
          <label htmlFor="branch">{t('f.store')}</label>
          <select id="branch" value={report.branchId} onChange={(e) => report.setBranchId(e.target.value)}>
            {report.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={report.start} disabled={!report.branchId}>
          {report.hasDraft ? t('f.continueDraft') : startLabel || t('f.startReport')}
        </button>
        {report.branches.length === 0 && <p className="hint">{t('f.addStoreFirst')}</p>}
      </div>
    </div>
  );
}

export function ReportSubmitted({ report, message }) {
  return (
    <div className="card empty-state">
      <CheckCircleIcon size={32} style={{ color: 'var(--green)', opacity: 1 }} />
      <p style={{ margin: 0 }}>{message}</p>
      <ReportLink submissionId={report.submissionId} />
    </div>
  );
}

export function ReportActions({ report, form, hasIncident, signerName, needNameHint }) {
  const t = useT();
  const saving = report.status === 'saving';
  const signed = !!signerName?.trim();
  return (
    <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" onClick={() => report.save(form, hasIncident)} disabled={saving}>
          {saving ? t('common.saving') : report.justSaved ? t('f.savedTick') : t('f.saveProgress')}
        </button>
        <button className="btn btn-primary" onClick={() => report.submit(form, hasIncident)} disabled={saving || !signed}>
          {t('f.submitSignOff')}
        </button>
      </div>
      {!signed && <p className="hint">{needNameHint}</p>}
    </>
  );
}

// Shared by both reports: a fixed list of equipment, each with a safe
// range and Start/Mid/End readings. `midNA` marks a row's Mid column as
// not applicable (e.g. fryer oil temp isn't read mid-shift in KDR-001).
export function TemperatureLogTable({ rows, values, onChange }) {
  const t = useT();
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr><th>{t('f.equipmentUnit')}</th><th>{t('f.safeRange')}</th><th>{t('f.col.s')}</th><th>{t('f.col.m')}</th><th>{t('f.col.e')}</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const v = values[row.key] || {};
            return (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td className="hint">{row.safeRange}</td>
                <td><input type="number" aria-label={`${row.label} — ${t('f.col.s')}`} style={{ width: 70 }} value={v.s || ''} onChange={(e) => onChange(row.key, 's', e.target.value)} /></td>
                <td>
                  {row.midNA ? t('f.na') : (
                    <input type="number" aria-label={`${row.label} — ${t('f.col.m')}`} style={{ width: 70 }} value={v.m || ''} onChange={(e) => onChange(row.key, 'm', e.target.value)} />
                  )}
                </td>
                <td><input type="number" aria-label={`${row.label} — ${t('f.col.e')}`} style={{ width: 70 }} value={v.e || ''} onChange={(e) => onChange(row.key, 'e', e.target.value)} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function OpeningClosingChecklist({ opening, closing, values, onToggle }) {
  const t = useT();
  return (
    <div className="form-grid-2col">
      <div>
        <strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>{t('f.openingTasks')}</strong>
        {opening.map((task, i) => (
          <label key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontWeight: 400, marginBottom: 8 }}>
            <input type="checkbox" checked={!!values.opening?.[i]} onChange={() => onToggle('opening', i)} />
            {task}
          </label>
        ))}
      </div>
      <div>
        <strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>{t('f.closingTasks')}</strong>
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
  const t = useT();
  return (
    <div>
      <div className="table-scroll">
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
                      <input type="checkbox" aria-label={c.label} checked={!!row[c.key]} onChange={(e) => onChangeRow(i, c.key, e.target.checked)} />
                    ) : (
                      <input
                        type={c.type || 'text'}
                        aria-label={c.label}
                        style={{ minWidth: c.width || 90 }}
                        value={row[c.key] ?? ''}
                        onChange={(e) => onChangeRow(i, c.key, e.target.value)}
                      />
                    )}
                  </td>
                ))}
                <td><button type="button" className="btn btn-small btn-danger" onClick={() => onRemoveRow(i)} aria-label={t('f.removeRow')}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn btn-secondary btn-small" style={{ marginTop: 8 }} onClick={onAddRow}>{t('f.addRow')}</button>
    </div>
  );
}

// Fixed row labels (e.g. 17 named beverage items, or cleaning tasks),
// each with several editable data columns. `na` on a row lists column
// keys that don't apply to that row (rendered as "N/A" — e.g. a cleaning
// task that's only done at open and close, never mid-shift).
export function FixedRowDataTable({ rows, columns, values, onChange }) {
  const t = useT();
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr><th>{t('f.col.item')}</th>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
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
                      {isNA ? t('f.na') : c.type === 'checkbox' ? (
                        <input type="checkbox" aria-label={`${row.label} — ${c.label}`} checked={!!v[c.key]} onChange={(e) => onChange(row.key, c.key, e.target.checked)} />
                      ) : (
                        <input
                          type={c.type || 'text'}
                          aria-label={`${row.label} — ${c.label}`}
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
    </div>
  );
}

export function FixedRowStatusTable({ rows, values, onChange, statusOptions, statusLabel }) {
  const t = useT();
  return (
    <div className="table-scroll">
      <table>
        <thead><tr><th>{t('f.col.item')}</th><th>{statusLabel || t('f.col.status')}</th><th>{t('f.col.note')}</th></tr></thead>
        <tbody>
          {rows.map((row) => {
            const v = values[row.key] || {};
            return (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td>
                  <select aria-label={`${row.label} — ${statusLabel || t('f.col.status')}`} value={v.status || statusOptions[0].value} onChange={(e) => onChange(row.key, 'status', e.target.value)}>
                    {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td><input aria-label={`${row.label} — ${t('f.col.note')}`} value={v.note || ''} onChange={(e) => onChange(row.key, 'note', e.target.value)} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Choice options for a dropdown, labelled from the shared value list.
export const choiceOptions = (t, values) => values.map((v) => ({ value: v, label: t(`f.v.${v}`) }));

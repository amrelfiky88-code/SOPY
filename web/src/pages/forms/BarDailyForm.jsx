import React from 'react';
import DailyOpsForm from './DailyOpsForm.jsx';

const OPENING = [
  'Draft lines cleaned and pressure checked',
  'Bar fridges at safe temperature',
  'Glassware clean and inspected',
  'Cash drawer counted',
];
const CLOSING = [
  'Bottles and kegs logged for stock count',
  'Bar surfaces cleaned and sanitized',
  'Draft lines flushed if required',
  'Cash drawer reconciled',
];

export default function BarDailyForm() {
  return <DailyOpsForm kind="bar_daily" title="Bar & Beverage Daily Operation Report" openingTasks={OPENING} closingTasks={CLOSING} />;
}

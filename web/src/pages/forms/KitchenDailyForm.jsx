import React from 'react';
import DailyOpsForm from './DailyOpsForm.jsx';

const OPENING = [
  'Fridges and freezers at safe temperature',
  'Hand-wash stations stocked',
  'Prep surfaces cleaned and sanitized',
  'Stock rotation (FIFO) checked',
];
const CLOSING = [
  'All food stored, labelled, and dated',
  'Equipment turned off and cleaned',
  'Waste bins emptied',
  'Final temperature check logged',
];

export default function KitchenDailyForm() {
  return <DailyOpsForm kind="kitchen_daily" title="Kitchen Daily Operation Report" openingTasks={OPENING} closingTasks={CLOSING} />;
}

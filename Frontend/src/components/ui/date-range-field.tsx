import { CalendarDays } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { Modal } from './modal';
import 'react-day-picker/style.css';
import './schedule-date-time.css';

const pad = (value: number) => String(value).padStart(2, '0');
const localDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const dateLabel = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function DateRangeField({ value, disabled = false, onChange }: { value: { startDate: string; endDate: string }; disabled?: boolean; onChange: (value: { startDate: string; endDate: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange>();
  const from = range?.from;
  const to = range?.to;
  const label = value.startDate === value.endDate
    ? dateLabel.format(parseDate(value.startDate))
    : `${dateLabel.format(parseDate(value.startDate))} - ${dateLabel.format(parseDate(value.endDate))}`;
  function show() {
    const selected = { from: parseDate(value.startDate), to: parseDate(value.endDate) };
    setRange(selected); setOpen(true);
  }
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  return <div className="date-range-field">
    <button type="button" className="schedule-field__trigger date-range-field__trigger" disabled={disabled} aria-haspopup="dialog" onClick={show}>
      <span><CalendarDays size={17} /><span><small>Custom range</small><strong>{label}</strong></span></span>
    </button>
    {open && <Modal title="Custom range" onClose={() => setOpen(false)}>
      <div className="schedule-dialog date-range-dialog">
        <DayPicker mode="range" selected={range} onSelect={setRange} defaultMonth={from} showOutsideDays fixedWeeks />
        <div className="schedule-dialog__summary" aria-live="polite">{from && to ? `${dateLabel.format(from)} - ${dateLabel.format(to)}` : 'Select a start and end date'}</div>
        <footer><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="shared-modal__primary" disabled={!from || !to} onClick={() => { if (!from || !to) return; onChange({ startDate: localDate(from), endDate: localDate(to) }); setOpen(false); }}>Apply</button></footer>
      </div>
    </Modal>}
  </div>;
}

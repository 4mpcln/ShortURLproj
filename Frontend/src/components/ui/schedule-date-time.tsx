import { CalendarDays, Clock3 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { HelpTooltip } from './help-tooltip';
import { Modal } from './modal';
import 'react-day-picker/style.css';
import './schedule-date-time.css';

const pad = (value: number) => String(value).padStart(2, '0');
const localDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const dateLabel = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function TimeWheel({ label, value, count, onChange }: { label: string; value: number; count: number; onChange: (value: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const scrolling = useRef(false);
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  const id = useId();
  useEffect(() => {
    const element = ref.current;
    if (element && !scrolling.current && Math.abs(element.scrollTop - value * 40) > 1) element.scrollTop = value * 40;
  }, [value]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const choose = (next: number) => {
    clearTimeout(timer.current);
    scrolling.current = false;
    const bounded = Math.max(0, Math.min(count - 1, next));
    ref.current?.scrollTo({ top: bounded * 40, behavior: 'instant' });
    latest.current.onChange(bounded);
  };
  return <div className="time-wheel-column"><span>{label}</span><div className="time-wheel-column__scroll" ref={ref} role="listbox" tabIndex={0}
    aria-label={label} aria-activedescendant={`${id}-${value}`}
    onKeyDown={event => {
      const next = event.key === 'ArrowDown' ? value + 1 : event.key === 'ArrowUp' ? value - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : null;
      if (next !== null) { event.preventDefault(); choose(next); }
    }}
    onScroll={() => {
      clearTimeout(timer.current);
      scrolling.current = true;
      const next = Math.max(0, Math.min(count - 1, Math.round((ref.current?.scrollTop ?? 0) / 40)));
      if (next !== latest.current.value) latest.current.onChange(next);
      timer.current = setTimeout(() => {
        scrolling.current = false;
        ref.current?.scrollTo({ top: next * 40, behavior: 'instant' });
      }, 120);
    }}>
    {Array.from({ length: count }, (_, index) => <div id={`${id}-${index}`} key={index} role="option" aria-selected={value === index} onClick={() => choose(index)}>{pad(index)}</div>)}
  </div></div>;
}

export function ScheduleDateTimeField({ label, helpText, value, min, disabled = false, onChange }: { label: string; helpText?: string; value: string; min?: string; disabled?: boolean; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date>();
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [month, setMonth] = useState(new Date());
  const draft = date ? `${localDate(date)}T${pad(hour)}:${pad(minute)}` : '';
  const invalid = Boolean(min && draft && draft <= min);
  const minDate = min ? new Date(`${min.slice(0, 10)}T00:00`) : undefined;
  function show() {
    const selected = value ? new Date(value) : undefined;
    setDate(selected); setMonth(selected || minDate || new Date());
    setHour(selected?.getHours() ?? 9); setMinute(selected?.getMinutes() ?? 0); setOpen(true);
  }
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  return <div className="schedule-field">
    <div className="schedule-field__heading"><span className="schedule-field__label">{label}{helpText && <HelpTooltip label={`${label} help`} text={helpText} />}</span>{value && <button type="button" disabled={disabled} onClick={() => onChange('')}>Clear</button>}</div>
    <button type="button" className="schedule-field__trigger" disabled={disabled} aria-haspopup="dialog" onClick={show}>
      <span><CalendarDays size={17} /><span><small>Date &amp; time</small><strong>{value ? `${dateLabel.format(new Date(value))} ${value.slice(11, 16)}` : 'Select date and time'}</strong></span></span>
    </button>
    {value && min && value <= min && <p role="alert">Expiry must be after opening time.</p>}
    {open && <Modal title={label} onClose={() => setOpen(false)}>
      <div className="schedule-dialog">
        <DayPicker mode="single" required selected={date} onSelect={setDate} month={month} onMonthChange={setMonth} showOutsideDays fixedWeeks
          disabled={minDate ? { before: minDate } : undefined} />
        <div className="schedule-dialog__time-heading"><span><Clock3 size={16} />Time</span><span>24-hour</span></div>
        <div className="time-wheel"><TimeWheel label="Hours" count={24} value={hour} onChange={setHour} /><span className="time-wheel__colon" aria-hidden="true">:</span><TimeWheel label="Minutes" count={60} value={minute} onChange={setMinute} /></div>
        <div className="schedule-dialog__summary" aria-live="polite">{date ? `${dateLabel.format(date)} at ${pad(hour)}:${pad(minute)}` : 'No date selected'}</div>
        {invalid && <p role="alert">Expiry must be after opening time.</p>}
        <footer><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="shared-modal__primary" disabled={!date || invalid} onClick={() => { onChange(draft); setOpen(false); }}>Apply</button></footer>
      </div>
    </Modal>}
  </div>;
}

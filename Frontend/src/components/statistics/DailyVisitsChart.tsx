import { useState, type CSSProperties, type ReactNode } from 'react';
import type { StatisticsResponseDataDailyItem } from '../../api/generated/shortUrl';
import './statistics.css';

type DailyVisitsChartProps = { daily: StatisticsResponseDataDailyItem[]; actions?: ReactNode };
const dateLabel = (date: string, long = false) => new Date(`${date}T00:00:00+07:00`).toLocaleDateString('en-GB', {
  day: 'numeric', month: long ? 'long' : 'short', ...(long ? { year: 'numeric' } : {}), timeZone: 'Asia/Bangkok',
});

export function DailyVisitsChart({ daily, actions }: DailyVisitsChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const selected = hovered ?? focused;
  const maximum = Math.max(1, ...daily.map(day => day.clicks));
  const step = Math.max(1, Math.ceil(maximum / 4));
  const ceiling = step * 4;
  const day = selected === null ? undefined : daily[selected];
  const labelEvery = Math.max(1, Math.ceil(daily.length / 8));

  return <section className="visits-chart" aria-label="Daily visits chart">
    <div className="visits-chart__heading"><div className="visits-chart__heading-title"><h2>Daily visits</h2><span>Asia/Bangkok</span></div>{actions}</div>
    {!daily.length ? <p className="statistics-empty">No daily data available.</p> : <>
      <div className="visits-chart__scroll">
        <div className="visits-chart__canvas" style={{ '--chart-width': `${Math.max(420, daily.length * 25)}px` } as CSSProperties}>
          <div className="visits-chart__scale" aria-hidden="true">{[4, 3, 2, 1, 0].map(tick => <span key={tick}>{(tick * step).toLocaleString()}</span>)}</div>
          <div className="visits-chart__plot" data-selected={selected !== null} onPointerLeave={() => setHovered(null)}>
            {day && <div className="visits-chart__tooltip" role="status" style={{ left: `clamp(78px, ${(selected! + 0.5) / daily.length * 100}%, calc(100% - 78px))` }}>
              <strong>{dateLabel(day.date, true)}</strong><span><i />{day.clicks.toLocaleString()} visits</span>
            </div>}
            <div className="visits-chart__bars">
              {daily.map((entry, index) => <button key={entry.date} type="button" className="visits-chart__column"
                data-active={selected === index} aria-label={`${dateLabel(entry.date, true)}: ${entry.clicks} visits`}
                tabIndex={index === (focused ?? 0) ? 0 : -1}
                onPointerEnter={() => setHovered(index)} onClick={() => setFocused(index)} onFocus={() => setFocused(index)} onBlur={() => setFocused(null)}
                onKeyDown={event => {
                  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) return;
                  event.preventDefault();
                  if (event.key === 'Escape') { event.currentTarget.blur(); setHovered(null); return; }
                  const next = event.key === 'Home' ? 0 : event.key === 'End' ? daily.length - 1 : Math.max(0, Math.min(daily.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
                  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
                }}>
                <span className="visits-chart__bar" style={{ height: `${entry.clicks / ceiling * 100}%` }} />
                {entry.clicks === 0 && <span className="visits-chart__zero" />}
              </button>)}
            </div>
            <div className="visits-chart__dates" aria-hidden="true">{daily.map((entry, index) => {
              const regularLabel = index % labelEvery === 0 && index < daily.length - 2 || index === daily.length - 1;
              const showLabel = selected === index || regularLabel && (selected === null || Math.abs(index - selected) > 1);
              return <span key={entry.date} data-active={selected === index}>{showLabel && <time dateTime={entry.date}>{dateLabel(entry.date)}</time>}</span>;
            })}</div>
          </div>
        </div>
      </div>
      {!daily.some(entry => entry.clicks) && <p className="visits-chart__empty">No visits in this period.</p>}
    </>}
  </section>;
}

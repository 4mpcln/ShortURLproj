import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import type { StatisticsResponseDataDailyItem } from '../../api/generated/shortUrl';
import { usePageOptions } from '../../lib/usePageOptions';
import { Tooltip } from '../ui/tooltip';
import './statistics.css';

type DailyStatisticsTableProps = { daily: StatisticsResponseDataDailyItem[] };
const PAGE_SIZE = 10;

export function DailyStatisticsTable({ daily }: DailyStatisticsTableProps) {
  const { params, updateOptions } = usePageOptions();
  const sort = params.get('sort') === 'clicks' ? 'clicks' : 'date';
  const ascending = params.get('order') === 'asc';
  const requestedPage = Number(params.get('page'));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage - 1 : 0;
  function setPage(value: number) { updateOptions({ page: String(value + 1) }); }
  const sorted = [...daily].sort((a, b) => ((sort === 'date' ? a.date.localeCompare(b.date) : a.clicks - b.clicks || a.date.localeCompare(b.date))) * (ascending ? 1 : -1));
  const pages = Math.max(1, Math.ceil(daily.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const total = daily.reduce((sum, day) => sum + day.clicks, 0);
  function changeSort(column: 'date' | 'clicks') {
    updateOptions({ sort: column, order: sort === column && !ascending ? 'asc' : 'desc', page: null });
  }
  return <section className="daily-statistics" aria-labelledby="daily-statistics-title">
    <div className="daily-statistics__heading"><h2 id="daily-statistics-title">Daily breakdown</h2><span>Asia/Bangkok</span></div>
    <div className="daily-statistics__scroll" role="region" aria-label="Daily visits table" tabIndex={0}><table>
      <thead><tr>{(['date', 'clicks'] as const).map(column => <th key={column} scope="col" aria-sort={sort === column ? ascending ? 'ascending' : 'descending' : 'none'}>
        <button type="button" onClick={() => changeSort(column)}>{column === 'date' ? 'Date' : 'Visits'}{sort === column && (ascending ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}</button>
      </th>)}<th scope="col">Share</th></tr></thead>
      <tbody>{sorted.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map(day => <tr key={day.date}>
        <td><time dateTime={day.date}>{new Date(`${day.date}T00:00:00+07:00`).toLocaleDateString('en-GB', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' })}</time></td>
        <td>{day.clicks.toLocaleString()}</td><td>{total ? (day.clicks / total * 100).toFixed(1) : '0.0'}%</td>
      </tr>)}{!daily.length && <tr><td colSpan={3}>No daily data available.</td></tr>}</tbody>
      <tfoot><tr><th scope="row">Period total</th><td>{total.toLocaleString()}</td><td>{total ? '100%' : '0%'}</td></tr></tfoot>
    </table></div>
    <div className="daily-statistics__pagination"><span>{daily.length ? `${currentPage * PAGE_SIZE + 1}-${Math.min((currentPage + 1) * PAGE_SIZE, daily.length)} of ${daily.length} days` : '0 days'}</span><div>
      <Tooltip text="Previous page"><button type="button" aria-label="Previous page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={17} /></button></Tooltip>
      <Tooltip text="Next page"><button type="button" aria-label="Next page" disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight size={17} /></button></Tooltip>
    </div></div>
  </section>;
}

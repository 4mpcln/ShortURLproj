import { ChevronDown, ChevronLeft, Link2, Pencil, Pin, PinOff, Power, QrCode } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getShortURLAPI, type ShortUrl, type StatisticsResponse } from '../api/generated/shortUrl';
import { useAuth } from '../auth/AuthContext';
import { libraryError } from '../components/LinkOrganization';
import { DailyVisitsChart } from '../components/statistics/DailyVisitsChart';
import { DailyStatisticsTable } from '../components/statistics/DailyStatisticsTable';
import { StatisticsExportButtons } from '../components/statistics/StatisticsExportButtons';
import { StatisticsPdfModal } from '../components/statistics/StatisticsPdfModal';
import { HoldToDeleteButton } from '../components/ui/hold-to-delete-button';
import { LinkEditModal } from '../components/ui/link-edit-modal';
import { Tooltip } from '../components/ui/tooltip';
import { CopyLinkButton, DownloadQrButton } from '../components/ui/link-action-buttons';
import { DateRangeField } from '../components/ui/date-range-field';
import { formatDate } from '../lib/formatDate';
import '../styles/my-links.css';
import { removeRecentShortUrl, updateRecentShortUrl } from '../lib/useRecentShortUrls';
import '../styles/link-statistics.css';
import { getCachedStatistics, invalidateStatistics, loadStatistics, type StatisticsPeriod } from '../lib/statisticsCache';
import { createStatisticsCsv, downloadStatisticsFile } from '../lib/statisticsExport';

const api = getShortURLAPI();
const PERIOD_OPTIONS = [7, 15, 30, 45, 60] as const;
const pad = (value: number) => String(value).padStart(2, '0');
const localDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const bangkokDate = () => {
  const [year, month, day] = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }).split('-').map(Number);
  return new Date(year, month - 1, day);
};
const defaultRange = () => {
  const end = bangkokDate();
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  return { startDate: localDate(start), endDate: localDate(end) };
};

export function LinkStatisticsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading, openAuth } = useAuth();
  const [data, setData] = useState<StatisticsResponse['data'] | null>(null);
  const [days, setDays] = useState(30);
  const [periodMode, setPeriodMode] = useState<'preset' | 'custom'>('preset');
  const [customRange, setCustomRange] = useState(defaultRange);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [mutating, setMutating] = useState(false);
  const [editing, setEditing] = useState<ShortUrl | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const mutation = useRef(false);
  const scope = useRef<string | null>(null);
  const period: StatisticsPeriod = periodMode === 'custom' ? customRange : { days };
  const periodKey = 'days' in period ? `days:${period.days}` : `range:${period.startDate}:${period.endDate}`;
  const periodLabel = 'days' in period ? `Last ${period.days} days` : `${period.startDate} - ${period.endDate}`;
  useLayoutEffect(() => {
    scope.current = user && id ? `${user.id}:${id}` : null;
    setEditing(null); setPdfOpen(false); setActionMessage('');
    return () => { scope.current = null; };
  }, [user?.id, id]);
  useEffect(() => {
    setData(null); setError(''); setBusy(false);
    if (!user || !id) return;
    const cached = getCachedStatistics(user.id, id, period);
    setData(cached);
    let active = true; setBusy(!cached);
    loadStatistics(user.id, id, period).then(response => { if (active) setData(response); }).catch(err => { if (active) setError(libraryError(err)); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [user, id, periodKey]);
  function updateItem(item: ShortUrl) {
    setData(current => current?.item.id === item.id ? { ...current, item } : current);
  }
  async function manage(action: 'pin' | 'enabled' | 'delete') {
    if (!data || !user || mutation.current) return;
    const item = data.item;
    const owner = user.id;
    const currentScope = `${owner}:${item.id}`;
    if (scope.current !== currentScope) return;
    mutation.current = true; setMutating(true); setActionMessage('');
    try {
      if (action === 'delete') {
        await api.deleteLink(item.id);
        invalidateStatistics(owner, item.id);
        removeRecentShortUrl(owner, item.id);
        if (scope.current === currentScope) navigate('/my-links', { replace: true });
      } else if (action === 'pin') {
        const response = await api.pinLink(item.id, { isPinned: !item.isPinned });
        invalidateStatistics(owner, item.id);
        if (scope.current === currentScope) {
          updateItem({ ...item, isPinned: response.data.isPinned });
          setActionMessage(response.data.isPinned ? 'Item pinned.' : 'Item unpinned.');
        }
      } else {
        const response = await api.updateLink(item.id, { isEnabled: !item.isEnabled });
        invalidateStatistics(owner, item.id);
        if (scope.current === currentScope) {
          updateItem(response.data);
          setActionMessage(response.data.isEnabled ? 'Link enabled.' : 'Link disabled.');
        }
      }
    } catch (err) { if (scope.current === currentScope) setActionMessage(libraryError(err)); }
    finally { mutation.current = false; setMutating(false); }
  }
  const item = data?.item;
  const disabled = mutating || editing !== null || pdfOpen;
  return <main className="my-links-page link-statistics-page">
    <header className="statistics-heading">
      <div className="statistics-heading__title"><Link className="library-back" to="/my-links"><ChevronLeft size={17} aria-hidden="true" />back</Link><h1 title={item?.title || item?.code}>{item?.title || item?.code || 'Statistics'}</h1>{item && <div className="statistics-heading__badges"><Tooltip text={item.kind === 'qr' ? 'QR code' : 'URL'}><span className={`library-kind library-kind--${item.kind}`} role="img" aria-label={item.kind === 'qr' ? 'QR code' : 'URL'}>{item.kind === 'qr' ? <QrCode size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}</span></Tooltip><span className={`library-status library-status--${item.status}`}>{item.status}</span></div>}</div>
      {user && <div className="statistics-heading__period">{item && <span className="statistics-created">Created <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString('en-GB', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' })}</time></span>}<select aria-label="Statistics period" disabled={disabled || busy} value={periodMode === 'custom' ? 'custom' : String(days)} onChange={event => { if (event.target.value === 'custom') setPeriodMode('custom'); else { setDays(Number(event.target.value)); setPeriodMode('preset'); } }}>{PERIOD_OPTIONS.map(option => <option key={option} value={option}>Last {option} days</option>)}<option value="custom">Custom</option></select>{periodMode === 'custom' && <DateRangeField value={customRange} disabled={disabled || busy} onChange={setCustomRange} />}</div>}
    </header>
    {loading || busy ? <p role="status">Loading statistics...</p> : !user ? <><p>Log in to view statistics.</p><button onClick={() => openAuth('login')}>Log in</button></> : error ? <p role="alert">{error}</p> : data && <>
      <div className="statistics-toolbar">
        <div className="statistics-toolbar__actions" role="group" aria-label="Manage this item">
          <CopyLinkButton url={data.item.shortUrl} disabled={disabled} onCopy={async url => { try { await navigator.clipboard.writeText(url); setActionMessage('Copied short URL.'); } catch { setActionMessage('Could not copy the link.'); } }} />
          <DownloadQrButton item={data.item} disabled={disabled} onMessage={setActionMessage} />
          <span className="statistics-toolbar__separator" aria-hidden="true" />
          <Tooltip text={data.item.isPinned ? 'Unpin item' : 'Pin to top'}><button type="button" aria-label={data.item.isPinned ? 'Unpin item' : 'Pin item'} aria-pressed={data.item.isPinned} disabled={disabled} onClick={() => manage('pin')}>{data.item.isPinned ? <PinOff size={18} /> : <Pin size={18} />}</button></Tooltip>
          <Tooltip text="Edit item"><button type="button" aria-label="Edit item" disabled={disabled} onClick={() => setEditing(data.item)}><Pencil size={18} /></button></Tooltip>
          <Tooltip text={data.item.isEnabled ? 'Disable link' : 'Enable link'}><button type="button" aria-label={data.item.isEnabled ? 'Disable link' : 'Enable link'} aria-pressed={!data.item.isEnabled} disabled={disabled} onClick={() => manage('enabled')}><Power size={18} /></button></Tooltip>
          <HoldToDeleteButton label={`Delete ${data.item.code}`} disabled={disabled} onDelete={() => manage('delete')} />
        </div>
      </div>
      <div className="statistics-layout"><div className="statistics-details" data-expanded={detailsOpen}>
        <button type="button" className="statistics-details-toggle" aria-expanded={detailsOpen} aria-controls="statistics-link-details" onClick={() => setDetailsOpen(!detailsOpen)}>Link details<ChevronDown size={16} /></button>
        <div id="statistics-link-details" className="statistics-details__content">
        <dl><dt>Original {data.item.kind === 'qr' ? 'content' : 'URL'}</dt><dd>{data.item.originalUrl}</dd><dt>Short URL</dt><dd><a href={data.item.shortUrl} target="_blank" rel="noreferrer" title={`Open ${data.item.shortUrl}`}>{data.item.shortUrl}</a></dd>
          <div className="statistics-schedule"><div><dt>Opens at</dt><dd>{data.item.startsAt ? formatDate(data.item.startsAt) : 'Immediately'}</dd></div><div><dt>Expires at</dt><dd>{formatDate(data.item.expiresAt)}</dd></div></div>
          <dt>Folder</dt><dd>{data.item.folderName || 'No folder'}</dd></dl>
        <div className="library-tags">{data.item.tags.map(tag => <span key={tag.id} className="library-tag"><i style={{ background: tag.color }} />{tag.name}</span>)}</div>
      </div></div><div className="statistics-chart"><div className="statistics-summary-row"><div className="statistics-totals"><div><span>Total visits</span><strong>{data.item.clickCount.toLocaleString()}</strong></div><div><span>{periodLabel}</span><strong>{data.daily.reduce((sum, day) => sum + day.clicks, 0).toLocaleString()}</strong></div></div><StatisticsExportButtons disabled={disabled} onPdf={() => setPdfOpen(true)} onCsv={() => {
          try { downloadStatisticsFile(createStatisticsCsv(data.daily), `qlean-${data.item.code}-statistics.csv`); setActionMessage('Downloaded daily statistics.'); }
          catch { setActionMessage('Could not download the CSV. Please try again.'); }
        }} /></div>
        <div className="statistics-analysis-scroll" role="region" aria-label="Visits chart and daily breakdown" tabIndex={0}>
        <DailyVisitsChart key={`${id}:${periodKey}`} daily={data.daily} />
        <DailyStatisticsTable key={`${id}:${periodKey}`} daily={data.daily} />
      </div></div></div>
    </>}
    {actionMessage && <p role="status">{actionMessage}</p>}
    {pdfOpen && data && <StatisticsPdfModal data={data} periodLabel={periodLabel} onClose={() => setPdfOpen(false)} />}
    {editing && user && <LinkEditModal key={`${user.id}:${editing.id}`} item={editing} onClose={() => setEditing(null)} onSaved={saved => {
      updateRecentShortUrl(user.id, saved);
      invalidateStatistics(user.id, saved.id);
      if (scope.current !== `${user.id}:${saved.id}`) return;
      updateItem(saved); setEditing(null); setActionMessage('Changes saved.');
    }} />}
  </main>;
}

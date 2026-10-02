import { ArrowLeft, Copy, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { DotType } from 'qr-code-styling';
import { getShortURLAPI, type StatisticsResponse } from '../api/generated/shortUrl';
import { useAuth } from '../auth/AuthContext';
import { libraryError } from '../components/LinkOrganization';
import { formatDate } from './MyLinksPage';
import '../styles/my-links.css';
import { createQrCode } from '../lib/qrCode';
export function LinkStatisticsPage() {
  const { id } = useParams();
  const { user, loading, openAuth } = useAuth();
  const [data, setData] = useState<StatisticsResponse['data'] | null>(null);
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [downloading, setDownloading] = useState(false);
  useEffect(() => {
    setData(null); setError('');
    if (!user || !id) return;
    let active = true; setBusy(true);
    getShortURLAPI().getStatistics(id, { days }).then(response => { if (active) setData(response.data); }).catch(err => { if (active) setError(libraryError(err)); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [user, id, days]);
  async function download() {
    if (!data) return;
    setDownloading(true); setActionMessage('');
    try {
      const options = data.item.qrOptions;
      const qr = createQrCode(data.item.shortUrl, { size: options?.size || 300, style: options?.style as DotType || 'square', color: options?.color || '#161616' });
      await qr.download({ name: `qlean-${data.item.code}`, extension: 'png' });
    } catch { setActionMessage('Could not download QR. Please try again.'); } finally { setDownloading(false); }
  }
  return <main className="my-links-page">
    <Link className="library-back" to="/my-links"><ArrowLeft size={18} />My library</Link>
    {loading || busy ? <p role="status">Loading statistics...</p> : !user ? <><p>Log in to view statistics.</p><button onClick={() => openAuth('login')}>Log in</button></> : error ? <p role="alert">{error}</p> : data && <>
      <div className="my-links-heading"><div><h1>{data.item.title || data.item.code}</h1><span className={`library-kind library-kind--${data.item.kind}`}>{data.item.kind.toUpperCase()}</span></div><select aria-label="Statistics period" value={days} onChange={event => setDays(Number(event.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></div>
      <div className="statistics-layout"><div className="statistics-details">
        <dl><dt>Original {data.item.kind === 'qr' ? 'content' : 'URL'}</dt><dd>{data.item.originalUrl}</dd><dt>Short URL</dt><dd><a href={data.item.shortUrl} target="_blank" rel="noreferrer">{data.item.shortUrl}</a></dd><dt>Status</dt><dd>{data.item.status}</dd><dt>Opens at</dt><dd>{data.item.startsAt ? formatDate(data.item.startsAt) : 'Immediately'}</dd><dt>Expires at</dt><dd>{formatDate(data.item.expiresAt)}</dd><dt>Folder</dt><dd>{data.item.folderName || 'No folder'}</dd></dl>
        <div className="library-tags">{data.item.tags.map(tag => <span key={tag.id} className="library-tag"><i style={{ background: tag.color }} />{tag.name}</span>)}</div>
        <div className="statistics-actions"><button title="Copy short URL" aria-label="Copy short URL" onClick={async () => { try { await navigator.clipboard.writeText(data.item.shortUrl); setActionMessage('Copied short URL.'); } catch { setActionMessage('Could not copy the link.'); } }}><Copy size={18} /></button><button disabled={downloading} onClick={download}><Download size={18} />{downloading ? 'Downloading...' : 'Download QR'}</button></div>
      </div><section className="statistics-chart" aria-label="Daily visits"><div className="statistics-totals"><div><span>Total visits</span><strong>{data.item.clickCount.toLocaleString()}</strong></div><div><span>Last {days} days</span><strong>{data.daily.reduce((sum, day) => sum + day.clicks, 0).toLocaleString()}</strong></div></div>
        <div className="daily-chart">{data.daily.map(day => <div key={day.date} className="daily-chart-column" title={`${day.date}: ${day.clicks} visits`}><div className="daily-chart-bar" style={{ height: `${day.clicks ? Math.max(3, day.clicks / Math.max(1, ...data.daily.map(entry => entry.clicks)) * 100) : 0}%` }} /></div>)}</div>
        <div className="daily-chart-axis"><span>{data.daily[0]?.date}</span><span>{data.daily[data.daily.length - 1]?.date}</span></div>
        {!data.daily.some(day => day.clicks) && <p>No visits in this period.</p>}
        <details className="statistics-table"><summary>Daily breakdown · Asia/Bangkok</summary><table><thead><tr><th>Date</th><th>Visits</th></tr></thead><tbody>{data.daily.map(day => <tr key={day.date}><td>{day.date}</td><td>{day.clicks}</td></tr>)}</tbody></table></details>
      </section></div>
    </>}
    {actionMessage && <p role="status">{actionMessage}</p>}
  </main>;
}

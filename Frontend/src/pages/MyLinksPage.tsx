import { BarChart3, CalendarClock, Copy, Folder, Link2, Pin, PinOff, QrCode, RefreshCw, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getShortURLAPI, type ShortUrl } from '../api/generated/shortUrl';
import { useAuth } from '../auth/AuthContext';
import { libraryError } from '../components/LinkOrganization';
import '../styles/my-links.css';
const api = getShortURLAPI();
export const formatDate = (date: string | null) => date ? new Date(date).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'No expire date';
export function MyLinksPage() {
  const { user, loading, openAuth } = useAuth();
  const [items, setItems] = useState<ShortUrl[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');
  const [folder, setFolder] = useState('all');
  const [tag, setTag] = useState('all');
  const [pinning, setPinning] = useState<string | null>(null);
  useEffect(() => {
    setItems([]); setMessage(''); setQuery(''); setFolder('all'); setTag('all');
    if (!user) return;
    let active = true; setBusy(true);
    api.listMyLinks().then(response => { if (active) setItems(response.data); })
      .catch(err => { if (active) setMessage(libraryError(err)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [user, refresh]);
  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => setItems(current => current.map(item => ({ ...item, status: item.expiresAt && new Date(item.expiresAt) <= new Date() ? 'expired' : item.startsAt && new Date(item.startsAt) > new Date() ? 'scheduled' : 'active' }))), 1000);
    return () => window.clearInterval(timer);
  }, [user]);
  async function pin(item: ShortUrl) {
    setPinning(item.id); setMessage('');
    try {
      await api.pinLink(item.id, { isPinned: !item.isPinned });
      setItems(current => current.map(row => row.id === item.id ? { ...row, isPinned: !row.isPinned } : row));
    } catch (error) { setMessage(libraryError(error)); } finally { setPinning(null); }
  }
  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); setMessage('Copied short URL.'); } catch { setMessage('Could not copy the link.'); }
  }
  const folders = [...new Map(items.filter(item => item.folderId).map(item => [item.folderId!, item.folderName!])).entries()];
  const tags = [...new Map(items.flatMap(item => item.tags.map(entry => [entry.id, entry.name] as const))).entries()];
  const visible = items.filter(item => (kind === 'all' || item.kind === kind) && (status === 'all' || item.status === status) && (folder === 'all' || item.folderId === folder) && (tag === 'all' || item.tags.some(entry => entry.id === tag)) && [item.originalUrl,item.shortUrl,item.title || '',...item.tags.map(entry => entry.name)].join(' ').toLowerCase().includes(query.toLowerCase()))
    .sort((a,b) => Number(b.isPinned) - Number(a.isPinned) || b.createdAt.localeCompare(a.createdAt));
  return <main className="my-links-page">
    <div className="my-links-heading"><div><h1>My library</h1><p>{items.length} saved links &amp; QR codes</p></div>{user && <button type="button" aria-label="Refresh library" title="Refresh library" disabled={busy} onClick={() => setRefresh(refresh + 1)}><RefreshCw size={18} className={busy ? 'spin' : ''} /></button>}</div>
    {loading ? <p>Loading...</p> : !user ? <div><p>Log in to view your library.</p><button type="button" onClick={() => openAuth('login')}>Log in</button></div> : <>
      <div className="library-filters">
        <label className="library-search"><Search size={18} /><input aria-label="Search library" placeholder="Search links, titles or tags" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <select aria-label="Item type" value={kind} onChange={event => setKind(event.target.value)}><option value="all">URL &amp; QR</option><option value="url">URL</option><option value="qr">QR</option></select>
        <select aria-label="Status" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="scheduled">Scheduled</option><option value="expired">Expired</option></select>
        <select aria-label="Folder filter" value={folder} onChange={event => setFolder(event.target.value)}><option value="all">All folders</option>{folders.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select>
        <select aria-label="Tag filter" value={tag} onChange={event => setTag(event.target.value)}><option value="all">All tags</option>{tags.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select>
      </div>
      {busy ? <p role="status">Loading library...</p> : !visible.length ? <div className="library-empty"><Link2 size={36} strokeWidth={1} /><p>{items.length ? 'No matching items.' : 'No saved links or QR codes yet.'}</p><Link to="/shortenurl">Create a link</Link></div> : <div className="library-grid">
        {visible.map(item => <article className="library-item" key={item.id}>
          <div className="library-item-top"><span className={`library-kind library-kind--${item.kind}`}>{item.kind === 'qr' ? <QrCode size={16} /> : <Link2 size={16} />}{item.kind.toUpperCase()}</span><span className={`library-status library-status--${item.status}`}>{item.status}</span><button type="button" title={item.isPinned ? 'Unpin item' : 'Pin item'} aria-label={`${item.isPinned ? 'Unpin' : 'Pin'} ${item.code}`} aria-pressed={item.isPinned} disabled={pinning !== null} onClick={() => pin(item)}>{item.isPinned ? <PinOff size={18} /> : <Pin size={18} />}</button></div>
          <h2>{item.title || item.code}</h2>
          <dl><dt>Original {item.kind === 'qr' ? 'content' : 'URL'}</dt><dd className="library-original">{item.originalUrl}</dd><dt>Short URL</dt><dd><a href={item.shortUrl} target="_blank" rel="noreferrer">{item.shortUrl}</a></dd></dl>
          <div className="library-tags">{item.tags.map(entry => <span className="library-tag" key={entry.id}><i style={{ background: entry.color }} />{entry.name}</span>)}</div>
          {item.folderName && <p className="library-meta"><Folder size={16} />{item.folderName}</p>}
          {item.startsAt && <p className="library-meta"><CalendarClock size={16} />Opens {formatDate(item.startsAt)}</p>}
          <p className="library-meta"><CalendarClock size={16} />{item.expiresAt ? `Expires ${formatDate(item.expiresAt)}` : 'No expiry date'}</p>
          <div className="library-actions"><span>{item.clickCount.toLocaleString()} visits</span><button type="button" title="Copy short URL" aria-label={`Copy ${item.code}`} onClick={() => copy(item.shortUrl)}><Copy size={18} /></button><Link to={`/my-links/${item.id}`}><BarChart3 size={18} />Statistics</Link></div>
        </article>)}
      </div>}
    </>}
    {message && <p role="status">{message}</p>}
  </main>;
}

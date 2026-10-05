import { Link2, RefreshCw, Search } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getShortURLAPI, type ShortUrl } from '../api/generated/shortUrl';
import { useAuth } from '../auth/AuthContext';
import { libraryError } from '../components/LinkOrganization';
import { MyLibraryCard } from '../components/MyLibraryCard';
import { LinkEditModal } from '../components/ui/link-edit-modal';
import { Tooltip } from '../components/ui/tooltip';
import { matchesLibraryQuery } from '../lib/librarySearch';
import { invalidateStatistics } from '../lib/statisticsCache';
import { removeRecentShortUrl, updateRecentShortUrl } from '../lib/useRecentShortUrls';
import '../styles/my-links.css';
const api = getShortURLAPI();
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
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ owner: string; item: ShortUrl } | null>(null);
  const mutation = useRef(false);
  const account = useRef<string | null>(user?.id || null);
  useLayoutEffect(() => {
    account.current = user?.id || null;
    setEditing(null); setDeleting(null); setPinning(null); setToggling(null);
    return () => { account.current = null; };
  }, [user?.id]);
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
    const timer = window.setInterval(() => setItems(current => current.map(item => ({ ...item, status: !item.isEnabled ? 'disabled' : item.expiresAt && new Date(item.expiresAt) <= new Date() ? 'expired' : item.startsAt && new Date(item.startsAt) > new Date() ? 'scheduled' : 'active' }))), 1000);
    return () => window.clearInterval(timer);
  }, [user]);
  async function pin(item: ShortUrl) {
    if (!user || mutation.current) return;
    const owner = user.id;
    mutation.current = true;
    setPinning(item.id); setMessage('');
    try {
      await api.pinLink(item.id, { isPinned: !item.isPinned });
      invalidateStatistics(owner, item.id);
      if (account.current === owner) setItems(current => current.map(row => row.id === item.id ? { ...row, isPinned: !row.isPinned } : row));
    } catch (error) { if (account.current === owner) setMessage(libraryError(error)); }
    finally { mutation.current = false; if (account.current === owner) setPinning(null); }
  }
  async function toggleEnabled(item: ShortUrl) {
    if (!user || mutation.current || account.current !== user.id) return;
    const owner = user.id;
    mutation.current = true;
    setToggling(item.id); setMessage('');
    try {
      const { data } = await api.updateLink(item.id, { isEnabled: !item.isEnabled });
      invalidateStatistics(owner, item.id);
      if (account.current === owner) {
        setItems(current => current.map(row => row.id === item.id ? data : row));
        setMessage(data.isEnabled ? 'Link enabled.' : 'Link disabled.');
      }
    } catch (error) { if (account.current === owner) setMessage(libraryError(error)); }
    finally { mutation.current = false; if (account.current === owner) setToggling(null); }
  }
  async function remove(item: ShortUrl) {
    if (!user || mutation.current || account.current !== user.id) return;
    const owner = user.id;
    mutation.current = true;
    setDeleting(item.id); setMessage('');
    try {
      await api.deleteLink(item.id);
      invalidateStatistics(owner, item.id);
      removeRecentShortUrl(owner, item.id);
      if (account.current === owner) {
        setItems(current => current.filter(row => row.id !== item.id));
        setMessage('Item deleted.');
      }
    } catch (error) { if (account.current === owner) setMessage(libraryError(error)); }
    finally { mutation.current = false; if (account.current === owner) setDeleting(null); }
  }
  function saved(owner: string, item: ShortUrl) {
    invalidateStatistics(owner, item.id);
    updateRecentShortUrl(owner, item);
    if (account.current !== owner) return;
    setItems(current => current.map(row => row.id === item.id ? item : row));
    setEditing(null); setMessage('Changes saved.');
  }
  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); setMessage('Copied short URL.'); } catch { setMessage('Could not copy the link.'); }
  }
  function selectTag(value: string) {
    setTag(value);
    setQuery(''); setKind('all'); setStatus('all'); setFolder('all');
  }
  const folders = [...new Map(items.filter(item => item.folderId).map(item => [item.folderId!, item.folderName!])).entries()];
  const tags = [...new Map(items.flatMap(item => item.tags.map(entry => [entry.id, entry.name] as const))).entries()];
  const visible = items.filter(item => (kind === 'all' || item.kind === kind) && (status === 'all' || item.status === status) && (folder === 'all' || item.folderId === folder) && (tag === 'all' || item.tags.some(entry => entry.id === tag)) && matchesLibraryQuery(item, query))
    .sort((a,b) => Number(b.isPinned) - Number(a.isPinned) || b.createdAt.localeCompare(a.createdAt));
  return <main className="my-links-page">
    <div className="my-links-heading"><div><h1>My library</h1><p>{items.length} saved links &amp; QR codes</p></div>{user && <Tooltip text={busy ? 'Refreshing library...' : 'Refresh library'}><button type="button" aria-label="Refresh library" disabled={busy || deleting !== null || pinning !== null || toggling !== null || editing !== null} onClick={() => setRefresh(refresh + 1)}><RefreshCw size={18} className={busy ? 'spin' : ''} /></button></Tooltip>}</div>
    {loading ? <p>Loading...</p> : !user ? <div><p>Log in to view your library.</p><Tooltip text="Log in to view your saved items"><button type="button" onClick={() => openAuth('login')}>Log in</button></Tooltip></div> : <>
      <div className="library-filters">
        <label className="library-search"><Search size={18} /><input aria-label="Search library" placeholder="Search links, titles or tags" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <select aria-label="Item type" value={kind} onChange={event => setKind(event.target.value)}><option value="all">URL &amp; QR</option><option value="url">URL</option><option value="qr">QR</option></select>
        <select aria-label="Status" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="scheduled">Scheduled</option><option value="expired">Expired</option><option value="disabled">Disabled</option></select>
        <select aria-label="Folder filter" value={folder} onChange={event => setFolder(event.target.value)}><option value="all">All folders</option>{folders.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select>
        <select aria-label="Tag filter" value={tag} onChange={event => selectTag(event.target.value)}><option value="all">All tags</option>{tags.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select>
      </div>
      {busy ? <p role="status">Loading library...</p> : !visible.length ? <div className="library-empty"><Link2 size={36} strokeWidth={1} /><p>{items.length ? 'No matching items.' : 'No saved links or QR codes yet.'}</p><Link to="/">Create a link</Link></div> : <div className="library-grid">
        {visible.map(item => <MyLibraryCard key={item.id} item={item} disabled={pinning !== null || deleting !== null || toggling !== null}
          onPin={pin} onToggleEnabled={toggleEnabled} onCopy={copy} onMessage={setMessage} onEdit={item => setEditing({ owner: user.id, item })} onDelete={remove} />)}
      </div>}
    </>}
    {message && <p role="status">{message}</p>}
    {editing && editing.owner === user?.id && <LinkEditModal key={`${editing.owner}:${editing.item.id}`} item={editing.item} onSaved={item => saved(editing.owner, item)} onClose={() => setEditing(null)} />}
  </main>;
}

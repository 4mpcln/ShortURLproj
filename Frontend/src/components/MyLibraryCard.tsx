import { BarChart3, CalendarClock, Folder, Link2, Pin, PinOff, QrCode } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ShortUrl } from '../api/generated/shortUrl';
import { formatDate } from '../lib/formatDate';
import { LibraryActionsMenu } from './LibraryActionsMenu';
import { Tooltip } from './ui/tooltip';
import { CopyLinkButton, DownloadQrButton } from './ui/link-action-buttons';
import '../styles/my-links.css';

export type MyLibraryCardProps = {
  item: ShortUrl;
  disabled?: boolean;
  onPin: (item: ShortUrl) => void;
  onToggleEnabled: (item: ShortUrl) => void;
  onCopy: (url: string) => void;
  onMessage: (message: string) => void;
  onEdit: (item: ShortUrl) => void;
  onDelete: (item: ShortUrl) => Promise<void>;
};

export function MyLibraryCard({ item, disabled = false, onPin, onToggleEnabled, onCopy, onMessage, onEdit, onDelete }: MyLibraryCardProps) {
  const schedule = !item.startsAt && !item.expiresAt ? 'No expire date'
    : `${item.startsAt ? `Opens ${formatDate(item.startsAt)}` : 'Opens immediately'} | ${item.expiresAt ? `Expires ${formatDate(item.expiresAt)}` : 'No expire date'}`;
  return <article className={`library-item${item.isEnabled ? '' : ' library-item--disabled'}`}>
    <div className="library-item-top">
      <span className={`library-kind library-kind--${item.kind}`}>{item.kind === 'qr' ? <QrCode size={16} /> : <Link2 size={16} />}{item.kind.toUpperCase()}</span>
      <time className="library-created" dateTime={item.createdAt}>Created {new Date(item.createdAt).toLocaleDateString('en-GB', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' })}</time>
      <Tooltip text={item.isPinned ? 'Unpin item' : 'Pin to top'}>
        <button type="button" aria-label={`${item.isPinned ? 'Unpin' : 'Pin'} ${item.code}`} aria-pressed={item.isPinned} disabled={disabled} onClick={() => onPin(item)}>{item.isPinned ? <PinOff size={18} /> : <Pin size={18} />}</button>
      </Tooltip>
    </div>
    <div className="library-item-title">
      <h2 title={item.title || item.code}>{item.title || item.code}</h2>
      <span className={`library-status library-status--${item.status}`}>{item.status}</span>
    </div>
    <dl className="library-links">
      <div><dt>Original {item.kind === 'qr' ? 'content' : 'URL'}</dt><dd className="library-original" title={item.originalUrl}>{item.originalUrl}</dd></div>
      <div><dt>Short URL</dt><dd className="library-short-url"><a href={item.shortUrl} target="_blank" rel="noreferrer" title={`Open ${item.shortUrl}`}>{item.shortUrl}</a></dd></div>
    </dl>
    <div className="library-tags" role="group" aria-label="Tags" tabIndex={item.tags.length ? 0 : undefined}>
      {item.tags.length ? item.tags.map(entry => <span className="library-tag" key={entry.id} title={entry.name}><i style={{ background: entry.color }} /><span>{entry.name}</span></span>) : <span className="library-placeholder">No tags</span>}
    </div>
    <div className="library-item-metadata">
      <p className="library-meta"><Folder size={16} /><span title={item.folderName || 'No folder'}>{item.folderName || 'No folder'}</span></p>
      <p className="library-meta library-schedule"><CalendarClock size={16} /><span title={schedule}>{schedule}</span></p>
    </div>
    <div className="library-actions"><span>{item.clickCount.toLocaleString()} visits</span><div className="library-item-tools">
      <CopyLinkButton url={item.shortUrl} disabled={disabled} onCopy={onCopy} />
      <DownloadQrButton item={item} disabled={disabled} onMessage={onMessage} />
      <Tooltip text="View statistics"><Link to={`/my-links/${item.id}`} aria-label="Statistics"><BarChart3 size={18} /></Link></Tooltip>
      <LibraryActionsMenu item={item} disabled={disabled} onEdit={onEdit} onToggleEnabled={onToggleEnabled} onDelete={onDelete} />
    </div></div>
  </article>;
}

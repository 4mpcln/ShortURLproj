import { LoaderCircle, Save, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { getShortURLAPI, type ShortUrl } from '../../api/generated/shortUrl';
import { LinkOrganization, libraryError, metadataPayload, type Metadata } from '../LinkOrganization';
import { Tooltip } from './tooltip';
import './link-edit-modal.css';

const api = getShortURLAPI();
function localDateTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
type LinkEditModalProps = {
  item: ShortUrl;
  onSaved: (item: ShortUrl) => void;
  onClose: () => void;
};

export function LinkEditModal({ item, onSaved, onClose }: LinkEditModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const mounted = useRef(false);
  const saving = useRef(false);
  const id = useId();
  const [title, setTitle] = useState(item.title || '');
  const [content, setContent] = useState(item.originalUrl);
  const [metadata, setMetadata] = useState<Metadata>({ tagIds: item.tags.map(tag => tag.id), folderId: item.folderId || '', startsAt: localDateTime(item.startsAt), expiresAt: localDateTime(item.expiresAt) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    mounted.current = true;
    const element = dialog.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      mounted.current = false;
      element?.close();
      document.body.style.overflow = overflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);

  function close() { if (!saving.current) onClose(); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    setError('');
    try {
      const payload = metadataPayload(metadata);
      // Unchanged minute-resolution controls must not truncate the stored seconds.
      if (metadata.startsAt === localDateTime(item.startsAt)) payload.startsAt = item.startsAt;
      if (metadata.expiresAt === localDateTime(item.expiresAt)) payload.expiresAt = item.expiresAt;
      if (payload.startsAt && payload.expiresAt && new Date(payload.expiresAt) <= new Date(payload.startsAt)) {
        setError('Expiry must be after the opening time.'); return;
      }
      saving.current = true;
      setBusy(true);
      const response = await api.updateLink(item.id, { title: title.trim(), originalUrl: content.trim(), ...payload });
      onSaved(response.data);
    } catch (err) { if (mounted.current) setError(libraryError(err)); }
    finally {
      saving.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return createPortal(<dialog ref={dialog} className="link-edit-modal" aria-labelledby={`${id}-heading`}
    onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    }}>
    <header className="link-edit-modal__header">
      <div><h2 id={`${id}-heading`}>Edit {item.kind === 'qr' ? 'QR code' : 'link'}</h2><p>{item.shortUrl}</p></div>
      <Tooltip text="Close editor"><button type="button" aria-label="Close editor" disabled={busy} onClick={close}><X size={20} /></button></Tooltip>
    </header>
    <form onSubmit={save}>
      <div className="link-edit-modal__fields">
        <div className="link-edit-modal__field"><label htmlFor={`${id}-title`}>Title</label><input id={`${id}-title`} autoFocus maxLength={160} value={title} disabled={busy} onChange={event => setTitle(event.target.value)} /></div>
        <div className="link-edit-modal__field"><label htmlFor={`${id}-content`}>{item.kind === 'qr' ? 'QR content' : 'Destination URL'}</label>
          {item.kind === 'qr' ? <textarea id={`${id}-content`} required maxLength={1000} rows={3} value={content} disabled={busy} onChange={event => setContent(event.target.value)} /> : <input id={`${id}-content`} type="url" required value={content} disabled={busy} onChange={event => setContent(event.target.value)} />}
        </div>
        <LinkOrganization value={metadata} onChange={setMetadata} disabled={busy} />
      </div>
      <footer className="link-edit-modal__footer">
        {error && <p role="alert">{error}</p>}
        <div><Tooltip text="Discard changes and close"><button type="button" disabled={busy} onClick={close}>Cancel</button></Tooltip><Tooltip text={busy ? 'Saving changes...' : !content.trim() ? 'Enter a destination or QR content first' : 'Save changes'}><button type="submit" className="link-edit-modal__save" disabled={busy || !content.trim()}>{busy ? <LoaderCircle size={18} className="spin" /> : <Save size={18} />} {busy ? 'Saving...' : 'Save changes'}</button></Tooltip></div>
      </footer>
    </form>
  </dialog>, document.body);
}

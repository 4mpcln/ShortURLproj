import { FolderPlus, LoaderCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import { getShortURLAPI, type Organization } from '../../api/generated/shortUrl';
import { isAxiosError } from 'axios';
import { Modal } from './modal';

const api = getShortURLAPI();
export function NewFolderModal({ onCreated, onClose }: { onCreated: (folder: Organization['folders'][number]) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  return <Modal title="New folder" busy={busy} onClose={onClose}>
    <form onSubmit={async event => {
      event.preventDefault();
      event.stopPropagation();
      if (pending.current || !name.trim()) return;
      pending.current = true; setBusy(true); setError('');
      try { const { data } = await api.createFolder({ name: name.trim() }); onCreated(data); }
      catch (error) { setError(isAxiosError<{ message?: string }>(error) ? error.response?.data.message || 'Cannot connect to the server. Please try again.' : 'Could not create folder.'); }
      finally { pending.current = false; setBusy(false); }
    }}>
      <label>Folder name<input autoFocus required maxLength={60} placeholder="Folder name" value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>
      {error && <p role="alert">{error}</p>}
      <footer><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="shared-modal__primary" disabled={busy || !name.trim()}>{busy ? <LoaderCircle size={17} className="spin" /> : <FolderPlus size={17} />}{busy ? 'Creating...' : 'Create folder'}</button></footer>
    </form>
  </Modal>;
}

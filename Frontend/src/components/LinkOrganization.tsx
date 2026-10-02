import { Plus, Shuffle } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { isAxiosError } from 'axios';
import { getShortURLAPI, type Organization } from '../api/generated/shortUrl';
import { useAuth } from '../auth/AuthContext';
import '../styles/organization.css';
const api = getShortURLAPI();
export type Metadata = { tagIds: string[]; folderId: string; startsAt: string; expiresAt: string };
export const emptyMetadata: Metadata = { tagIds: [], folderId: '', startsAt: '', expiresAt: '' };
export function metadataPayload(value: Metadata) {
  return { tagIds: value.tagIds, folderId: value.folderId || null, startsAt: value.startsAt ? new Date(value.startsAt).toISOString() : null, expiresAt: value.expiresAt ? new Date(value.expiresAt).toISOString() : null };
}
export function libraryError(error: unknown) {
  return isAxiosError<{ message?: string }>(error) ? error.response?.data.message || 'Cannot connect to the server.' : 'Please try again.';
}
const palette = ['#db2777','#0891b2','#9333ea','#65a30d','#dc2626','#4f46e5','#0d9488','#d97706','#475569'];
export function LinkOrganization({ value, onChange, disabled = false }: { value: Metadata; onChange: (value: Metadata) => void; disabled?: boolean }) {
  const { user } = useAuth();
  const id = useId();
  const [organization, setOrganization] = useState<Organization>({ tags: [], folders: [] });
  const [tagName, setTagName] = useState('');
  const [color, setColor] = useState(palette[0]);
  const [folderName, setFolderName] = useState('');
  const [tagEditor, setTagEditor] = useState(false);
  const [folderEditor, setFolderEditor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    setOrganization({ tags: [], folders: [] });
    if (!user) return;
    let active = true;
    setError('');
    api.getOrganization().then(data => { if (active) setOrganization(data); }).catch(err => { if (active) setError(libraryError(err)); });
    return () => { active = false; };
  }, [user, reload]);
  const used = new Set(organization.tags.map(tag => tag.color));
  function shuffle() {
    const available = palette.filter(item => !used.has(item) && item !== color);
    let next = available[Math.floor(Math.random() * available.length)];
    if (!next) { do { next = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'); } while (used.has(next) || next === color); }
    setColor(next);
  }
  async function create(kind: 'tag' | 'folder') {
    setBusy(true); setError('');
    try {
      if (kind === 'tag') {
        const { data } = await api.createTag({ name: tagName.trim(), color });
        setOrganization(current => ({ ...current, tags: [...current.tags, data] }));
        onChange({ ...value, tagIds: [...value.tagIds, data.id] });
        setTagName(''); setTagEditor(false); shuffle();
      } else {
        const { data } = await api.createFolder({ name: folderName.trim() });
        setOrganization(current => ({ ...current, folders: [...current.folders, data] }));
        onChange({ ...value, folderId: data.id });
        setFolderName(''); setFolderEditor(false);
      }
    } catch (err) { setError(libraryError(err)); } finally { setBusy(false); }
  }
  return <fieldset className="organization" disabled={disabled || busy}>
    <legend>Organization &amp; access</legend>
    <div className="organization-tags"><span>Tags</span><div className="tag-options">
      {organization.tags.map(tag => <button type="button" key={tag.id} aria-pressed={value.tagIds.includes(tag.id)} onClick={() => onChange({ ...value, tagIds: value.tagIds.includes(tag.id) ? value.tagIds.filter(item => item !== tag.id) : [...value.tagIds, tag.id] })}><i style={{ background: tag.color }} />{tag.name}</button>)}
      <button type="button" title="Create tag" aria-label="Create tag" onClick={() => { setTagEditor(!tagEditor); if (used.has(color)) shuffle(); }}><Plus size={17} /></button>
    </div></div>
    {tagEditor && <div className="organization-editor">
      <input aria-label="New tag name" maxLength={40} placeholder="Tag name" value={tagName} onChange={event => setTagName(event.target.value)} />
      <input type="color" aria-label="Tag color" value={color} onChange={event => setColor(event.target.value)} />
      <button type="button" title="Choose unused color" aria-label="Choose unused color" onClick={shuffle}><Shuffle size={18} /></button>
      <button type="button" disabled={!tagName.trim() || used.has(color)} onClick={() => create('tag')}><Plus size={17} /> Add</button>
      {used.has(color) && <span role="status">Color already used</span>}
    </div>}
    <div className="organization-folder"><label htmlFor={`${id}-folder`}>Folder</label><div>
      <select id={`${id}-folder`} value={value.folderId} onChange={event => onChange({ ...value, folderId: event.target.value })}><option value="">No folder</option>{organization.folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>
      <button type="button" title="Create folder" aria-label="Create folder" onClick={() => setFolderEditor(!folderEditor)}><Plus size={18} /></button>
    </div></div>
    {folderEditor && <div className="organization-editor"><input aria-label="New folder name" placeholder="Folder name" maxLength={60} value={folderName} onChange={event => setFolderName(event.target.value)} /><button type="button" disabled={!folderName.trim()} onClick={() => create('folder')}><Plus size={17} /> Add</button></div>}
    <div className="organization-schedule"><label>Opens at<input type="datetime-local" value={value.startsAt} onChange={event => onChange({ ...value, startsAt: event.target.value })} /></label><label>Expires at<input type="datetime-local" min={value.startsAt || undefined} value={value.expiresAt} onChange={event => onChange({ ...value, expiresAt: event.target.value })} /></label></div>
    {error && <p role="alert">{error} <button type="button" onClick={() => setReload(reload + 1)}>Retry</button></p>}
  </fieldset>;
}

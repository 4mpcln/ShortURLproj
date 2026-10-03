import { ChevronDown, MoreHorizontal, Plus, Shuffle } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { isAxiosError } from 'axios';
import { getShortURLAPI, type Organization } from '../api/generated/shortUrl';
import { useAuth } from '../auth/AuthContext';
import { MAX_SELECTED_TAGS, TagPickerModal } from './ui/tag-picker-modal';
import { Tooltip } from './ui/tooltip';
import { NewFolderModal } from './ui/new-folder-modal';
import { ScheduleDateTimeField } from './ui/schedule-date-time';
import { AccessCodeField } from './ui/access-code-field';
import '../styles/organization.css';
const api = getShortURLAPI();
export type Metadata = { tagIds: string[]; folderId: string; startsAt: string; expiresAt: string; accessCode?: string | null };
export const emptyMetadata: Metadata = { tagIds: [], folderId: '', startsAt: '', expiresAt: '', accessCode: null };
export function metadataPayload(value: Metadata) {
  return { tagIds: value.tagIds, folderId: value.folderId || null, startsAt: value.startsAt ? new Date(value.startsAt).toISOString() : null, expiresAt: value.expiresAt ? new Date(value.expiresAt).toISOString() : null, accessCode: value.accessCode };
}
export function libraryError(error: unknown) {
  return isAxiosError<{ message?: string }>(error) ? error.response?.data.message || 'Cannot connect to the server.' : 'Please try again.';
}
const palette = ['#db2777','#0891b2','#9333ea','#65a30d','#dc2626','#4f46e5','#0d9488','#d97706','#475569'];
export function LinkOrganization({ value, onChange, disabled = false, isProtected = false }: { value: Metadata; onChange: (value: Metadata) => void; disabled?: boolean; isProtected?: boolean }) {
  const { user } = useAuth();
  const id = useId();
  const [organization, setOrganization] = useState<Organization>({ tags: [], folders: [] });
  const [tagName, setTagName] = useState('');
  const [color, setColor] = useState(palette[0]);
  const [tagEditor, setTagEditor] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
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
  useEffect(() => { setTagPickerOpen(false); }, [user?.id, disabled]);
  useEffect(() => { setFolderEditor(false); }, [user?.id, disabled]);
  const visibleTags = organization.tags.slice(0, 5);
  const hiddenSelected = organization.tags.slice(5).filter(tag => value.tagIds.includes(tag.id)).length;
  const used = new Set(organization.tags.map(tag => tag.color));
  function shuffle() {
    const available = palette.filter(item => !used.has(item) && item !== color);
    let next = available[Math.floor(Math.random() * available.length)];
    if (!next) { do { next = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'); } while (used.has(next) || next === color); }
    setColor(next);
  }
  async function createTag() {
    setBusy(true); setError('');
    try {
        const { data } = await api.createTag({ name: tagName.trim(), color });
        setOrganization(current => ({ ...current, tags: [...current.tags, data] }));
        if (value.tagIds.length < MAX_SELECTED_TAGS) onChange({ ...value, tagIds: [...value.tagIds, data.id] });
        setTagName(''); setTagEditor(false); shuffle();
    } catch (err) { setError(libraryError(err)); } finally { setBusy(false); }
  }
  return <fieldset className="organization" disabled={disabled || busy}>
    <legend>Organization &amp; access</legend>
    <div className="organization-tags"><span>Tags</span><div className="tag-options">
      {visibleTags.map(tag => <Tooltip key={tag.id} text={value.tagIds.includes(tag.id) ? `Remove ${tag.name} tag` : value.tagIds.length >= MAX_SELECTED_TAGS ? `Select up to ${MAX_SELECTED_TAGS} tags` : `Add ${tag.name} tag`}><button type="button" aria-pressed={value.tagIds.includes(tag.id)} disabled={!value.tagIds.includes(tag.id) && value.tagIds.length >= MAX_SELECTED_TAGS} onClick={() => onChange({ ...value, tagIds: value.tagIds.includes(tag.id) ? value.tagIds.filter(item => item !== tag.id) : [...value.tagIds, tag.id] })}><i style={{ background: tag.color }} />{tag.name}</button></Tooltip>)}
      {organization.tags.length > 5 && <Tooltip text="Browse all tags"><button type="button" aria-haspopup="dialog" aria-controls={`${id}-tag-picker`} onClick={() => setTagPickerOpen(true)}><MoreHorizontal size={17} aria-hidden="true" />Click for more{hiddenSelected ? ` (${hiddenSelected} selected)` : ''}</button></Tooltip>}
      <Tooltip text={tagEditor ? 'Close new tag form' : 'Create a new tag'}><button type="button" aria-label={tagEditor ? 'Close new tag form' : 'Create tag'} aria-expanded={tagEditor} aria-controls={`${id}-tag-editor`} onClick={() => { setTagEditor(!tagEditor); if (used.has(color)) shuffle(); }}>{tagEditor ? <ChevronDown size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}</button></Tooltip>
    </div></div>
    {tagEditor && <div id={`${id}-tag-editor`} className="organization-editor">
      <input aria-label="New tag name" maxLength={40} placeholder="Tag name" value={tagName} onChange={event => setTagName(event.target.value)} />
      <input type="color" aria-label="Tag color" value={color} onChange={event => setColor(event.target.value)} />
      <Tooltip text="Choose an unused tag color"><button type="button" aria-label="Choose unused color" onClick={shuffle}><Shuffle size={18} /></button></Tooltip>
      <Tooltip text={!tagName.trim() ? 'Enter a tag name first' : used.has(color) ? 'Choose an unused color first' : 'Save new tag'}><button type="button" disabled={!tagName.trim() || used.has(color)} onClick={createTag}><Plus size={17} /> Add</button></Tooltip>
      {used.has(color) && <span role="status">Color already used</span>}
    </div>}
    <div className="organization-folder"><label htmlFor={`${id}-folder`}>Folder</label><div>
      <select id={`${id}-folder`} value={value.folderId} onChange={event => onChange({ ...value, folderId: event.target.value })}><option value="">No folder</option>{organization.folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>
      <Tooltip text={folderEditor ? 'Close new folder form' : 'Create a new folder'}><button type="button" aria-label="Create folder" onClick={() => setFolderEditor(!folderEditor)}><Plus size={18} /></button></Tooltip>
    </div></div>
    {folderEditor && <NewFolderModal onClose={() => setFolderEditor(false)} onCreated={folder => {
      setOrganization(current => ({ ...current, folders: [...current.folders, folder] }));
      onChange({ ...value, folderId: folder.id }); setFolderEditor(false);
    }} />}
    <div className="organization-schedule">
      <ScheduleDateTimeField label="Opens at" helpText="The link will start working at this date and time. Before then, visitors see an unavailable page." disabled={disabled || busy} value={value.startsAt} onChange={startsAt => onChange({ ...value, startsAt })} />
      <ScheduleDateTimeField label="Expires at" helpText="The link stops working after this date and time. Leave it empty if it should not expire." disabled={disabled || busy} min={value.startsAt || undefined} value={value.expiresAt} onChange={expiresAt => onChange({ ...value, expiresAt })} />
    </div>
    {user && <AccessCodeField value={value.accessCode} isProtected={isProtected} disabled={disabled || busy} onChange={accessCode => onChange({ ...value, accessCode })} />}
    {error && <p role="alert">{error} <Tooltip text="Reload tags and folders"><button type="button" onClick={() => setReload(reload + 1)}>Retry</button></Tooltip></p>}
    {tagPickerOpen && <TagPickerModal id={`${id}-tag-picker`} tags={organization.tags} selected={value.tagIds} disabled={disabled || busy} onChange={tagIds => onChange({ ...value, tagIds })} onClose={() => setTagPickerOpen(false)} />}
  </fieldset>;
}

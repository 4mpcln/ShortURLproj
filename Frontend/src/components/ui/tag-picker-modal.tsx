import { Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Tag } from '../../api/generated/shortUrl';
import { Tooltip } from './tooltip';
import './tag-picker-modal.css';

export const MAX_SELECTED_TAGS = 20;

type TagPickerModalProps = {
  id: string;
  tags: Tag[];
  selected: string[];
  disabled?: boolean;
  onChange: (selected: string[]) => void;
  onClose: () => void;
};

export function TagPickerModal({ id, tags, selected, disabled = false, onChange, onClose }: TagPickerModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [query, setQuery] = useState('');
  const filtered = tags.filter(tag => tag.name.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    const element = dialog.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);

  return createPortal(<dialog id={id} ref={dialog} className="tag-picker-modal" aria-labelledby={headingId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    <div className="tag-picker-modal__header">
      <div><h2 id={headingId}>Choose tags</h2><p>{selected.length} / {MAX_SELECTED_TAGS} selected</p></div>
      <Tooltip text="Close tag picker"><button type="button" className="tag-picker-modal__close" aria-label="Close tags" onClick={onClose}><X size={20} /></button></Tooltip>
    </div>
    <label className="tag-picker-modal__search"><Search size={18} aria-hidden="true" /><input autoFocus aria-label="Search tags" placeholder="Search tags" value={query} onChange={event => setQuery(event.target.value)} /></label>
    <div className="tag-picker-modal__list">
      {filtered.map(tag => {
        const checked = selected.includes(tag.id);
        return <label key={tag.id} className="tag-picker-modal__tag" data-selected={checked}>
          <input type="checkbox" checked={checked} disabled={disabled || (!checked && selected.length >= MAX_SELECTED_TAGS)} onChange={() => onChange(checked ? selected.filter(value => value !== tag.id) : [...selected, tag.id])} />
          <i style={{ backgroundColor: tag.color }} aria-hidden="true" /><span>{tag.name}</span>
        </label>;
      })}
      {!filtered.length && <p className="tag-picker-modal__empty">No matching tags.</p>}
    </div>
    <div className="tag-picker-modal__footer"><Tooltip text="Use selected tags" className="tag-picker-modal__done"><button type="button" onClick={onClose}>Done</button></Tooltip></div>
  </dialog>, document.body);
}

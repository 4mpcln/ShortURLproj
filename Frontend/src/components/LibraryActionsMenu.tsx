import { MoreHorizontal, Pencil, Power } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ShortUrl } from '../api/generated/shortUrl';
import { HoldToDeleteButton } from './ui/hold-to-delete-button';
import { Tooltip } from './ui/tooltip';

type LibraryActionsMenuProps = {
  item: ShortUrl;
  disabled: boolean;
  onEdit: (item: ShortUrl) => void;
  onToggleEnabled: (item: ShortUrl) => void;
  onDelete: (item: ShortUrl) => Promise<void>;
};

export function LibraryActionsMenu({ item, disabled, onEdit, onToggleEnabled, onDelete }: LibraryActionsMenuProps) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  function close(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  }

  useLayoutEffect(() => {
    if (!open || !trigger.current || !menu.current) return;
    const anchor = trigger.current.getBoundingClientRect();
    const bounds = menu.current.getBoundingClientRect();
    const gap = 8;
    setPosition({
      left: Math.max(gap, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - gap)),
      top: Math.max(gap, anchor.bottom + bounds.height + gap * 2 <= window.innerHeight ? anchor.bottom + gap : anchor.top - bounds.height - gap),
    });
    menu.current.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    const dismiss = () => setOpen(false);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('blur', dismiss);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('blur', dismiss);
    };
  }, [open]);

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

  return <>
    <Tooltip text="More actions"><button ref={trigger} type="button" className={item.isEnabled ? undefined : 'library-menu-trigger--disabled'} aria-label={`More actions for ${item.code}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} disabled={disabled}
      onClick={() => setOpen(current => !current)} onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); }
      }}><MoreHorizontal size={18} /></button></Tooltip>
    {open && createPortal(<div ref={menu} id={id} className="library-card-menu" role="menu" aria-label={`Actions for ${item.code}`} style={position}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}
      onKeyDown={event => {
        if (event.key === 'Escape' || event.key === 'Tab') {
          if (event.key === 'Escape') event.preventDefault();
          close(true); return;
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }}>
      <button type="button" role="menuitem" aria-label={`Edit ${item.code}`} onClick={() => { close(); onEdit(item); }}><Pencil size={18} /><span>Edit</span></button>
      <button type="button" role="menuitem" className={item.isEnabled ? 'library-menu-disable' : 'library-menu-enable'} aria-label={`${item.isEnabled ? 'Disable' : 'Enable'} ${item.code}`} onClick={() => { close(true); onToggleEnabled(item); }}><Power size={18} /><span>{item.isEnabled ? 'Disable' : 'Enable'}</span></button>
      <HoldToDeleteButton label={`Delete ${item.code}`} text="Delete" role="menuitem" disabled={disabled} onDelete={async () => { await onDelete(item); close(true); }} />
    </div>, document.body)}
  </>;
}

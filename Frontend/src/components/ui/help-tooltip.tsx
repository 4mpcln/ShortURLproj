import { CircleHelp } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './help-tooltip.css';

export function HelpTooltip({ label, text }: { label: string; text: string }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 16, top: 0, width: 260 });

  useLayoutEffect(() => {
    if (!open || !button.current || !bubble.current) return;
    const rect = button.current.getBoundingClientRect();
    const hint = bubble.current.getBoundingClientRect();
    const width = Math.min(260, window.innerWidth - 32);
    const gap = 8;
    setPosition({
      left: Math.max(16, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 16)),
      top: Math.max(gap, Math.min(rect.top >= hint.height + gap * 2 ? rect.top - hint.height - gap : rect.bottom + gap, window.innerHeight - hint.height - gap)),
      width,
    });
  }, [open, text]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const outsideClick = (event: PointerEvent) => {
      if (!button.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('pointerdown', outsideClick);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', outsideClick);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  return (
    <span className="help-tooltip">
      <button
        ref={button}
        className="help-tooltip__trigger"
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => { if (document.activeElement !== button.current) setOpen(false); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={event => {
          if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
        }}
      >
        <CircleHelp size={16} aria-hidden="true" />
      </button>
      {open && createPortal(
        <span ref={bubble} id={id} role="tooltip" className="help-tooltip__content" style={position}>{text}</span>,
        button.current?.closest('dialog') || document.body,
      )}
    </span>
  );
}

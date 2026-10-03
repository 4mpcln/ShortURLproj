import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import './tooltip.css';

type TooltipProps = {
  text: string;
  children: ReactElement<{ 'aria-describedby'?: string; title?: string }>;
  className?: string;
};

export function Tooltip({ text, children, className = '' }: TooltipProps) {
  const id = useId();
  const trigger = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<number>();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  function show() {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  }
  function hideSoon() {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 100);
  }
  function hide() {
    window.clearTimeout(closeTimer.current);
    setOpen(false);
  }
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useLayoutEffect(() => {
    if (!open || !trigger.current || !bubble.current) return;
    const anchor = trigger.current.getBoundingClientRect();
    const hint = bubble.current.getBoundingClientRect();
    const gap = 8;
    setPosition({
      left: Math.max(gap, Math.min(anchor.left + (anchor.width - hint.width) / 2, window.innerWidth - hint.width - gap)),
      top: Math.max(gap, Math.min(anchor.top >= hint.height + gap * 2 ? anchor.top - hint.height - gap : anchor.bottom + gap, window.innerHeight - hint.height - gap)),
    });
  }, [open, text]);

  useEffect(() => {
    if (!open) return;
    const close = () => { window.clearTimeout(closeTimer.current); setOpen(false); };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Keep modal hints in the same top layer, outside its scrollable fields.
  const portalRoot = trigger.current?.closest('dialog') || document.body;
  const description = [children.props['aria-describedby'], open ? id : null].filter(Boolean).join(' ') || undefined;
  return <span ref={trigger} className={`ui-tooltip ${className}`}
    onPointerEnter={event => { if (event.pointerType !== 'touch') show(); }} onPointerLeave={hideSoon}
    onPointerMove={event => { if (!open && event.pointerType !== 'touch') show(); }}
    onFocus={show} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) hide(); }}>
    {cloneElement(children, { 'aria-describedby': description, title: undefined })}
    {open && createPortal(<span ref={bubble} id={id} role="tooltip" className="ui-tooltip__content" style={position}
      onPointerEnter={show} onPointerLeave={hideSoon}>{text}</span>, portalRoot)}
  </span>;
}

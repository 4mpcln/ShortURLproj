import { LoaderCircle, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Tooltip } from './tooltip';
import './hold-to-delete-button.css';

type HoldSource = { kind: 'pointer'; id: number } | { kind: 'keyboard'; key: string };
type HoldToDeleteButtonProps = {
  label: string;
  text?: string;
  role?: 'menuitem';
  disabled?: boolean;
  onDelete: () => Promise<void>;
};
const HOLD_DURATION = 800;
const DOUBLE_CLICK_WINDOW = 700;
const CLICK_FILL_DURATION = 160;

export function HoldToDeleteButton({ label, text, role, disabled = false, onDelete }: HoldToDeleteButtonProps) {
  const button = useRef<HTMLButtonElement>(null);
  const source = useRef<HoldSource | null>(null);
  const timer = useRef<number | null>(null);
  const clickTimer = useRef<number | null>(null);
  const deleteTimer = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const mounted = useRef(false);
  const pending = useRef(false);
  const [holding, setHolding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [halfFilled, setHalfFilled] = useState(false);

  const cancel = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    const previous = source.current;
    source.current = null;
    if (previous?.kind === 'pointer' && button.current?.hasPointerCapture(previous.id)) {
      button.current.releasePointerCapture(previous.id);
    }
    if (mounted.current) setHolding(false);
  }, []);

  const resetClicks = useCallback(() => {
    if (clickTimer.current !== null) window.clearTimeout(clickTimer.current);
    clickTimer.current = null;
    if (mounted.current) setHalfFilled(false);
  }, []);

  const resetInteraction = useCallback(() => { cancel(); resetClicks(); }, [cancel, resetClicks]);

  useEffect(() => {
    mounted.current = true;
    const onHidden = () => { if (document.hidden) resetInteraction(); };
    window.addEventListener('blur', resetInteraction);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      mounted.current = false;
      resetInteraction();
      if (deleteTimer.current !== null) window.clearTimeout(deleteTimer.current);
      window.removeEventListener('blur', resetInteraction);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [resetInteraction]);
  useEffect(() => { if (disabled) resetInteraction(); }, [disabled, resetInteraction]);

  function start(nextSource: HoldSource) {
    if (disabled || pending.current || source.current) return;
    source.current = nextSource;
    setHolding(true);
    timer.current = window.setTimeout(() => {
      if (!mounted.current || button.current?.disabled || document.hidden || !source.current) { cancel(); return; }
      suppressClick.current = true;
      deleteNow(false);
    }, HOLD_DURATION);
  }

  function deleteNow(animate: boolean) {
    if (disabled || pending.current) return;
    cancel();
    resetClicks();
    pending.current = true;
    setSubmitting(true);
    // Let the second click visibly fill the remaining half before removing the item.
    deleteTimer.current = window.setTimeout(async () => {
      deleteTimer.current = null;
      try { await onDelete(); }
      finally {
        pending.current = false;
        if (mounted.current) setSubmitting(false);
      }
    }, animate ? CLICK_FILL_DURATION : 0);
  }

  return <Tooltip text="Hold or double click to delete" className="hold-delete">
    <button ref={button} type="button" role={role} className="hold-delete__button" aria-label={label}
      aria-busy={submitting} disabled={disabled || submitting}
      data-holding={holding} data-submitting={submitting} data-half-filled={halfFilled}
      style={{ '--hold-duration': `${HOLD_DURATION}ms`, '--click-fill-duration': `${CLICK_FILL_DURATION}ms`, '--hold-start': halfFilled ? 0.5 : 0 } as CSSProperties}
      onClick={event => {
        event.preventDefault();
        if (event.detail === 0 || suppressClick.current || disabled || pending.current) return;
        if (clickTimer.current !== null) { deleteNow(true); return; }
        setHalfFilled(true);
        clickTimer.current = window.setTimeout(resetClicks, DOUBLE_CLICK_WINDOW);
      }} onContextMenu={event => event.preventDefault()}
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0 || disabled || pending.current || source.current) return;
        suppressClick.current = false;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        start({ kind: 'pointer', id: event.pointerId });
      }}
      onPointerMove={event => {
        if (source.current?.kind !== 'pointer' || source.current.id !== event.pointerId) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) cancel();
      }}
      onPointerUp={event => { if (source.current?.kind === 'pointer' && source.current.id === event.pointerId) cancel(); }}
      onPointerCancel={cancel} onLostPointerCapture={cancel}
      onPointerLeave={() => { if (source.current?.kind === 'pointer') cancel(); }}
      onBlur={resetInteraction}
      onKeyDown={event => {
        if (event.key === 'Escape') { resetInteraction(); return; }
        if (event.key !== ' ' && event.key !== 'Enter') return;
        event.preventDefault();
        if (!event.repeat) start({ kind: 'keyboard', key: event.key });
      }}
      onKeyUp={event => {
        if (event.key === ' ' || event.key === 'Enter') event.preventDefault();
        if (source.current?.kind === 'keyboard' && source.current.key === event.key) cancel();
      }}>
      <span className="hold-delete__fill" aria-hidden="true" />
      {submitting ? <LoaderCircle size={18} className="spin" aria-hidden="true" /> : <Trash2 size={18} aria-hidden="true" />}
      {text && <span className="hold-delete__text">{text}</span>}
    </button>
  </Tooltip>;
}

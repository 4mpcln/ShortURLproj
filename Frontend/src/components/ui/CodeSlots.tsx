import { Check } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ClipboardEvent, type ChangeEvent, type MouseEvent } from 'react';
import { animate, motion, motionValue, useMotionValue, useReducedMotion, useTransform, type MotionValue } from 'motion/react';
import './code-slots.css';

export type CodeSlotsStatus = 'idle' | 'success' | 'error';
export type CodeSlotsProps = {
  length?: number;
  value?: string;
  defaultValue?: string;
  onChange?: (code: string) => void;
  onComplete?: (code: string) => void | Promise<void>;
  status?: CodeSlotsStatus;
  mask?: boolean;
  caret?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  accentColor?: string;
  inkColor?: string;
  slotColor?: string;
  digitColor?: string;
  dangerColor?: string;
  slotSize?: number;
  gap?: number;
  radius?: number;
  bounce?: number;
  settle?: number;
  rise?: number;
  cascade?: number;
  outcome?: 'accept' | 'set';
  ariaLabel?: string;
  className?: string;
};

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const digitsOf = (raw: string) => raw.replace(/\D/g, '');
const toSlots = (raw: string, length: number) => {
  const digits = digitsOf(raw).slice(0, length);
  return Array.from({ length }, (_, index) => digits[index] ?? '');
};
const firstEmptyOf = (slots: string[]) => {
  const index = slots.indexOf('');
  return index === -1 ? slots.length - 1 : index;
};
const isFull = (slots: string[]) => slots.every(Boolean);

export default function CodeSlots({ length = 6, value, defaultValue = '', onChange, onComplete, status = 'idle',
  mask = false, caret = true, disabled = false, autoFocus = false, accentColor, inkColor,
  slotColor, digitColor, dangerColor, slotSize = 44, gap = 8,
  radius = 12, bounce = 0.2, settle = 0.3, rise = 8, cascade = 20, outcome = 'accept',
  ariaLabel = '6-digit access code', className = '' }: CodeSlotsProps) {
  const uid = useId();
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState(() => toSlots(value ?? defaultValue, length));
  const [active, setActive] = useState(() => firstEmptyOf(slots));
  const [focused, setFocused] = useState(false);
  const [veiled, setVeiled] = useState(status === 'success');
  const [draining, setDraining] = useState(false);
  const desiredWidth = length * slotSize + (length - 1) * gap;
  const [rowWidth, setRowWidth] = useState(desiredWidth);
  const actualGap = Math.min(gap, rowWidth / (length * 3));
  const actualSize = Math.max(1, Math.min(slotSize, (rowWidth - actualGap * (length - 1)) / length));
  const height = Math.round(actualSize * 1.18);
  const pitchMv = useMotionValue(actualSize + actualGap);
  const activeMv = useMotionValue(active);
  const openMv = useMotionValue(status === 'success' ? 1 : 0);
  const checkMv = useMotionValue(status === 'success' ? 1 : 0);
  const glide = useRef(new Set<number>());
  const target = useRef<number[]>([]);
  const drainTimer = useRef<ReturnType<typeof setTimeout>>();
  const drainingRef = useRef(false);
  const statusRef = useRef(status);
  const emitted = useRef(digitsOf(value ?? defaultValue).slice(0, length));
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const callbacks = useRef({ onChange, onComplete });
  callbacks.current = { onChange, onComplete };
  const live = useRef({ settle, bounce, cascade, reduce });
  live.current = { settle, bounce, cascade, reduce };
  const { mvs, drops } = useMemo(() => ({
    mvs: Array.from({ length }, (_, index) => motionValue(slotsRef.current[index] ? 1 : 0)),
    drops: Array.from({ length }, () => motionValue(statusRef.current === 'success' ? 1 : 0)),
  }), [length]);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const observer = new ResizeObserver(([entry]) => setRowWidth(entry.contentRect.width));
    observer.observe(row);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { pitchMv.set(actualSize + actualGap); }, [actualSize, actualGap, pitchMv]);

  const drive = useCallback((index: number, to: number, delayMs = 0) => {
    const mv = mvs[index];
    if (!mv) return;
    target.current[index] = to;
    const current = live.current;
    if (current.reduce) mv.jump(to);
    else animate(mv, to, { type: 'spring', duration: current.settle, bounce: current.bounce, delay: delayMs / 1000 });
  }, [mvs]);
  const land = useCallback((index: number, delayMs = 0) => {
    if (mvs[index].get() > 0) mvs[index].jump(0);
    drive(index, 1, delayMs);
  }, [mvs, drive]);
  const moveActive = useCallback((next: number, crossed: number[] = []) => {
    crossed.forEach(index => glide.current.add(index));
    activeMv.jump(next); setActive(next);
  }, [activeMv]);
  const jumpActive = useCallback((next: number) => {
    glide.current.clear(); activeMv.jump(next); setActive(next);
  }, [activeMv]);
  const caretX = useTransform(() => {
    const selected = activeMv.get();
    const pitch = pitchMv.get();
    let x = selected * pitch;
    for (let index = 0; index < mvs.length; index++) {
      const fill = clamp01(mvs[index].get());
      if (!glide.current.has(index)) continue;
      const to = target.current[index];
      if (to === undefined || fill === clamp01(to)) { glide.current.delete(index); continue; }
      x += index < selected ? -(1 - fill) * pitch : fill * pitch;
    }
    return Math.min(Math.max(x, 0), (mvs.length - 1) * pitch);
  });
  const caretTransform = useTransform(caretX, x => `translateX(${x}px)`);
  const washClip = useTransform(openMv, open => `inset(0 ${(1 - clamp01(open)) * 50}% round ${Math.min(radius, actualSize / 2)}px)`);
  const checkTransform = useTransform(checkMv, check => `translateY(${(1 - check) * 8}px) scale(${0.85 + 0.15 * Math.max(check, 0)})`);
  const checkOpacity = useTransform(checkMv, clamp01);
  const commit = useCallback((next: string[]) => {
    const previous = slotsRef.current;
    slotsRef.current = next; setSlots(next);
    const code = next.join('');
    emitted.current = code;
    callbacks.current.onChange?.(code);
    if (isFull(next) && code !== previous.join('')) void callbacks.current.onComplete?.(code);
  }, []);

  const blocked = () => disabled || drainingRef.current || status === 'success';
  function insert(raw: string, from = active) {
    if (blocked()) return;
    const digits = digitsOf(raw);
    if (!digits) return;
    const next = [...slotsRef.current];
    const crossed: number[] = [];
    let index = from;
    for (const digit of digits) {
      if (index >= length) break;
      next[index] = digit; land(index, (index - from) * (reduce ? 0 : cascade));
      crossed.push(index++);
    }
    if (!crossed.length) return;
    commit(next); moveActive(Math.min(index, length - 1), crossed);
  }
  function clearSlot(index: number, stepBack = false) {
    if (!slotsRef.current[index]) { if (stepBack) jumpActive(index); return; }
    const next = [...slotsRef.current]; next[index] = '';
    drive(index, 0); commit(next);
    if (stepBack) moveActive(index, [index]);
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (blocked() || event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key;
    if (/^[0-9]$/.test(key)) { event.preventDefault(); insert(key); }
    else if (key === 'Backspace') {
      event.preventDefault();
      if (slotsRef.current[active]) clearSlot(active);
      else if (active > 0) clearSlot(active - 1, true);
    } else if (key === 'Delete') { event.preventDefault(); clearSlot(active); }
    else if (key === 'ArrowLeft') { event.preventDefault(); jumpActive(Math.max(active - 1, 0)); }
    else if (key === 'ArrowRight') { event.preventDefault(); jumpActive(Math.min(active + 1, length - 1)); }
    else if (key === 'Home') { event.preventDefault(); jumpActive(0); }
    else if (key === 'End') { event.preventDefault(); jumpActive(length - 1); }
  }
  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const digits = digitsOf(event.clipboardData.getData('text'));
    insert(digits, digits.length >= length ? 0 : active);
  }
  function onInput(event: ChangeEvent<HTMLInputElement>) {
    const digits = digitsOf(event.target.value);
    if (digits) insert(digits, digits.length === 1 ? active : 0);
  }
  function onRowMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (disabled) return;
    event.preventDefault();
    const row = rowRef.current;
    if (row && !blocked()) {
      const index = Math.floor((event.clientX - row.getBoundingClientRect().left) / pitchMv.get());
      jumpActive(Math.max(0, Math.min(index, firstEmptyOf(slotsRef.current))));
    }
    inputRef.current?.focus();
  }

  useEffect(() => {
    glide.current.clear(); target.current = [];
    const next = Array.from({ length }, (_, index) => slotsRef.current[index] ?? '');
    slotsRef.current = next; setSlots(next); jumpActive(firstEmptyOf(next));
    const code = next.join('');
    if (code !== emitted.current) { emitted.current = code; callbacks.current.onChange?.(code); }
  }, [length, jumpActive]);
  useEffect(() => {
    if (value === undefined) return;
    const clean = digitsOf(value).slice(0, length);
    if (clean === emitted.current) return;
    emitted.current = clean;
    const previous = slotsRef.current;
    const next = toSlots(clean, length);
    const hidden = statusRef.current === 'success';
    const landing: number[] = [], leaving: number[] = [];
    next.forEach((digit, index) => { if (digit !== previous[index]) (digit ? landing : leaving).push(index); });
    const step = live.current.reduce || hidden ? 0 : live.current.cascade;
    landing.forEach((index, order) => land(index, order * step));
    leaving.reverse().forEach((index, order) => {
      if (hidden) { target.current[index] = 0; mvs[index].jump(0); drops[index].jump(0); }
      else drive(index, 0, order * step);
    });
    slotsRef.current = next; setSlots(next); moveActive(firstEmptyOf(next), [...landing, ...leaving]);
  }, [value, length, land, drive, mvs, drops, moveActive]);
  useEffect(() => {
    const was = statusRef.current;
    statusRef.current = status;
    const current = live.current;
    if (status === 'success') {
      setVeiled(true);
      if (current.reduce) { openMv.jump(1); checkMv.jump(1); drops.forEach(drop => drop.jump(1)); return; }
      animate(openMv, 1, { duration: 0.3, ease: EASE_OUT });
      drops.forEach((drop, index) => animate(drop, 1, { type: 'spring', duration: 0.3, bounce: 0, delay: 0.06 + index * 0.03 }));
      animate(checkMv, 1, { type: 'spring', duration: 0.35, bounce: current.bounce, delay: 0.28 });
    } else if (was === 'success') {
      if (current.reduce) { openMv.jump(0); checkMv.jump(0); drops.forEach(drop => drop.jump(0)); setVeiled(false); return; }
      animate(checkMv, 0, { duration: 0.15, ease: EASE_OUT });
      void animate(openMv, 0, { duration: 0.2, ease: EASE_OUT, delay: 0.06 }).then(() => { if (openMv.get() === 0) setVeiled(false); });
      drops.forEach(drop => animate(drop, 0, { type: 'spring', duration: 0.3, bounce: 0, delay: 0.1 }));
    }
  }, [status, openMv, checkMv, drops]);
  useEffect(() => {
    if (status !== 'error') { drainingRef.current = false; setDraining(false); return; }
    const filled = slotsRef.current.map((digit, index) => digit ? index : -1).filter(index => index >= 0).reverse();
    if (!filled.length) return;
    drainingRef.current = true; setDraining(true);
    const current = live.current;
    const step = current.reduce ? 0 : current.cascade;
    filled.forEach((index, order) => drive(index, 0, order * step));
    moveActive(0, slotsRef.current.map((_, index) => index));
    clearTimeout(drainTimer.current);
    drainTimer.current = setTimeout(() => {
      drainingRef.current = false; setDraining(false);
      commit(Array.from({ length }, () => ''));
    }, current.reduce ? 300 : (filled.length - 1) * step + current.settle * 1000);
    return () => {
      clearTimeout(drainTimer.current);
      drainingRef.current = false;
    };
  }, [status, length, drive, moveActive, commit]);
  useEffect(() => {
    if (status === 'error' && !draining && !disabled) inputRef.current?.focus();
  }, [status, draining, disabled]);
  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);
  useEffect(() => () => { [...mvs, ...drops, openMv, checkMv].forEach(mv => mv.stop()); }, [mvs, drops, openMv, checkMv]);

  const view = Array.from({ length }, (_, index) => slots[index] ?? '');
  const showCaret = caret && focused && !disabled && !veiled && status !== 'success' && (status === 'error' || !view[active]);
  return <div className={`code-slots ${className}`} style={{
    '--cs-accent': accentColor, '--cs-ink': inkColor, '--cs-slot': slotColor, '--cs-digit': digitColor,
    '--cs-danger': dangerColor, '--cs-size': `${actualSize}px`, '--cs-height': `${height}px`,
    '--cs-gap': `${actualGap}px`, '--cs-radius': `${Math.min(radius, actualSize / 2)}px`,
    '--cs-font': `${Math.round(actualSize * 0.5)}px`, '--cs-width': `${desiredWidth}px`,
  } as CSSProperties}>
    <div ref={rowRef} className="code-slots__row" data-status={status} data-focused={focused || undefined}
      data-disabled={disabled || undefined} onMouseDown={onRowMouseDown}>
      <input ref={inputRef} className="code-slots__input" type="text" inputMode="numeric" autoComplete="one-time-code"
        pattern="[0-9]*" value="" maxLength={length} aria-label={ariaLabel} aria-invalid={status === 'error'}
        aria-describedby={`${uid}-count`} disabled={disabled || draining} readOnly={status === 'success'}
        onKeyDown={onKeyDown} onPaste={onPaste} onChange={onInput} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      {view.map((digit, index) => <Slot key={index} mv={mvs[index]} drop={drops[index]} char={mask && digit ? '\u2022' : digit}
        active={focused && index === active} rise={rise} sink={Math.round(height * 0.5)} />)}
      <motion.span className="code-slots__wash" aria-hidden="true" style={{ clipPath: washClip }}>
        <motion.span className="code-slots__check" style={{ transform: checkTransform, opacity: checkOpacity }}>
          <Check size={Math.round(actualSize * 0.6)} strokeWidth={2.2} />
        </motion.span>
      </motion.span>
      <motion.span className="code-slots__caret" aria-hidden="true" data-show={showCaret || undefined} style={{ transform: caretTransform }}>
        <span key={active} />
      </motion.span>
    </div>
    <span id={`${uid}-count`} className="sr-only" aria-live="polite">
      {status === 'success' ? outcome === 'set' ? 'Password set' : 'Code accepted' : `${view.filter(Boolean).length} of ${length} digits entered`}
    </span>
  </div>;
}

function Slot({ mv, drop, char, active, rise, sink }: { mv: MotionValue<number>; drop: MotionValue<number>; char: string; active: boolean; rise: number; sink: number }) {
  const [shown, setShown] = useState(char);
  if (char && char !== shown) setShown(char);
  const fill = useTransform(mv, value => `scale(${Math.max(value, 0)})`);
  const lift = useTransform(() => `translateY(${(1 - mv.get()) * rise + Math.max(drop.get(), 0) * sink}px)`);
  const ink = useTransform(() => clamp01(mv.get()) * (1 - clamp01(drop.get() / 0.6)));
  return <span className="code-slots__slot" data-active={active || undefined} data-filled={Boolean(char) || undefined} aria-hidden="true">
    <motion.span className="code-slots__fill" style={{ transform: fill }} />
    {shown && <motion.span className="code-slots__digit" style={{ transform: lift, opacity: ink }}>{shown}</motion.span>}
  </span>;
}

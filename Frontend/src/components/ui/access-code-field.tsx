import { LockKeyhole, Pencil, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from './modal';
import { HelpTooltip } from './help-tooltip';
import CodeSlots, { type CodeSlotsStatus } from './CodeSlots';
import './access-code.css';

export function AccessCodeField({ value, isProtected = false, disabled = false, onChange }: {
  value?: string | null;
  isProtected?: boolean;
  disabled?: boolean;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<CodeSlotsStatus>('idle');
  const [wasProtected, setWasProtected] = useState(false);
  const enabled = Boolean(value) || (value === undefined && isProtected);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  function confirm(event: FormEvent) {
    event.preventDefault();
    // Portal events still bubble to the URL or QR form in React.
    event.stopPropagation();
    if (status === 'success') setOpen(false);
  }
  return <div className="access-code-field">
    <div className="access-code-field__heading">
      <span className="access-code-field__label">Password</span>
      <span className="access-code-field__optional">Optional</span>
      <HelpTooltip label="Is a password required?" text="Password protection is optional. You can create a URL or QR code without a password. Set a six-digit password only when you want to restrict access." />
    </div>
    <button className="access-code-field__button" type="button" disabled={disabled} aria-pressed={enabled} aria-haspopup="dialog"
      onClick={() => { setDraft(''); setStatus('idle'); setWasProtected(enabled); setOpen(true); }}>
      {enabled ? <ShieldCheck size={18} aria-hidden="true" /> : <LockKeyhole size={18} aria-hidden="true" />}
      <span>{enabled ? 'Password set' : 'Set password'}</span>
      {enabled && <Pencil size={16} aria-hidden="true" />}
    </button>
    {open && <Modal title={wasProtected ? 'Change password' : 'Set password'} onClose={() => setOpen(false)}>
      <form className="access-code-form" onSubmit={confirm}>
        <div className="access-code-entry"><span>6-digit password</span>
          <CodeSlots length={6} value={draft} status={status} autoFocus outcome="set" ariaLabel="6-digit password"
            onChange={code => { setDraft(code); setStatus('idle'); }}
            onComplete={code => { onChange(code); setStatus('success'); }} />
        </div>
        <p className="access-code-status" role="status">{status === 'success' ? 'Password set' : '\u00a0'}</p>
        <footer>{enabled && <button type="button" onClick={() => { onChange(null); setOpen(false); }}>Remove password</button>}
          {status === 'success' ? <>
            <button type="button" onClick={() => { setDraft(''); setStatus('idle'); }}>Edit password</button>
            <button type="submit" className="shared-modal__primary">Done</button>
          </> : <button type="button" onClick={() => setOpen(false)}>Cancel</button>}
        </footer>
      </form>
    </Modal>}
  </div>;
}

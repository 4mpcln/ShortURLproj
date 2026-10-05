import { LockKeyhole } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getShortURLAPI } from '../api/generated/shortUrl';
import { libraryError } from '../components/LinkOrganization';
import { Modal } from '../components/ui/modal';
import CodeSlots, { type CodeSlotsStatus } from '../components/ui/CodeSlots';
import '../components/ui/access-code.css';

const api = getShortURLAPI();
export function LinkAccessPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<CodeSlotsStatus>('idle');
  const [error, setError] = useState('');
  const [content, setContent] = useState<string | null>(null);
  const request = useRef(0);
  const pending = useRef(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    const scope = ++request.current;
    pending.current = false;
    setPin(''); setStatus('idle'); setError(''); setContent(null); setLoading(true); setBusy(false);
    if (!code) { setLoading(false); setError('Link not found.'); return; }
    api.getLinkAccess(encodeURIComponent(code)).then(({ data }) => {
      if (request.current !== scope) return;
      if (data.status !== 'active') navigate(`/link-unavailable/${encodeURIComponent(code)}`, { replace: true });
      else if (!data.hasAccessCode) window.location.replace(data.shortUrl);
    }).catch(err => { if (request.current === scope) setError(libraryError(err)); })
      .finally(() => { if (request.current === scope) setLoading(false); });
    return () => { request.current++; clearTimeout(redirectTimer.current); };
  }, [code]);
  async function unlock(accessCode: string) {
    if (!code || pending.current || loading || status === 'success' || !/^\d{6}$/.test(accessCode)) return;
    const scope = request.current;
    pending.current = true;
    setBusy(true); setError('');
    try {
      const { data } = await api.unlockLink(encodeURIComponent(code), { accessCode });
      if (request.current !== scope) return;
      setStatus('success');
      redirectTimer.current = setTimeout(() => {
        if (request.current !== scope) return;
        if (/^https?:\/\//i.test(data.originalUrl)) window.location.replace(data.originalUrl);
        else { setContent(data.originalUrl); setPin(''); pending.current = false; setBusy(false); }
      }, 1100);
    } catch (err) {
      if (request.current === scope) {
        setError(libraryError(err)); setStatus('error'); pending.current = false; setBusy(false);
      }
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void unlock(pin);
  }
  return <main className="link-access-page"><Modal title={content !== null ? 'QR content' : 'Protected link'} busy={busy}
    onClose={() => navigate('/', { replace: true })}>
    <form className="access-code-form" onSubmit={submit}>
      {content !== null ? <pre>{content}</pre> : <>
        <LockKeyhole size={28} aria-hidden="true" />
        {loading ? <p role="status">Checking this link...</p> : <div className="access-code-entry"><span>6-digit password</span>
          <CodeSlots length={6} value={pin} status={status} autoFocus outcome="accept" ariaLabel="6-digit password"
            disabled={busy && status !== 'success'} onComplete={unlock}
            onChange={value => { setPin(value); if (value) { setStatus('idle'); setError(''); } }} />
        </div>}
        <p className="access-code-status" role="status">{status === 'success' ? 'Code accepted' : busy ? 'Verifying...' : '\u00a0'}</p>
        {error && <p role="alert">{error}</p>}
      </>}
    </form>
  </Modal></main>;
}

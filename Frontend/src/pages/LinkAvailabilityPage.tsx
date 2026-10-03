import { ArrowLeft, CalendarClock, CircleAlert, Clock3, RefreshCw, X } from 'lucide-react';
import { isAxiosError } from 'axios';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getShortURLAPI, type LinkAccessResponse } from '../api/generated/shortUrl';
import { QleanLogo } from '../components/ui/qlean-logo';
import '../styles/link-availability.css';

export function LinkAvailabilityPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const dialog = useRef<HTMLDialogElement>(null);
  const [access, setAccess] = useState<LinkAccessResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'missing' | 'network' | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setAccess(null);
    if (!code) { setError('missing'); setLoading(false); return; }
    getShortURLAPI().getLinkAccess(encodeURIComponent(code)).then(({ data }) => {
      if (!active) return;
      setAccess(data);
      // The redirect endpoint enforces the schedule again and records the visit.
      if (data.status === 'active') window.location.replace(data.shortUrl);
    }).catch(err => {
      if (active) setError(isAxiosError(err) && err.response?.status === 404 ? 'missing' : 'network');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [code, attempt]);

  const expired = access?.status === 'expired';
  const disabled = access?.status === 'disabled';
  const title = loading ? 'Checking this link...'
    : error === 'missing' ? 'Link not found.'
    : error ? 'Unable to check this link.'
    : expired ? 'This link has expired.'
    : disabled ? 'This link is temporarily disabled.'
    : access?.status === 'active' ? 'Your link is ready.'
    : "This link isn't open yet.";
  const description = loading ? 'Please wait a moment.'
    : error === 'missing' ? 'This short link does not exist.'
    : error ? 'The server is unavailable. Please try again.'
    : expired ? 'The access period for this link has ended.'
    : disabled ? 'The owner has paused access to this link.'
    : access?.status === 'active' ? 'Opening your link...'
    : 'This link is scheduled to open at the time below.';

  return <main className="link-availability-page">
    <dialog ref={dialog} className="link-availability-modal" aria-labelledby="link-availability-title" aria-describedby="link-availability-description"
      onCancel={event => { event.preventDefault(); navigate('/shortenurl', { replace: true }); }}>
      <header className="link-availability-heading">
        <span className="link-availability-brand"><QleanLogo variant="compact" /><span className="link-availability-brand-text">Qlean</span></span>
        <Link className="link-availability-close" to="/shortenurl" aria-label="Close" title="Back to Qlean"><X size={20} aria-hidden="true" /></Link>
      </header>
      <div className="link-availability-message" role="status" aria-live="polite" aria-busy={loading}>
        {expired || disabled || error ? <CircleAlert size={36} strokeWidth={1.5} aria-hidden="true" /> : <Clock3 size={36} strokeWidth={1.5} aria-hidden="true" />}
        <h1 id="link-availability-title">{title}</h1>
        <p id="link-availability-description">{description}</p>
      </div>
      {!loading && access?.status === 'scheduled' && access.startsAt && <div className="link-availability-opening">
        <CalendarClock size={19} aria-hidden="true" />
        <div><span>Opens at · Asia/Bangkok</span><time dateTime={access.startsAt}>{new Date(access.startsAt).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Bangkok' })}</time></div>
      </div>}
      {code && <p className="link-availability-alias">/{code}</p>}
      <footer className="link-availability-actions">
        <Link to="/shortenurl"><ArrowLeft size={17} aria-hidden="true" />Back to <QleanLogo variant="inline" /><span className="link-availability-brand-text"> Qlean</span></Link>
        {!expired && error !== 'missing' && <button type="button" disabled={loading} onClick={() => setAttempt(current => current + 1)}><RefreshCw size={17} aria-hidden="true" />{loading ? 'Checking...' : 'Check again'}</button>}
      </footer>
    </dialog>
  </main>;
}

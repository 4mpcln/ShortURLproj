import { BarChart3, Bookmark, Eye, EyeOff, Link2, X } from 'lucide-react';
import { isAxiosError } from 'axios';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getShortURLAPI } from '../../api/generated/shortUrl';
import { useAuth } from '../../auth/AuthContext';
import { QleanLogo } from './qlean-logo';
import './auth-modal.css';

const api = getShortURLAPI();

export function AuthModal() {
  const { modal, closeAuth, switchMode, signedIn } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!modal) return;
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
  }, [Boolean(modal)]);

  useEffect(() => { setError(''); setPassword(''); setConfirmation(''); setShowPassword(false); }, [modal]);

  if (!modal) return null;
  const register = modal === 'register';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (register && password !== confirmation) { setError('Passwords do not match.'); return; }
    if (new TextEncoder().encode(password).length > 72) { setError('Password is too long. Use at most 72 UTF-8 bytes.'); return; }
    setBusy(true);
    setError('');
    try {
      const response = register
        ? await api.registerUser({ name: name.trim(), email: email.trim(), password })
        : await api.loginUser({ email: email.trim(), password });
      signedIn(response.data);
    } catch (err) {
      if (isAxiosError<{ message?: string }>(err)) {
        setError(!err.response ? 'Cannot connect to the server. Please try again.'
          : err.response.status === 400 ? 'Check your name, email and password. Use at least 8 characters when registering.'
          : err.response.status >= 500 ? 'The server is unavailable. Please try again shortly.'
          : err.response.data?.message ?? 'Could not sign in. Please try again.');
      } else setError('Could not sign in. Please try again.');
    } finally { setBusy(false); }
  }

  return <dialog ref={dialog} className="auth-modal" aria-labelledby="auth-title" aria-describedby="auth-benefits"
    onCancel={event => { event.preventDefault(); closeAuth(); }}
    onClick={event => { if (event.target === event.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeAuth();
    } }}>
    <div className="auth-modal__content">
      <div className="auth-modal__heading"><span className="auth-brand"><QleanLogo variant="compact" /><span className="auth-brand__text">Qlean</span></span><button type="button" className="auth-close" onClick={closeAuth} aria-label="Close" title="Close"><X size={20} /></button></div>
      <h2 id="auth-title">{register ? 'Create your account' : 'Welcome back'}</h2>
      <div id="auth-benefits" className="auth-benefits">
        <p>Keep your links in one place with a free account.</p>
        <ul>
          <li><Bookmark size={17} aria-hidden="true" />Save links and QR codes to your library</li>
          <li><Link2 size={17} aria-hidden="true" />Organize with tags, folders and access schedules</li>
          <li><BarChart3 size={17} aria-hidden="true" />View click counts and other statistics for each link</li>
        </ul>
      </div>
      <div className="auth-tabs" role="group" aria-label="Account mode">
        <button type="button" aria-pressed={!register} disabled={busy} onClick={() => switchMode('login')}>Log in</button>
        <button type="button" aria-pressed={register} disabled={busy} onClick={() => switchMode('register')}>Register</button>
      </div>
      <form onSubmit={submit}>
        {register && <label>Name<input autoComplete="name" required maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label>}
        <label>Email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></label>
        <div className="auth-password">
          <label htmlFor="auth-password">Password</label>
          <div><input id="auth-password" type={showPassword ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 8 : 1} value={password} onChange={event => setPassword(event.target.value)} />
            <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
        </div>
        {register && <label>Confirm password<input type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={8} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait...' : register ? 'Create account' : 'Log in'}</button>
      </form>
    </div>
    <button className="auth-nevermind" type="button" onClick={closeAuth}>Nevermind</button>
  </dialog>;
}

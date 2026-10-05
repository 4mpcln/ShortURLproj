import { ArrowRight, ChevronDown, Copy, ExternalLink, Link2 } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import '../styles/shortenurl.css';
import { getCreateShortUrlError } from '../api/errors';
import { HelpTooltip } from '../components/ui/help-tooltip';
import { Toast } from '../components/ui/toast';
import { useAuth } from '../auth/AuthContext';
import { LinkOrganization, emptyMetadata, metadataPayload } from '../components/LinkOrganization';
import { useRecentShortUrls } from '../lib/useRecentShortUrls';
import { useOrganizationOptions, usePageOptions } from '../lib/usePageOptions';
import {
  CreateShortUrlRequest,
  createShortUrl,
} from '../api/shortUrlClient';

type FormState = CreateShortUrlRequest;

const initialForm: FormState = {
  originalUrl: '',
  title: '',
  customCode: '',
};

export function ShortenUrlPage() {
  const { user, loading } = useAuth();
  const { recentLinks, historyReady, remember } = useRecentShortUrls(loading ? null : user?.id || 'guest');
  const { params, updateOptions } = usePageOptions();
  const [metadata, setMetadata] = useOrganizationOptions(user?.id);
  const advancedOpen = params.get('advanced') === 'true';
  const [phase, setPhase] = useState<'collapsed' | 'opening' | 'expanded' | 'closing'>(advancedOpen ? 'expanded' : 'collapsed');
  const [hasOpened, setHasOpened] = useState(advancedOpen);
  const expanded = phase === 'expanded' || phase === 'closing';
  const transitioning = phase === 'opening' || phase === 'closing';
  const [form, setForm] = useState<FormState>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  useEffect(() => { setMessage(''); }, [user?.id]);

  useEffect(() => {
    if (advancedOpen) setHasOpened(true);
    setPhase(current => advancedOpen
      ? current === 'expanded' ? current : 'opening'
      : current === 'collapsed' ? current : 'closing');
  }, [advancedOpen]);

  useEffect(() => {
    if (!transitioning) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => setPhase(phase === 'opening' ? 'expanded' : 'collapsed'), reducedMotion ? 0 : 260);
    return () => window.clearTimeout(timer);
  }, [phase, transitioning]);

  const canSubmit = useMemo(() => {
    return form.originalUrl.trim().length > 0 && !isSubmitting && historyReady;
  }, [form.originalUrl, isSubmitting, historyReady]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || transitioning) return;
    setIsSubmitting(true);
    setMessage('');

    try {
      const payload = {
        ...(user && expanded ? metadataPayload(metadata) : {}),
        originalUrl: form.originalUrl.trim(),
        title: expanded ? form.title?.trim() || undefined : undefined,
        customCode: expanded ? form.customCode?.trim() || undefined : undefined,
      };
      const response = await createShortUrl(payload);
      remember(response.data);
      setForm(initialForm);
      setMetadata(emptyMetadata);
      setToast({ id: Date.now(), message: 'Short URL created successfully.' });
    } catch (error) {
      setMessage(getCreateShortUrlError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setMessage('Copied short URL.');
    } catch { setMessage('Could not copy the link.'); }
  }

  return (
    <main className="shorten-page">
      <section className="workspace">
        <div className="shorten-intro">
          <h1>Free URL Shortener</h1>
          <p>Shorten, share and track your links — fast and free.</p>
        </div>

        <form className="shorten-creator" data-phase={phase} onSubmit={handleSubmit}>
          <h2>Shorten a long URL</h2>
          <div className="shorten-url-row" data-expanded={expanded}>
          <div className="shorten-url-input">
            <Link2 size={24} aria-hidden="true" />
            <label className="sr-only" htmlFor="destination-url">Destination URL</label>
            <input
              id="destination-url"
              type="url"
              required
              placeholder="Paste your long link here..."
              value={form.originalUrl}
              onChange={(event) =>
                setForm((current) => ({ ...current, originalUrl: event.target.value }))
              }
            />
          </div>
          <div className="shorten-top-slot">
          {!expanded && <button className="shorten-submit shorten-submit--top" type="submit" disabled={!canSubmit || transitioning}>
            {isSubmitting ? 'Shortening...' : 'Shorten URL'}
            <ArrowRight size={22} aria-hidden="true" />
          </button>}
          </div>
          </div>

          <div id="advanced-options" className="advanced-options" hidden={!expanded}>
          <div className="form-grid">
            <label>
              Title
              <input
                type="text"
                maxLength={160}
                disabled={!expanded}
                placeholder="Campaign, document, or note"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>

            <div className="alias-field">
              <div className="alias-field__heading">
                <label htmlFor="custom-alias">Custom alias</label>
                <HelpTooltip label="What is a custom alias?" text="Specify a custom ending for your short URL. For example, the alias summer-sale creates a link such as https://qlean.example/summer-sale. Use 3-32 letters, numbers, hyphens or underscores." />
              </div>
              <input
                id="custom-alias"
                type="text"
                pattern="[a-zA-Z0-9_-]{3,32}"
                disabled={!expanded}
                placeholder="optional"
                value={form.customCode}
                onChange={(event) =>
                  setForm((current) => ({ ...current, customCode: event.target.value }))
                }
              />
            </div>
          </div>

          {user && <LinkOrganization value={metadata} onChange={setMetadata} disabled={!expanded || isSubmitting} />}
          <button className="shorten-submit shorten-submit--bottom" type="submit" disabled={!canSubmit || transitioning}>
            {isSubmitting ? 'Shortening...' : 'Shorten URL'}
            <ArrowRight size={22} aria-hidden="true" />
          </button>
          </div>
          <button
            className={`advanced-toggle${hasOpened ? '' : ' advanced-toggle--bounce'}`}
            type="button"
            aria-expanded={expanded}
            aria-controls="advanced-options"
            disabled={transitioning}
            onClick={() => {
              setHasOpened(true);
              updateOptions({ advanced: advancedOpen ? null : 'true' });
            }}
          >
            Advanced options
            <ChevronDown size={18} aria-hidden="true" />
          </button>
        </form>

        {recentLinks.length > 0 && (
          <section className="recent-links" aria-labelledby="recent-links-title">
            <h2 id="recent-links-title">Recent links</h2>
            <ol className="recent-links-list">
              {recentLinks.map((latest, index) => (
                <li className="result" key={latest.id}>
                  <div>
                    <span>{index === 0 ? 'Latest short URL' : 'Short URL'}</span>
                    <strong title={latest.shortUrl}>{latest.shortUrl}</strong>
                    <div className="result-destination">
                      <span>Original URL</span>
                      <a href={latest.originalUrl} target="_blank" rel="noreferrer">{latest.originalUrl}</a>
                    </div>
                  </div>
                  <div className="row-actions">
                    <button
                      type="button"
                      onClick={() => copyUrl(latest.shortUrl)}
                      aria-label={index === 0 ? 'Copy latest short URL' : `Copy short URL ${latest.code}`}
                      title={`Copy ${latest.shortUrl}`}
                    >
                      <Copy size={18} aria-hidden="true" />
                    </button>
                    <a href={latest.shortUrl} target="_blank" rel="noreferrer" aria-label={index === 0 ? 'Open latest short URL' : `Open short URL ${latest.code}`} title={`Open ${latest.shortUrl}`}>
                      <ExternalLink size={18} aria-hidden="true" />
                    </a>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {message ? <p className="status-message" role="status">{message}</p> : null}
      </section>
      {toast && <Toast key={toast.id} message={toast.message} onDismiss={() => setToast(null)} />}

    </main>
  );
}

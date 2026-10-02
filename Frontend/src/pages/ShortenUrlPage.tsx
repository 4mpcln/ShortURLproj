import { ArrowRight, ChevronDown, Copy, ExternalLink, Link2 } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import '../styles/shortenurl.css';
import { getCreateShortUrlError } from '../api/errors';
import { HelpTooltip } from '../components/ui/help-tooltip';
import {
  CreateShortUrlRequest,
  ShortUrl,
  createShortUrl,
} from '../api/shortUrlClient';

type FormState = CreateShortUrlRequest;

const initialForm: FormState = {
  originalUrl: '',
  title: '',
  customCode: '',
};

export function ShortenUrlPage() {
  const [phase, setPhase] = useState<'collapsed' | 'opening' | 'expanded' | 'closing'>('collapsed');
  const [hasOpened, setHasOpened] = useState(false);
  const expanded = phase === 'expanded' || phase === 'closing';
  const transitioning = phase === 'opening' || phase === 'closing';
  const [form, setForm] = useState<FormState>(initialForm);
  const [latest, setLatest] = useState<ShortUrl | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!transitioning) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => setPhase(phase === 'opening' ? 'expanded' : 'collapsed'), reducedMotion ? 0 : 260);
    return () => window.clearTimeout(timer);
  }, [phase, transitioning]);

  const canSubmit = useMemo(() => {
    return form.originalUrl.trim().length > 0 && !isSubmitting;
  }, [form.originalUrl, isSubmitting]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || transitioning) return;
    setIsSubmitting(true);
    setMessage('');

    try {
      const payload = {
        originalUrl: form.originalUrl.trim(),
        title: expanded ? form.title?.trim() || undefined : undefined,
        customCode: expanded ? form.customCode?.trim() || undefined : undefined,
      };
      const response = await createShortUrl(payload);
      setLatest(response.data);
      setForm(initialForm);
    } catch (error) {
      setMessage(getCreateShortUrlError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url);
    setMessage('Copied short URL.');
  }

  return (
    <main className="shorten-page">
      <section className="workspace">
        <div className="shorten-intro">
          <h1>Make every link simpler.</h1>
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
                <HelpTooltip label="What is a custom alias?" text="ชื่อท้ายลิงก์ที่ตั้งเอง เช่น my-link ใน shorturl.at/my-link" />
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
              setPhase(expanded ? 'closing' : 'opening');
            }}
          >
            Advanced options
            <ChevronDown size={18} aria-hidden="true" />
          </button>
        </form>

        {latest ? (
          <section className="result">
            <div>
              <span>Latest short URL</span>
              <strong>{latest.shortUrl}</strong>
              <div className="result-destination">
                <span>Original URL</span>
                <a href={latest.originalUrl} target="_blank" rel="noreferrer">{latest.originalUrl}</a>
              </div>
            </div>
            <div className="row-actions">
              <button
                type="button"
                onClick={() => copyUrl(latest.shortUrl)}
                aria-label="Copy latest short URL"
              >
                <Copy size={18} aria-hidden="true" />
              </button>
              <a href={latest.shortUrl} target="_blank" rel="noreferrer" aria-label="Open latest short URL">
                <ExternalLink size={18} aria-hidden="true" />
              </a>
            </div>
          </section>
        ) : null}

        {message ? <p className="status-message" role="status">{message}</p> : null}
      </section>

    </main>
  );
}

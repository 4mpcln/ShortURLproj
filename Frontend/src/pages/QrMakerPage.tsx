import { Check, ChevronDown, Download, Link2, QrCode } from 'lucide-react';
import QRCodeStyling, { type DotType } from 'qr-code-styling';
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import '../styles/qr-maker.css';
import { useAuth } from '../auth/AuthContext';
import { getShortURLAPI, type ShortUrl, type QrOptionsStyle } from '../api/generated/shortUrl';
import { LinkOrganization, emptyMetadata, metadataPayload, libraryError } from '../components/LinkOrganization';
import { Toast } from '../components/ui/toast';
import { createQrCode } from '../lib/qrCode';

const styles: { name: string; type: DotType }[] = [
  { name: 'Classic', type: 'square' },
  { name: 'Rounded', type: 'rounded' },
  { name: 'Dots', type: 'dots' },
  { name: 'Minimal', type: 'classy' },
];

const colors = [
  { name: 'Black', value: '#161616' },
  { name: 'White', value: '#ffffff' },
  { name: 'Blue', value: '#185bb5' },
  { name: 'Purple', value: '#6935b3' },
  { name: 'Pink', value: '#b52565' },
  { name: 'Green', value: '#087846' },
  { name: 'Orange', value: '#a94b08' },
  { name: 'Red', value: '#b83232' },
];

export function QrMakerPage() {
  const { user, loading } = useAuth();
  const [metadata, setMetadata] = useState(emptyMetadata);
  const [title, setTitle] = useState('');
  const [saved, setSaved] = useState<ShortUrl | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState('');
  const [style, setStyle] = useState<DotType>('square');
  const [color, setColor] = useState('#161616');
  const [size, setSize] = useState(300);
  const [ready, setReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const preview = useRef<HTMLDivElement>(null);
  const qrCode = useRef<QRCodeStyling | null>(null);
  const generation = useRef(0);
  const generationBusy = useRef(false);
  const lastSaved = useRef<{ key: string; item: ShortUrl } | null>(null);

  useEffect(() => {
    setMetadata(emptyMetadata); setTitle(''); setExpanded(false);
    lastSaved.current = null;
  }, [user?.id]);

  useLayoutEffect(() => {
    generation.current += 1;
    generationBusy.current = false;
    setGenerating(false); setReady(false); setSaved(null); setError('');
    qrCode.current = null;
    preview.current?.replaceChildren();
    return () => { generation.current += 1; };
  }, [content, style, color, size, metadata, title, user?.id]);

  async function generateQr(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (generationBusy.current || loading || downloading || ready || !content.trim()) return;
    if (user && metadata.startsAt && metadata.expiresAt && new Date(metadata.startsAt) >= new Date(metadata.expiresAt)) {
      setExpanded(true); setError('Closing time must be after opening time.'); return;
    }
    const request = ++generation.current;
    generationBusy.current = true;
    setGenerating(true); setError('');
    let drawing = false;
    try {
      let item: ShortUrl | null = null;
      if (user) {
        const payload = { originalUrl: content.trim(), title: title.trim(), ...metadataPayload(metadata), qrOptions: { style: style as QrOptionsStyle, color, size: size as 300 | 600 | 1000 } };
        const key = JSON.stringify({ userId: user.id, ...payload });
        // Reuse a saved item when retrying a failed draw of the same QR.
        item = lastSaved.current?.key === key ? lastSaved.current.item : (await getShortURLAPI().saveQr(payload)).data;
        if (request !== generation.current) return;
        lastSaved.current = { key, item };
        setSaved(item);
      }
      drawing = true;
      const qr = createQrCode(item?.shortUrl || content, { size, style, color });
      const png = await qr.getRawData('png');
      if (request !== generation.current || !preview.current) return;
      if (!png) throw new Error('QR image unavailable.');
      preview.current.replaceChildren();
      qr.append(preview.current);
      qrCode.current = qr;
      setReady(true);
      setToast({ id: Date.now(), message: item ? 'QR code created and saved successfully.' : 'QR code created successfully.' });
    } catch (err) {
      if (request === generation.current) setError(drawing ? 'Could not generate a QR code. Try a shorter URL or text.' : libraryError(err));
    } finally {
      if (request === generation.current) { generationBusy.current = false; setGenerating(false); }
    }
  }

  async function downloadQr() {
    if (!ready || !qrCode.current || downloading || generating) return;
    setDownloading(true);
    try {
      await qrCode.current.download({ name: 'qlean-qr-code', extension: 'png' });
    } catch {
      setError('Could not download the QR code. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="qr-page">
      <div className="qr-intro">
        <h1>Turn anything into a QR code.</h1>
        <p>Create, customize and share your QR code instantly.</p>
      </div>

      <section className="qr-maker" aria-labelledby="qr-maker-title">
        <h2 id="qr-maker-title">Create a QR Code</h2>
        <div className="qr-maker__layout">
          <form className="qr-controls-form" onSubmit={generateQr}>
          <fieldset className="qr-controls qr-controls-fieldset" disabled={generating || downloading || loading}>
            <div className="qr-content-input">
              <Link2 size={24} aria-hidden="true" />
              <input
                aria-label="URL or text"
                placeholder="Enter a URL or text..."
                maxLength={1000}
                value={content}
                onChange={event => setContent(event.target.value)}
              />
            </div>

            <fieldset>
              <legend>Style</legend>
              <div className="qr-style-options" role="group" aria-label="QR code style">
                {styles.map(option => (
                  <button key={option.type} type="button" aria-pressed={style === option.type} onClick={() => setStyle(option.type)}>
                    <QrCode size={30} aria-hidden="true" className={`qr-style-icon qr-style-icon--${option.type}`} />
                    <span>{option.name}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>Color</legend>
              <div className="qr-color-options" role="group" aria-label="QR code color">
                {colors.map(option => (
                  <button
                    key={option.value}
                    className="qr-color-swatch"
                    type="button"
                    style={{ backgroundColor: option.value }}
                    aria-label={option.name}
                    title={option.name}
                    aria-pressed={color === option.value}
                    onClick={() => setColor(option.value)}
                  >
                    {color === option.value && <Check size={18} color={color === '#ffffff' ? '#161616' : '#ffffff'} aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="qr-size-label">
              <label htmlFor="qr-size">Size</label>
              <select id="qr-size" value={size} onChange={event => setSize(Number(event.target.value))}>
                <option value={300}>300 × 300 px</option>
                <option value={600}>600 × 600 px</option>
                <option value={1000}>1000 × 1000 px</option>
              </select>
            </div>
            <div className="qr-below-size">
              {user && <>
                <button className="qr-advanced-toggle" type="button" aria-expanded={expanded} aria-controls="qr-advanced-options" onClick={() => setExpanded(!expanded)}>Advanced options<ChevronDown size={18} aria-hidden="true" /></button>
                <fieldset id="qr-advanced-options" className="qr-advanced-options" hidden={!expanded} disabled={!expanded || generating || downloading}>
                  <label className="qr-size-label">Title<input maxLength={160} value={title} onChange={event => setTitle(event.target.value)} placeholder="Campaign, document, or note" /></label>
                  <LinkOrganization value={metadata} onChange={setMetadata} disabled={!expanded || generating || downloading} />
                </fieldset>
              </>}
              <button className="qr-generate" type="submit" disabled={!content.trim() || generating || downloading || ready}>
                {ready ? <Check size={20} aria-hidden="true" /> : <QrCode size={20} aria-hidden="true" />}
                {generating ? 'Generating...' : ready ? 'Generated' : 'Generate'}
              </button>
            </div>
          </fieldset>
          </form>

          <div className="qr-output">
            <div className="qr-preview" aria-label="QR code preview" aria-busy={generating}>
              <div className="qr-preview__canvas" ref={preview} role="img" aria-label={ready ? 'Generated QR code' : 'Empty QR code preview'} />
              {!ready && <div className="qr-preview__empty">
                <QrCode size={64} strokeWidth={1} aria-hidden="true" />
                <span>{error ? 'QR code unavailable' : generating ? 'Generating...' : 'QR preview'}</span>
              </div>}
            </div>
            {ready && saved && <div className="qr-saved-link" role="status"><span><Check size={16} aria-hidden="true" />Saved to My library</span><a href={saved.shortUrl} target="_blank" rel="noreferrer" title={`Open ${saved.shortUrl}`}>{saved.shortUrl}</a></div>}
            <button className="qr-download" type="button" disabled={!ready || downloading || generating} onClick={downloadQr}>
              <Download size={20} aria-hidden="true" />
              {downloading ? 'Downloading...' : 'Download QR Code'}
            </button>
            {error && <p className="qr-error" role="alert">{error}</p>}
          </div>
        </div>
      </section>
      {toast && <Toast key={toast.id} message={toast.message} onDismiss={() => setToast(null)} />}
    </main>
  );
}

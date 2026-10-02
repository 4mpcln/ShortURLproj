import { Check, Download, Link2, QrCode } from 'lucide-react';
import QRCodeStyling, { type DotType } from 'qr-code-styling';
import { useEffect, useRef, useState } from 'react';
import '../styles/qr-maker.css';

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
  const [content, setContent] = useState('');
  const [style, setStyle] = useState<DotType>('square');
  const [color, setColor] = useState('#161616');
  const [size, setSize] = useState(300);
  const [ready, setReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const preview = useRef<HTMLDivElement>(null);
  const qrCode = useRef<QRCodeStyling | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError('');
    qrCode.current = null;
    preview.current?.replaceChildren();
    if (!content.trim()) return;

    const timer = window.setTimeout(async () => {
      try {
        // The bundled encoder accepts byte strings; encode Unicode as UTF-8 first.
        const data = Array.from(new TextEncoder().encode(content.trim()), byte => String.fromCharCode(byte)).join('');
        const qr = new QRCodeStyling({
          width: size,
          height: size,
          type: 'canvas',
          data,
          margin: Math.round(size * 0.08),
          qrOptions: { errorCorrectionLevel: 'H', mode: 'Byte' },
          dotsOptions: { type: style, color },
          cornersSquareOptions: { type: style === 'square' ? 'square' : 'extra-rounded', color },
          cornersDotOptions: { type: style === 'dots' ? 'dot' : 'square', color },
          backgroundOptions: { color: color === '#ffffff' ? '#161616' : '#ffffff' },
        });
        // Wait for drawing to finish before exposing the preview or download.
        await qr.getRawData('png');
        if (cancelled || !preview.current) return;
        qr.append(preview.current);
        qrCode.current = qr;
        setReady(true);
      } catch {
        if (!cancelled) setError('This content is too long for a QR code. Try a shorter URL or text.');
      }
    }, 200);

    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [content, style, color, size]);

  async function downloadQr() {
    if (!content.trim() || !ready || !qrCode.current || downloading) return;
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
          <div className="qr-controls">
            <div className="qr-content-input">
              <Link2 size={24} aria-hidden="true" />
              <input
                aria-label="URL or text"
                placeholder="Enter a URL or text..."
                maxLength={1000}
                value={content}
                onChange={event => { setReady(false); setContent(event.target.value); }}
              />
            </div>

            <fieldset>
              <legend>Style</legend>
              <div className="qr-style-options" role="group" aria-label="QR code style">
                {styles.map(option => (
                  <button key={option.type} type="button" aria-pressed={style === option.type} onClick={() => { if (style !== option.type) setReady(false); setStyle(option.type); }}>
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
                    onClick={() => { if (color !== option.value) setReady(false); setColor(option.value); }}
                  >
                    {color === option.value && <Check size={18} color={color === '#ffffff' ? '#161616' : '#ffffff'} aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="qr-size-label">
              <label htmlFor="qr-size">Size</label>
              <select id="qr-size" value={size} onChange={event => {
                const nextSize = Number(event.target.value);
                if (size !== nextSize) setReady(false);
                setSize(nextSize);
              }}>
                <option value={300}>300 × 300 px</option>
                <option value={600}>600 × 600 px</option>
                <option value={1000}>1000 × 1000 px</option>
              </select>
            </div>
          </div>

          <div className="qr-output">
            <div className="qr-preview" aria-label="QR code preview" aria-busy={Boolean(content.trim()) && !ready && !error}>
              <div className="qr-preview__canvas" ref={preview} role="img" aria-label={ready ? 'Generated QR code' : 'Empty QR code preview'} />
              {!ready && <div className="qr-preview__empty">
                <QrCode size={64} strokeWidth={1} aria-hidden="true" />
                <span>{error ? 'QR code unavailable' : content.trim() ? 'Generating...' : 'QR preview'}</span>
              </div>}
            </div>
            <button className="qr-download" type="button" disabled={!content.trim() || !ready || downloading} onClick={downloadQr}>
              <Download size={20} aria-hidden="true" />
              {downloading ? 'Downloading...' : 'Download QR Code'}
            </button>
            {error && <p className="qr-error" role="alert">{error}</p>}
          </div>
        </div>
      </section>
    </main>
  );
}

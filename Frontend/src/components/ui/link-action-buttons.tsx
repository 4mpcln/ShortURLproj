import { Copy, Download, LoaderCircle, type LucideIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import type { DotType } from 'qr-code-styling';
import type { ShortUrl } from '../../api/generated/shortUrl';
import { createQrCode } from '../../lib/qrCode';
import { Tooltip } from './tooltip';
import './link-action-buttons.css';

function LinkActionButton({ label, icon: Icon, disabled, busy, onClick }: {
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
}) {
  return <Tooltip text={label}><button type="button" className="link-action-button" aria-label={label}
    aria-busy={busy || undefined} disabled={disabled} onClick={onClick}>
    <Icon size={18} aria-hidden="true" className={busy ? 'spin' : undefined} />
  </button></Tooltip>;
}

export function CopyLinkButton({ url, disabled, onCopy }: {
  url: string;
  disabled?: boolean;
  onCopy: (url: string) => void;
}) {
  return <LinkActionButton label="Copy short URL" icon={Copy} disabled={disabled} onClick={() => onCopy(url)} />;
}

export function DownloadQrButton({ item, disabled, onMessage }: {
  item: ShortUrl;
  disabled?: boolean;
  onMessage: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const downloading = useRef(false);
  async function download() {
    if (downloading.current) return;
    downloading.current = true;
    setBusy(true);
    onMessage('');
    try {
      const options = item.qrOptions;
      const qr = createQrCode(item.shortUrl, {
        size: options?.size || 300,
        style: options?.style as DotType || 'square',
        color: options?.color || '#161616',
      });
      await qr.download({ name: `qlean-${item.code}`, extension: 'png' });
    } catch {
      onMessage('Could not download QR. Please try again.');
    } finally {
      downloading.current = false;
      setBusy(false);
    }
  }
  return <LinkActionButton label={busy ? 'Downloading QR...' : 'Download QR'} icon={busy ? LoaderCircle : Download}
    disabled={disabled || busy} busy={busy} onClick={download} />;
}

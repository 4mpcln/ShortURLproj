import QRCodeStyling, { type DotType } from 'qr-code-styling';
export function createQrCode(content: string, options: { size: number; style: DotType; color: string }) {
  const { size, style, color } = options;
  // The bundled encoder expects byte strings, so encode Unicode as UTF-8 first.
  const data = Array.from(new TextEncoder().encode(content.trim()), byte => String.fromCharCode(byte)).join('');
  return new QRCodeStyling({
    width: size, height: size, type: 'canvas', data, margin: Math.round(size * .08),
    qrOptions: { errorCorrectionLevel: 'H', mode: 'Byte' },
    dotsOptions: { type: style, color },
    cornersSquareOptions: { type: style === 'square' ? 'square' : 'extra-rounded', color },
    cornersDotOptions: { type: style === 'dots' ? 'dot' : 'square', color },
    backgroundOptions: { color: color === '#ffffff' ? '#161616' : '#ffffff' },
  });
}

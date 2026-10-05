export const siteUrl = 'https://www.qlean.click';

export const publicPages = {
  '/': {
    title: 'QLEAN — Free URL Shortener & QR Code Generator',
    description: 'Shorten long URLs for free with QLEAN. Create custom short links, generate QR codes, and track link clicks easily.',
  },
  '/qr-maker': {
    title: 'Free QR Code Generator & QR Maker | QLEAN',
    description: 'Create QR codes for free with QLEAN. Turn URLs or text into custom QR codes, choose styles and colors, and download your QR code easily.',
  },
};

export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'QLEAN',
  url: `${siteUrl}/`,
};

export function pageMetadata(path: keyof typeof publicPages) {
  const page = publicPages[path];
  return [
    { name: 'description', content: page.description },
    { name: 'robots', content: 'index, follow' },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: 'QLEAN' },
    { property: 'og:title', content: page.title },
    { property: 'og:description', content: page.description },
    { property: 'og:url', content: `${siteUrl}${path}` },
    { property: 'og:image', content: `${siteUrl}/qlean-logo.png` },
    { property: 'og:image:alt', content: 'QLEAN logo' },
  ];
}

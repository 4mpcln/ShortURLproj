import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { pageMetadata, publicPages, siteUrl } from '../lib/seo';

export function PageSeo() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const path = pathname === '/shortenurl' ? '/' : pathname;
    const publicPath = path === '/' || path === '/qr-maker' ? path : null;
    document.title = publicPath ? publicPages[publicPath].title : 'QLEAN';
    for (const meta of document.head.querySelectorAll('meta[name="description"], meta[name="robots"], meta[property^="og:"]')) meta.remove();
    document.head.querySelector('link[rel="canonical"]')?.remove();

    if (publicPath) {
      for (const attributes of pageMetadata(publicPath)) {
        const meta = document.createElement('meta');
        for (const [key, value] of Object.entries(attributes)) meta.setAttribute(key, value);
        document.head.append(meta);
      }
      const canonical = document.createElement('link');
      canonical.rel = 'canonical';
      canonical.href = `${siteUrl}${publicPath}`;
      document.head.append(canonical);
    } else {
      const robots = document.createElement('meta');
      robots.name = 'robots';
      robots.content = 'noindex, follow';
      document.head.append(robots);
    }
  }, [pathname]);

  return null;
}

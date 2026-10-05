import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { pageMetadata, publicPages, siteUrl, websiteSchema } from './src/lib/seo';

export default defineConfig({
  plugins: [react(), {
    name: 'qlean-seo',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url || '/', 'http://localhost');
        if (url.pathname !== '/shortenurl' && url.pathname !== '/shortenurl/') return next();
        response.writeHead(301, { Location: `/${url.search}` });
        response.end();
      });
    },
    transformIndexHtml(_html, context) {
      const path = context.filename.endsWith('/qr-maker.html') || context.originalUrl?.split('?')[0] === '/qr-maker' ? '/qr-maker' : '/';
      return [
        { tag: 'title', children: publicPages[path].title, injectTo: 'head' },
        ...pageMetadata(path).map(attrs => ({ tag: 'meta', attrs, injectTo: 'head' as const })),
        { tag: 'link', attrs: { rel: 'canonical', href: `${siteUrl}${path}` }, injectTo: 'head' },
        { tag: 'script', attrs: { type: 'application/ld+json', id: 'qlean-website-schema' }, children: JSON.stringify(websiteSchema), injectTo: 'head' },
      ];
    },
  }],
  build: {
    rollupOptions: {
      input: { home: 'index.html', qrMaker: 'qr-maker.html' },
    },
  },
  server: {
    port: 3210,
    proxy: {
      '/api': 'http://localhost:3211',
    },
  },
});

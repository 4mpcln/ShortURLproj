import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ZodError } from 'zod';
import { config } from './config.js';
import { findByCode, listShortUrls, listUserShortUrls, registerClick } from './shortUrlRepository.js';
import { authenticate, authRouter, currentUser } from './auth.js';
import { createShortUrlSchema, createUniqueShortUrl, toShortUrl } from './shortUrlService.js';
import { libraryRouter } from './library.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.webOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/api', (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && req.headers.origin !== config.webOrigin) {
    res.status(403).json({ message: 'Request origin is not allowed.' });
    return;
  }
  next();
}, authenticate);
app.use('/api/auth', authRouter);
app.use('/api/library', libraryRouter);

app.get('/api/my-links', async (_req, res, next) => {
  const user = currentUser(res);
  if (!user) { res.status(401).json({ message: 'Please log in to view your links.' }); return; }
  try {
    const data = await listUserShortUrls(user.id);
    res.json({ data: data.map(item => ({ ...item, shortUrl: toShortUrl(item.code) })) });
  } catch (error) { next(error); }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/short-urls', async (_req, res, next) => {
  try {
    const data = await listShortUrls();
    res.json({
      data: data.map((item) => ({ ...item, shortUrl: toShortUrl(item.code) })),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/short-urls', async (req, res, next) => {
  try {
    const input = createShortUrlSchema.parse(req.body);
    const item = await createUniqueShortUrl(input, currentUser(res)?.id);
    res.status(201).json({ data: { ...item, shortUrl: toShortUrl(item.code) } });
  } catch (error) {
    next(error);
  }
});

app.get('/api/short-urls/:code', async (req, res, next) => {
  try {
    const item = await findByCode(req.params.code);
    if (!item) {
      res.status(404).json({ message: 'Short URL not found.' });
      return;
    }

    res.json({ data: { ...item, tags: [], folderId: null, folderName: null, isPinned: false, qrOptions: null, shortUrl: toShortUrl(item.code) } });
  } catch (error) {
    next(error);
  }
});

app.get('/:code', async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const item = await registerClick(req.params.code);
    if (!item) {
      const existing = await findByCode(req.params.code);
      res.status(existing?.status === 'expired' ? 410 : existing ? 403 : 404).send(existing?.status === 'expired' ? 'This link has expired.' : existing ? 'This link is not available yet.' : 'Short URL not found.');
      return;
    }

    if (item.kind === 'qr' && !/^https?:\/\//i.test(item.originalUrl)) res.type('text/plain').send(item.originalUrl);
    else res.redirect(302, item.originalUrl);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({ message: 'Invalid request payload.', issues: error.issues });
    return;
  }

  if (error instanceof Error && error.name === 'ConflictError') {
    res.status(409).json({ message: error.message });
    return;
  }
  if (error instanceof Error && error.name === 'ValidationError') {
    res.status(400).json({ message: error.message }); return;
  }
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
    res.status(409).json({ message: 'This name, alias or tag color is already in use.' }); return;
  }

  console.error(error);
  res.status(500).json({ message: 'Internal server error.' });
});

app.listen(config.port, () => {
  console.log(`ShortURL API is running on http://localhost:${config.port}`);
});

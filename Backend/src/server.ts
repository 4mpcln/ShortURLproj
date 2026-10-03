import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ZodError, z } from 'zod';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import { findAccessCodeCiphertext, findByCode, listShortUrls, listUserShortUrls, registerClick } from './shortUrlRepository.js';
import { authenticate, authRouter, currentUser } from './auth.js';
import { createShortUrlSchema, createUniqueShortUrl, toShortUrl } from './shortUrlService.js';
import { libraryRouter } from './library.js';
import { startCache } from './redis.js';
import { isAllowedWebOrigin } from './webOrigin.js';
import { matchesAccessCode } from './accessCode.js';

const app = express();
if (process.env.VERCEL) app.set('trust proxy', 1);

app.use(helmet());
const allowedOrigin = (origin: string) => isAllowedWebOrigin(origin, config.webOrigin, !config.secureCookies);
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigin(origin)), credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/api', (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && !allowedOrigin(req.headers.origin)) {
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

    if (item.hasAccessCode) { res.status(403).json({ message: 'An access code is required.' }); return; }

    res.json({ data: { ...item, tags: [], folderId: null, folderName: null, isPinned: false, qrOptions: null, shortUrl: toShortUrl(item.code) } });
  } catch (error) {
    next(error);
  }
});

app.get('/api/short-urls/:code/access', async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const item = await findByCode(req.params.code);
    if (!item) { res.status(404).json({ message: 'Short URL not found.' }); return; }
    res.json({ data: { status: item.status, startsAt: item.startsAt, shortUrl: toShortUrl(item.code), hasAccessCode: item.hasAccessCode } });
  } catch (error) { next(error); }
});

const unlockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true,
  keyGenerator: req => `${ipKeyGenerator(req.ip || 'unknown')}:${req.params.code}`,
  standardHeaders: 'draft-7', legacyHeaders: false,
  message: { message: 'Too many incorrect attempts. Please try again in 15 minutes.' },
});
app.post('/api/short-urls/:code/unlock', unlockLimiter, async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const { accessCode } = z.object({ accessCode: z.string().regex(/^\d{6}$/) }).parse(req.body);
    const item = await findByCode(z.string().parse(req.params.code));
    if (!item) { res.status(404).json({ message: 'Short URL not found.' }); return; }
    if (item.status !== 'active') { res.status(403).json({ message: 'This link is not currently available.' }); return; }
    const ciphertext = await findAccessCodeCiphertext(item.code);
    if (!ciphertext || !await matchesAccessCode(ciphertext, accessCode)) {
      res.status(403).json({ message: 'Incorrect access code. Please try again.' }); return;
    }
    // The row update checks the verified ciphertext again in case the owner changes it.
    const accessed = await registerClick(item.code, ciphertext);
    if (!accessed) { res.status(403).json({ message: 'This link is not currently available.' }); return; }
    res.json({ data: { originalUrl: accessed.originalUrl, kind: accessed.kind } });
  } catch (error) { next(error); }
});

app.get(['/s/:code', '/:code'], async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const code = z.string().parse(req.params.code);
    const item = await registerClick(code);
    if (!item) {
      const existing = await findByCode(code);
      if (existing?.status === 'scheduled' || existing?.status === 'disabled') {
        const noticeUrl = new URL(`/link-unavailable/${encodeURIComponent(existing.code)}`, config.webOrigin);
        res.redirect(302, noticeUrl.toString());
        return;
      }
      if (existing?.status === 'active' && existing.hasAccessCode) {
        res.redirect(302, new URL(`/link-access/${encodeURIComponent(existing.code)}`, config.webOrigin).toString());
        return;
      }
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

startCache();
if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`ShortURL API is running on http://localhost:${config.port}`);
  });
}

export default app;

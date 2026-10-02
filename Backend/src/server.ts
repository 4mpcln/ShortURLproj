import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { ZodError } from 'zod';
import { config } from './config.js';
import { findByCode, listShortUrls, registerClick } from './shortUrlRepository.js';
import { createShortUrlSchema, createUniqueShortUrl, toShortUrl } from './shortUrlService.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.webOrigin }));
app.use(express.json());

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
    const item = await createUniqueShortUrl(input);
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

    res.json({ data: { ...item, shortUrl: toShortUrl(item.code) } });
  } catch (error) {
    next(error);
  }
});

app.get('/:code', async (req, res, next) => {
  try {
    const item = await registerClick(req.params.code);
    if (!item) {
      res.status(404).send('Short URL not found.');
      return;
    }

    res.redirect(302, item.originalUrl);
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

  console.error(error);
  res.status(500).json({ message: 'Internal server error.' });
});

app.listen(config.port, () => {
  console.log(`ShortURL API is running on http://localhost:${config.port}`);
});

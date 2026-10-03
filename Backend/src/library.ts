import { Router } from 'express';
import { z } from 'zod';
import { customAlphabet } from 'nanoid';
import { currentUser } from './auth.js';
import { pool } from './db.js';
import { metadataShape, validateMetadata } from './linkMetadata.js';
import { createShortUrl, deleteOwnedLink, findOwnedAccessCode, findOwnedLink, updateOwnedLink } from './shortUrlRepository.js';
import { createShortUrlSchema, toShortUrl } from './shortUrlService.js';
import { statisticsCache } from './redis.js';

export const libraryRouter = Router();
libraryRouter.use((_req, res, next) => {
  if (!currentUser(res)) { res.status(401).json({ message: 'Please log in.' }); return; }
  next();
});
const idSchema = z.string().uuid();
const generate = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 7);
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, 'Provide a valid date.');
const updateLinkSchema = z.object({
  originalUrl: z.string().trim().min(1).optional(),
  title: z.string().trim().max(160).optional(),
  isEnabled: z.boolean().optional(),
  ...metadataShape,
}).strict().refine(input => Object.values(input).some(value => value !== undefined), 'Provide at least one field to update.');

libraryRouter.get('/organization', async (_req, res, next) => {
  try {
    const userId = currentUser(res)!.id;
    for (const [name, color] of [['Social', '#2563eb'], ['Examination', '#16a34a'], ['Campaign', '#ea580c']]) {
      await pool.query('INSERT INTO tags (user_id, name, color) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [userId, name, color]);
    }
    const tags = await pool.query('SELECT id,name,color FROM tags WHERE user_id=$1 ORDER BY name', [userId]);
    const folders = await pool.query('SELECT id,name FROM folders WHERE user_id=$1 ORDER BY name', [userId]);
    res.json({ tags: tags.rows, folders: folders.rows });
  } catch (error) { next(error); }
});
libraryRouter.post('/tags', async (req, res, next) => {
  try {
    const input = z.object({ name: z.string().trim().min(1).max(40), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).transform(value => value.toLowerCase()) }).parse(req.body);
    const result = await pool.query('INSERT INTO tags (user_id,name,color) VALUES ($1,$2,$3) RETURNING id,name,color', [currentUser(res)!.id, input.name, input.color]);
    res.status(201).json({ data: result.rows[0] });
  } catch (error) { next(error); }
});
libraryRouter.post('/folders', async (req, res, next) => {
  try {
    const input = z.object({ name: z.string().trim().min(1).max(60) }).parse(req.body);
    const result = await pool.query('INSERT INTO folders (user_id,name) VALUES ($1,$2) RETURNING id,name', [currentUser(res)!.id, input.name]);
    res.status(201).json({ data: result.rows[0] });
  } catch (error) { next(error); }
});
libraryRouter.post('/qr', async (req, res, next) => {
  try {
    const input = z.object({ originalUrl: z.string().trim().min(1).max(1000), title: z.string().trim().max(160).optional(), ...metadataShape,
      qrOptions: z.object({ style: z.enum(['square','rounded','dots','classy']), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), size: z.union([z.literal(300),z.literal(600),z.literal(1000)]) }),
    }).parse(req.body);
    await validateMetadata(input, currentUser(res)!.id);
    const item = await createShortUrl({ ...input, code: generate(), userId: currentUser(res)!.id, kind: 'qr' });
    res.status(201).json({ data: { ...item, shortUrl: toShortUrl(item.code) } });
  } catch (error) { next(error); }
});
libraryRouter.patch('/links/:id', async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id);
    const userId = currentUser(res)!.id;
    const existing = await findOwnedLink(id, userId);
    if (!existing) { res.status(404).json({ message: 'Item not found.' }); return; }
    const input = updateLinkSchema.parse(req.body);
    if (input.originalUrl !== undefined) {
      if (existing.kind === 'url') createShortUrlSchema.shape.originalUrl.parse(input.originalUrl);
      else z.string().min(1).max(1000).parse(input.originalUrl);
    }
    const item = await updateOwnedLink(id, userId, input);
    if (!item) { res.status(404).json({ message: 'Item not found.' }); return; }
    await statisticsCache.invalidate(userId, id);
    res.json({ data: { ...item, shortUrl: toShortUrl(item.code) } });
  } catch (error) { next(error); }
});
libraryRouter.delete('/links/:id', async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id);
    if (!await deleteOwnedLink(id, currentUser(res)!.id)) { res.status(404).json({ message: 'Item not found.' }); return; }
    await statisticsCache.invalidate(currentUser(res)!.id, id);
    res.sendStatus(204);
  } catch (error) { next(error); }
});
libraryRouter.patch('/links/:id/pin', async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id);
    const { isPinned } = z.object({ isPinned: z.boolean() }).parse(req.body);
    const result = await pool.query('UPDATE short_urls SET is_pinned=$1,updated_at=NOW() WHERE id=$2 AND user_id=$3 RETURNING id', [isPinned,id,currentUser(res)!.id]);
    if (!result.rowCount) { res.status(404).json({ message: 'Item not found.' }); return; }
    await statisticsCache.invalidate(currentUser(res)!.id, id);
    res.json({ data: { isPinned } });
  } catch (error) { next(error); }
});
libraryRouter.get('/links/:id/statistics', async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id);
    const item = await findOwnedLink(id, currentUser(res)!.id);
    if (!item) { res.status(404).json({ message: 'Item not found.' }); return; }
    const accessCode = await findOwnedAccessCode(id, currentUser(res)!.id);
    const query = z.object({
      days: z.coerce.number().int().min(1).max(90).optional(),
      startDate: dateOnlySchema.optional(),
      endDate: dateOnlySchema.optional(),
    }).parse(req.query);
    if (query.startDate || query.endDate) {
      if (!query.startDate || !query.endDate || query.endDate < query.startDate) { res.status(400).json({ message: 'Provide a valid date range.' }); return; }
      const result = await pool.query<{ date: string; clicks: number }>(`WITH input AS (
        SELECT $2::date AS start_day, $3::date AS end_day
      ), dates AS (
        SELECT generate_series(start_day, end_day, '1 day')::date AS day FROM input WHERE end_day - start_day <= 365
      ) SELECT to_char(d.day,'YYYY-MM-DD') AS date, count(c.id)::int AS clicks FROM dates d
        LEFT JOIN click_logs c ON c.short_url_id=$1 AND c.accessed_at >= (d.day::timestamp AT TIME ZONE 'Asia/Bangkok') AND c.accessed_at < ((d.day+1)::timestamp AT TIME ZONE 'Asia/Bangkok')
        GROUP BY d.day ORDER BY d.day`, [id,query.startDate,query.endDate]);
      if (!result.rows.length) { res.status(400).json({ message: 'Date range can include at most 366 days.' }); return; }
      res.setHeader('Cache-Control', 'private, no-store');
      res.json({ data: { item: { ...item, shortUrl: toShortUrl(item.code) }, accessCode, daily: result.rows, cacheExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() } });
      return;
    }
    const days = query.days ?? 30;
    const cached = await statisticsCache.read(currentUser(res)!.id, id, days, async () => {
      const result = await pool.query<{ date: string; clicks: number }>(`WITH dates AS (
      SELECT generate_series((NOW() AT TIME ZONE 'Asia/Bangkok')::date - ($2::int - 1), (NOW() AT TIME ZONE 'Asia/Bangkok')::date, '1 day')::date AS day
    ) SELECT to_char(d.day,'YYYY-MM-DD') AS date, count(c.id)::int AS clicks FROM dates d
      LEFT JOIN click_logs c ON c.short_url_id=$1 AND c.accessed_at >= (d.day::timestamp AT TIME ZONE 'Asia/Bangkok') AND c.accessed_at < ((d.day+1)::timestamp AT TIME ZONE 'Asia/Bangkok')
      GROUP BY d.day ORDER BY d.day`, [id,days]);
      return result.rows;
    });
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ data: { item: { ...item, shortUrl: toShortUrl(item.code) }, accessCode, daily: cached.daily, cacheExpiresAt: new Date(cached.expiresAt).toISOString() } });
  } catch (error) { next(error); }
});

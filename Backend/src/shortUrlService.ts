import { customAlphabet } from 'nanoid';
import { z } from 'zod';
import { config } from './config.js';
import { createShortUrl, findByCode } from './shortUrlRepository.js';
import { metadataShape, validateMetadata } from './linkMetadata.js';

const createCode = customAlphabet(
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  7,
);

export const createShortUrlSchema = z.object({
  originalUrl: z.string().url().refine(value => { try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } }, 'Only HTTP and HTTPS URLs are supported.'),
  ...metadataShape,
  customCode: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_-]{3,32}$/)
    .refine(value => !['health','api'].includes(value.toLowerCase()), 'This alias is reserved.')
    .optional()
    .or(z.literal('')),
  title: z.string().trim().max(160).optional().or(z.literal('')),
});

export type CreateShortUrlInput = z.infer<typeof createShortUrlSchema>;

export function toShortUrl(code: string) {
  return `${config.shortUrlBase}/${code}`;
}

export async function createUniqueShortUrl(input: CreateShortUrlInput, userId?: string) {
  const parsed = createShortUrlSchema.parse(input);
  await validateMetadata(parsed, userId);
  const requestedCode = parsed.customCode || undefined;

  if (requestedCode) {
    const existing = await findByCode(requestedCode);
    if (existing) {
      const error = new Error('Custom alias is already in use.');
      error.name = 'ConflictError';
      throw error;
    }

    return createShortUrl({
      code: requestedCode,
      originalUrl: parsed.originalUrl,
      title: parsed.title || undefined,
      userId,
      tagIds: parsed.tagIds, folderId: parsed.folderId, startsAt: parsed.startsAt, expiresAt: parsed.expiresAt,
      accessCode: parsed.accessCode,
    });
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createCode();
    const existing = await findByCode(code);
    if (!existing) {
      return createShortUrl({
        code,
        originalUrl: parsed.originalUrl,
        title: parsed.title || undefined,
        userId,
        tagIds: parsed.tagIds, folderId: parsed.folderId, startsAt: parsed.startsAt, expiresAt: parsed.expiresAt,
        accessCode: parsed.accessCode,
      });
    }
  }

  throw new Error('Could not generate a unique short code.');
}

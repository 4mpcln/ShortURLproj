import dotenv from 'dotenv';
import { randomBytes } from 'node:crypto';

dotenv.config();

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must contain at least 32 characters in production.');
}

const port = Number(process.env.PORT ?? 3211);
const shortUrlBase = new URL(process.env.SHORT_URL_BASE || process.env.APP_BASE_URL || `http://localhost:${port}`);
if (!['http:', 'https:'].includes(shortUrlBase.protocol) || shortUrlBase.username || shortUrlBase.password || shortUrlBase.search || shortUrlBase.hash) {
  throw new Error('SHORT_URL_BASE must be an HTTP/HTTPS base URL without credentials, query parameters or a fragment.');
}

export const config = {
  port,
  shortUrlBase: shortUrlBase.href.replace(/\/+$/, ''),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3210',
  jwtSecret: process.env.JWT_SECRET || randomBytes(32).toString('hex'),
  secureCookies: process.env.NODE_ENV === 'production',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgres://shorturl:shorturl@localhost:5432/shorturl',
};

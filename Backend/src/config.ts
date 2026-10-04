import dotenv from 'dotenv';
import { randomBytes } from 'node:crypto';

dotenv.config();

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must contain at least 32 characters in production.');
}

const port = Number(process.env.PORT ?? 3211);
const deploymentHost = process.env.VERCEL_ENV === 'production'
  ? process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
  : process.env.VERCEL_URL;
const deploymentOrigin = process.env.VERCEL && deploymentHost ? `https://${deploymentHost}` : undefined;
if (process.env.VERCEL && !process.env.DATABASE_URL) throw new Error('DATABASE_URL is required on Vercel.');
if (process.env.VERCEL && !/^[a-f0-9]{64}$/i.test(process.env.ACCESS_CODE_KEY || '')) {
  throw new Error('ACCESS_CODE_KEY must contain 64 hexadecimal characters on Vercel.');
}
const shortUrlBase = new URL(process.env.SHORT_URL_BASE || process.env.APP_BASE_URL || deploymentOrigin || `http://localhost:${port}`);
if (!['http:', 'https:'].includes(shortUrlBase.protocol) || shortUrlBase.username || shortUrlBase.password || shortUrlBase.search || shortUrlBase.hash) {
  throw new Error('SHORT_URL_BASE must be an HTTP/HTTPS base URL without credentials, query parameters or a fragment.');
}

export const config = {
  port,
  shortUrlBase: shortUrlBase.href.replace(/\/+$/, ''),
  webOrigin: process.env.WEB_ORIGIN || deploymentOrigin || 'http://localhost:3210',
  jwtSecret: process.env.JWT_SECRET || randomBytes(32).toString('hex'),
  secureCookies: process.env.NODE_ENV === 'production',
  redisUrl: process.env.REDIS_URL ?? (process.env.VERCEL ? '' : 'redis://localhost:6379'),
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgres://shorturl:shorturl@localhost:5432/shorturl',
};

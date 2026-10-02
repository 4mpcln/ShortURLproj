import dotenv from 'dotenv';
import { randomBytes } from 'node:crypto';

dotenv.config();

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must contain at least 32 characters in production.');
}

const port = Number(process.env.PORT ?? 3211);

export const config = {
  port,
  appBaseUrl: (process.env.APP_BASE_URL || `http://localhost:${port}`).replace(/\/+$/, ''),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3210',
  jwtSecret: process.env.JWT_SECRET || randomBytes(32).toString('hex'),
  secureCookies: process.env.NODE_ENV === 'production',
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgres://shorturl:shorturl@localhost:5432/shorturl',
};

import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 3211),
  appBaseUrl: process.env.APP_BASE_URL ?? 'https://shorturl.at',
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3210',
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgres://shorturl:shorturl@localhost:5432/shorturl',
};

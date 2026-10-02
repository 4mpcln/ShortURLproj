import {
  CreateShortUrlRequest,
  ShortUrl,
  getShortURLAPI,
} from './generated/shortUrl';

export type { CreateShortUrlRequest, ShortUrl };

const shortUrlApi = getShortURLAPI();

export async function createShortUrl(payload: CreateShortUrlRequest) {
  return shortUrlApi.createShortUrl(payload);
}

export async function listShortUrls() {
  return shortUrlApi.listShortUrls();
}

import type { ShortUrl } from '../api/generated/shortUrl';

export function matchesLibraryQuery(item: ShortUrl, query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const fields = [item.originalUrl, item.shortUrl, item.code, item.title || '', ...item.tags.map(tag => tag.name)]
    .map(value => value.toLowerCase());
  return terms.every(term => fields.some(value => value.includes(term)));
}

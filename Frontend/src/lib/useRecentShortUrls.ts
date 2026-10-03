import { useEffect, useState } from 'react';
import type { ShortUrl } from '../api/generated/shortUrl';

type RecentShortUrl = Pick<ShortUrl, 'id' | 'code' | 'originalUrl' | 'shortUrl'>;
const MAX_RECENT_LINKS = 3;

function isRecentShortUrl(value: unknown): value is RecentShortUrl {
  if (!value || typeof value !== 'object' ||
      !('id' in value) || typeof value.id !== 'string' ||
      !('code' in value) || typeof value.code !== 'string' ||
      !('originalUrl' in value) || typeof value.originalUrl !== 'string' ||
      !('shortUrl' in value) || typeof value.shortUrl !== 'string') return false;
  try {
    return [value.originalUrl, value.shortUrl].every(url => ['http:', 'https:'].includes(new URL(url).protocol));
  } catch { return false; }
}

function readRecentLinks(key: string): RecentShortUrl[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter(isRecentShortUrl).slice(0, MAX_RECENT_LINKS) : [];
  } catch { return []; }
}

export function updateRecentShortUrl(owner: string, item: ShortUrl) {
  const key = `qlean-recent-short-urls:${owner}`;
  const items = readRecentLinks(key).map(entry => entry.id === item.id
    ? { id: item.id, code: item.code, originalUrl: item.originalUrl, shortUrl: item.shortUrl }
    : entry);
  try { sessionStorage.setItem(key, JSON.stringify(items)); } catch { /* Storage can be disabled. */ }
}

export function removeRecentShortUrl(owner: string, id: string) {
  const key = `qlean-recent-short-urls:${owner}`;
  try { sessionStorage.setItem(key, JSON.stringify(readRecentLinks(key).filter(item => item.id !== id))); } catch { /* Storage can be disabled. */ }
}

export function useRecentShortUrls(owner: string | null) {
  const key = owner === null ? null : `qlean-recent-short-urls:${owner}`;
  const [history, setHistory] = useState<{ key: string | null; items: RecentShortUrl[] }>({ key: null, items: [] });

  useEffect(() => {
    setHistory({ key, items: key ? readRecentLinks(key) : [] });
  }, [key]);

  useEffect(() => {
    if (!key || history.key !== key) return;
    try { sessionStorage.setItem(key, JSON.stringify(history.items)); } catch { /* Keep history in memory when storage is unavailable. */ }
  }, [key, history]);

  function remember(item: ShortUrl) {
    const recent: RecentShortUrl = { id: item.id, code: item.code, originalUrl: item.originalUrl, shortUrl: item.shortUrl };
    // A response from the previous account must not enter the current history.
    setHistory(current => current.key !== key ? current : {
      key,
      items: [recent, ...current.items.filter(entry => entry.id !== recent.id)].slice(0, MAX_RECENT_LINKS),
    });
  }

  return {
    recentLinks: history.key === key ? history.items : [],
    historyReady: key !== null && history.key === key,
    remember,
  };
}

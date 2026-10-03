import { getShortURLAPI, type StatisticsResponseData } from '../api/generated/shortUrl';

const TTL = 5 * 60 * 1000;
const cache = new Map<string, { data: StatisticsResponseData; expiresAt: number }>();
const pending = new Map<string, Promise<StatisticsResponseData>>();
const api = getShortURLAPI();
export type StatisticsPeriod = { days: number } | { startDate: string; endDate: string };

function periodKey(period: StatisticsPeriod) {
  return 'days' in period ? `days:${period.days}` : `range:${period.startDate}:${period.endDate}`;
}
function key(owner: string, id: string, period: StatisticsPeriod) {
  return `${owner}:${id}:${periodKey(period)}:${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })}`;
}
export function getCachedStatistics(owner: string, id: string, period: StatisticsPeriod) {
  const entryKey = key(owner, id, period);
  const entry = cache.get(entryKey);
  if (entry && entry.expiresAt > Date.now()) return entry.data;
  cache.delete(entryKey);
  return null;
}
export async function loadStatistics(owner: string, id: string, period: StatisticsPeriod) {
  const cached = getCachedStatistics(owner, id, period);
  if (cached) return cached;
  const entryKey = key(owner, id, period);
  const existing = pending.get(entryKey);
  if (existing) return existing;
  const request = api.getStatistics(id, period).then(response => {
    const data = response.data;
    const expiresAt = Math.min(Date.now() + TTL, data.cacheExpiresAt ? Date.parse(data.cacheExpiresAt) : Date.now() + TTL);
    // Invalidated requests must not repopulate the cache with an old item.
    if (pending.get(entryKey) === request) {
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(entryKey, { data, expiresAt });
    }
    return data;
  }).finally(() => { if (pending.get(entryKey) === request) pending.delete(entryKey); });
  pending.set(entryKey, request);
  return request;
}
export function invalidateStatistics(owner: string, id: string) {
  const prefix = `${owner}:${id}:`;
  for (const entryKey of cache.keys()) if (entryKey.startsWith(prefix)) cache.delete(entryKey);
  for (const entryKey of pending.keys()) if (entryKey.startsWith(prefix)) pending.delete(entryKey);
}
export function clearStatisticsCache() { cache.clear(); pending.clear(); }

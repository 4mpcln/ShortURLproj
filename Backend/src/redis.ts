import { createClient } from 'redis';
import { config } from './config.js';
import { createStatisticsCache } from './statisticsCache.js';

const client = createClient({
  url: config.redisUrl,
  disableOfflineQueue: true,
  socket: { connectTimeout: 1000, reconnectStrategy: retries => Math.min(250 * (retries + 1), 5000) },
});
let warned = false;
client.on('error', () => {
  if (!warned) console.warn('Redis is unavailable; statistics will use the database.');
  warned = true;
});
client.on('ready', () => { warned = false; });

export function startCache() {
  if (!client.isOpen) void client.connect().catch(() => {});
}
export const statisticsCache = createStatisticsCache(client);

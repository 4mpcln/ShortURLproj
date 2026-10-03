import type { Metadata } from '../components/LinkOrganization';
import type { StatisticsPeriod } from './statisticsCache';

export function updatePageOptions(current: URLSearchParams, changes: Record<string, string | null>) {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
  }
  return next;
}

function dateTime(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && Number.isFinite(Date.parse(value)) ? value : '';
}

export function readOrganizationOptions(params: URLSearchParams): Metadata {
  return {
    tagIds: [...new Set(params.getAll('tag').filter(Boolean))].slice(0, 20),
    folderId: params.get('folder') || '',
    startsAt: dateTime(params.get('startsAt')),
    expiresAt: dateTime(params.get('expiresAt')),
  };
}

export function writeOrganizationOptions(current: URLSearchParams, value: Metadata) {
  const next = updatePageOptions(current, {
    folder: value.folderId, startsAt: value.startsAt, expiresAt: value.expiresAt,
  });
  next.delete('tag');
  for (const id of value.tagIds) next.append('tag', id);
  return next;
}

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const STATISTICS_PERIOD_OPTIONS = [7, 15, 30, 45, 60] as const;

export function readStatisticsPeriod(params: URLSearchParams): StatisticsPeriod {
  const startDate = params.get('startDate');
  const endDate = params.get('endDate');
  if (validDate(startDate) && validDate(endDate) && startDate <= endDate
    && Date.parse(endDate) - Date.parse(startDate) <= 365 * 86400000) {
    return { startDate, endDate };
  }
  const days = Number(params.get('days'));
  return { days: STATISTICS_PERIOD_OPTIONS.some(option => option === days) ? days : 30 };
}

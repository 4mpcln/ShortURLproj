import type { StatisticsResponseDataDailyItem } from '../api/generated/shortUrl';

export function createStatisticsCsv(daily: StatisticsResponseDataDailyItem[]) {
  const total = daily.reduce((sum, day) => sum + day.clicks, 0);
  const rows = [['Date', 'Visits', 'Share (%)'], ...daily.map(day => [day.date, String(day.clicks), total ? (day.clicks / total * 100).toFixed(1) : '0.0'])];
  const csv = rows.map(row => row.map(value => /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value).join(',')).join('\r\n');
  return new Blob(['\ufeff', csv, '\r\n'], { type: 'text/csv;charset=utf-8' });
}

export function downloadStatisticsFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

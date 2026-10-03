import assert from 'node:assert/strict';
import test from 'node:test';
import { createStatisticsCsv } from '../src/lib/statisticsExport';

test('CSV includes every day in the selected period with numeric visits and shares', async () => {
  const daily = Array.from({ length: 90 }, (_, index) => ({ date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10), clicks: index + 1 }));
  const blob = createStatisticsCsv(daily);
  assert.equal(blob.type, 'text/csv;charset=utf-8');
  assert.deepEqual(Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0, 3)), [239, 187, 191]);
  const rows = (await blob.text()).trim().split('\r\n');
  assert.equal(rows.length, 91);
  assert.equal(rows[0], 'Date,Visits,Share (%)');
  assert.equal(rows[1], '2026-01-01,1,0.0');
  assert.equal(rows[90], '2026-03-31,90,2.2');
});

test('CSV handles empty data and zero visits without invalid percentages', async () => {
  assert.equal(await createStatisticsCsv([]).text(), 'Date,Visits,Share (%)\r\n');
  assert.equal(await createStatisticsCsv([{ date: '2026-10-03', clicks: 0 }]).text(), 'Date,Visits,Share (%)\r\n2026-10-03,0,0.0\r\n');
});

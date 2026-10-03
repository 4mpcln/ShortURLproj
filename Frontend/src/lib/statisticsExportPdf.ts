import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import type { StatisticsResponseData } from '../api/generated/shortUrl';
import fontUrl from '../assets/fonts/NotoSansThai-Regular.ttf?url';

type PdfSections = { chart: boolean; table: boolean };
const MARGIN = 16;
let fontPromise: Promise<string> | undefined;
function reportFont() {
  return fontPromise ??= fetch(fontUrl, { signal: AbortSignal.timeout(10000) }).then(async response => {
    if (!response.ok) throw new Error('Could not load the report font');
    const bytes = new Uint8Array(await response.arrayBuffer());
    return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
  }).catch(error => { fontPromise = undefined; throw error; });
}
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }) : null;
const dailyDate = (date: string) => new Date(`${date}T00:00:00+07:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' });
const lastY = (doc: jsPDF) => (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 30;

export async function createStatisticsPdf(data: StatisticsResponseData, periodLabel: string, sections: PdfSections) {
  if (!sections.chart && !sections.table) throw new Error('Select at least one section');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS('NotoSansThai.ttf', await reportFont());
  doc.addFont('NotoSansThai.ttf', 'Report', 'normal');
  doc.setFont('Report', 'normal');
  doc.setProperties({ title: data.item.title || data.item.code, subject: 'Link statistics', creator: 'Qlean' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const title = data.item.title || data.item.code;
  doc.setTextColor(36, 44, 37); doc.setFontSize(18);
  const titleLines = doc.splitTextToSize(title, width - MARGIN * 2 - 65) as string[];
  doc.text(titleLines, MARGIN, 22);
  doc.setFontSize(10); doc.setTextColor(100, 109, 101);
  doc.text(`${data.item.kind.toUpperCase()} | ${data.item.status}`, width - MARGIN, 22, { align: 'right' });
  let y = 22 + titleLines.length * 8;
  doc.text(`${periodLabel} | ${data.daily.reduce((sum, day) => sum + day.clicks, 0).toLocaleString()} visits | Asia/Bangkok`, MARGIN, y);
  const metadata = [
    [`Original ${data.item.kind === 'qr' ? 'content' : 'URL'}`, { content: data.item.originalUrl, colSpan: 3 }],
    ['Short URL', { content: data.item.shortUrl, colSpan: 3 }],
    ['Opens at', dateTime(data.item.startsAt) || 'Immediately', 'Expires at', dateTime(data.item.expiresAt) || 'No expire date'],
    ['Folder', data.item.folderName || 'No folder', 'Tags', data.item.tags.map(tag => tag.name).join(', ') || 'No tags'],
    ['Created', dateTime(data.item.createdAt) || '', 'Total visits', data.item.clickCount.toLocaleString()],
  ];
  autoTable(doc, { startY: y + 6, body: metadata, theme: 'plain', margin: MARGIN,
    styles: { font: 'Report', fontStyle: 'normal', fontSize: 9, cellPadding: 1.8, overflow: 'linebreak', textColor: [36, 44, 37] },
    columnStyles: { 0: { cellWidth: 30, textColor: [100, 109, 101] }, 1: { cellWidth: 98 }, 2: { cellWidth: 30, textColor: [100, 109, 101] } },
  });
  y = lastY(doc) + 12;
  function nextPage() {
    doc.addPage(); doc.setFont('Report', 'normal'); doc.setTextColor(36, 44, 37); doc.setFontSize(12);
    doc.text('Statistics report', MARGIN, 20);
    doc.setFontSize(9); doc.text(`${data.item.kind.toUpperCase()} | ${data.item.status}`, width - MARGIN, 20, { align: 'right' });
    y = 34;
  }
  if (sections.chart) {
    if (y + 98 > height - MARGIN) nextPage();
    doc.setFontSize(12); doc.setTextColor(36, 44, 37); doc.text('Daily visits', MARGIN, y);
    doc.setFontSize(9); doc.setTextColor(100, 109, 101);
    doc.text(data.daily.length ? `${data.daily[0].date} - ${data.daily[data.daily.length - 1].date} | Asia/Bangkok` : 'No daily data available.', MARGIN, y + 7);
    const plotX = MARGIN + 14, plotY = y + 17, plotWidth = width - MARGIN - plotX, plotHeight = 60;
    const step = Math.max(1, Math.ceil(Math.max(1, ...data.daily.map(day => day.clicks)) / 4));
    const maximum = step * 4;
    for (let tick = 0; tick <= 4; tick++) {
      const lineY = plotY + plotHeight * (1 - tick / 4);
      doc.setDrawColor(220, 228, 218); doc.setLineWidth(.2); doc.line(plotX, lineY, plotX + plotWidth, lineY);
      doc.setFontSize(8); doc.text(String(tick * step), plotX - 3, lineY + 1, { align: 'right' });
    }
    const column = plotWidth / Math.max(1, data.daily.length);
    const labelEvery = Math.max(1, Math.ceil(data.daily.length / 12));
    data.daily.forEach((day, index) => {
      const barWidth = column * .72;
      const barHeight = day.clicks / maximum * plotHeight;
      const x = plotX + column * index + (column - barWidth) / 2;
      const barY = plotY + plotHeight - barHeight;
      if (barHeight) {
        doc.saveGraphicsState();
        const radius = Math.min(1, barWidth / 2, barHeight / 2);
        doc.roundedRect(x, barY, barWidth, barHeight, radius, radius, null); doc.clip(); doc.discardPath();
        for (let band = 0; band < 24; band++) {
          const fraction = band / 23;
          doc.setFillColor(Math.round(155 + (22 - 155) * fraction), Math.round(221 + (130 - 221) * fraction), Math.round(96 + (92 - 96) * fraction));
          doc.rect(x, barY + barHeight * band / 24, barWidth, barHeight / 24 + .02, 'F');
        }
        doc.restoreGraphicsState();
      }
      if (index % labelEvery === 0 && index < data.daily.length - 2 || index === data.daily.length - 1) {
        doc.setFontSize(7); doc.setTextColor(100, 109, 101);
        const labelX = index === 0 ? plotX : index === data.daily.length - 1 ? plotX + plotWidth : plotX + column * (index + .5);
        doc.text(dailyDate(day.date), labelX, plotY + plotHeight + 6, { align: index === 0 ? 'left' : index === data.daily.length - 1 ? 'right' : 'center' });
      }
    });
    if (!data.daily.some(day => day.clicks)) { doc.setFontSize(9); doc.text('No visits in this period.', plotX + plotWidth / 2, plotY + plotHeight / 2, { align: 'center' }); }
    y += 98;
  }
  if (sections.table) {
    if (y + 35 > height - MARGIN) nextPage();
    doc.setFontSize(12); doc.setTextColor(36, 44, 37); doc.text('Daily breakdown', MARGIN, y);
    const total = data.daily.reduce((sum, day) => sum + day.clicks, 0);
    autoTable(doc, { startY: y + 7, margin: MARGIN,
      head: [['Date (Asia/Bangkok)', 'Visits', 'Share (%)']],
      body: data.daily.map(day => [day.date, String(day.clicks), total ? (day.clicks / total * 100).toFixed(1) : '0.0']),
      foot: [['Period total', String(total), total ? '100.0' : '0.0']], showFoot: 'lastPage',
      styles: { font: 'Report', fontStyle: 'normal', fontSize: 9, cellPadding: 2.2 },
      headStyles: { fontStyle: 'normal', fillColor: [25, 125, 107], textColor: [255, 255, 255] },
      footStyles: { fontStyle: 'normal', fillColor: [235, 243, 236], textColor: [36, 44, 37] },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    });
  }
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page); doc.setFont('Report', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 109, 101);
    doc.text(`Qlean | ${page} / ${pageCount}`, width - MARGIN, height - 7, { align: 'right' });
  }
  return doc.output('blob');
}

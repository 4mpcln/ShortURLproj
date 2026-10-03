import { Download, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { StatisticsResponseData } from '../../api/generated/shortUrl';
import { downloadStatisticsFile } from '../../lib/statisticsExport';
import { Modal } from '../ui/modal';
import './statistics-export.css';

export function StatisticsPdfModal({ data, periodLabel, onClose }: { data: StatisticsResponseData; periodLabel: string; onClose: () => void }) {
  const [chart, setChart] = useState(true);
  const [table, setTable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(false);
  const pending = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current || (!chart && !table)) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const { createStatisticsPdf } = await import('../../lib/statisticsExportPdf');
      const blob = await createStatisticsPdf(data, periodLabel, { chart, table });
      if (!mounted.current) return;
      downloadStatisticsFile(blob, `qlean-${data.item.code}-statistics.pdf`);
      onClose();
    } catch { if (mounted.current) setError('Could not create the PDF. Please try again.'); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  return <Modal title="Download PDF" busy={busy} onClose={onClose}>
    <form className="statistics-pdf-form" onSubmit={submit}>
      <fieldset disabled={busy}><legend>Include</legend>
        <label><input type="checkbox" checked={chart} onChange={event => setChart(event.target.checked)} />Graph</label>
        <label><input type="checkbox" checked={table} onChange={event => setTable(event.target.checked)} />Daily table</label>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <footer><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="shared-modal__primary" type="submit" disabled={busy || (!chart && !table)}>{busy ? <LoaderCircle size={18} className="spin" /> : <Download size={18} />}{busy ? 'Creating PDF...' : 'Download PDF'}</button></footer>
    </form>
  </Modal>;
}

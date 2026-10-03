import { FileSpreadsheet, FileText } from 'lucide-react';
import './statistics-export.css';

export function StatisticsExportButtons({ disabled, onCsv, onPdf }: { disabled: boolean; onCsv: () => void; onPdf: () => void }) {
  return <div className="statistics-export-buttons" role="group" aria-label="Download statistics">
    <button type="button" disabled={disabled} onClick={onCsv}><FileSpreadsheet size={16} aria-hidden="true" />Download CSV</button>
    <button type="button" disabled={disabled} onClick={onPdf}><FileText size={16} aria-hidden="true" />Download PDF</button>
  </div>;
}

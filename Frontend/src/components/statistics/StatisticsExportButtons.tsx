import { FileSpreadsheet, FileText } from 'lucide-react';
import { Tooltip } from '../ui/tooltip';
import './statistics-export.css';

export function StatisticsExportButtons({ disabled, onCsv, onPdf }: { disabled: boolean; onCsv: () => void; onPdf: () => void }) {
  return <div className="statistics-export-buttons" role="group" aria-label="Download statistics">
    <Tooltip text="Download CSV"><button type="button" aria-label="Download CSV" disabled={disabled} onClick={onCsv}><FileSpreadsheet size={16} aria-hidden="true" /><span className="statistics-export-buttons__label">Download CSV</span></button></Tooltip>
    <Tooltip text="Download PDF"><button type="button" aria-label="Download PDF" disabled={disabled} onClick={onPdf}><FileText size={16} aria-hidden="true" /><span className="statistics-export-buttons__label">Download PDF</span></button></Tooltip>
  </div>;
}

import { buildDatePreset, type DatePreset } from "../../utils/datePresets";

export const DATE_RANGE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "last365", label: "Last 365 days" },
  { value: "lastMonth", label: "Last month" },
  { value: "lastYear", label: "Last year" }
];

export function matchDatePreset(dateStart: string, dateEnd: string): DatePreset | null {
  for (const { value } of DATE_RANGE_PRESETS) {
    const { start, end } = buildDatePreset(value);
    if (start === dateStart && end === dateEnd) return value;
  }
  return null;
}

export function formatDateRangeLabel(dateStart: string, dateEnd: string): string {
  if (!dateStart && !dateEnd) return "All time";
  if (dateStart && dateEnd) return `${dateStart} – ${dateEnd}`;
  return dateStart ? `From ${dateStart}` : `Until ${dateEnd}`;
}

type DateRangeDropdownProps = {
  dateStart: string;
  dateEnd: string;
  onPreset: (preset: string) => void;
  onRangeChange: (start: string, end: string) => void;
};

export default function DateRangeDropdown({ dateStart, dateEnd, onPreset, onRangeChange }: DateRangeDropdownProps) {
  return (
    <div>
      <div className="btn-group btn-group-sm w-100 flex-wrap mb-2" role="group">
        {DATE_RANGE_PRESETS.map(({ value, label }) => (
          <button key={value} type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onPreset(value)}>{label}</button>
        ))}
      </div>
      <div className="small text-muted mb-1">Custom range</div>
      <div className="row g-1">
        <div className="col-6"><input type="date" className="form-control form-control-sm" value={dateStart} onChange={e => onRangeChange(e.target.value, dateEnd)} /></div>
        <div className="col-6"><input type="date" className="form-control form-control-sm" value={dateEnd} onChange={e => onRangeChange(dateStart, e.target.value)} /></div>
      </div>
    </div>
  );
}

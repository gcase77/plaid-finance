import { DATE_RANGE_PRESETS } from "./dateRangeUtils";

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

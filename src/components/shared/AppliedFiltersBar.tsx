type FilterChip = { id: string; label: string; onClear: () => void };

type AppliedFiltersBarProps = {
  chips: FilterChip[];
  onClearAll: () => void;
  operator?: "and" | "or";
};

export default function AppliedFiltersBar({ chips, onClearAll, operator = "and" }: AppliedFiltersBarProps) {
  if (!chips.length) return null;
  const sep = operator === "or" ? "||" : "&";
  return (
    <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
      <span className="small text-muted">Filters:</span>
      {chips.map(({ id, label, onClear }, i) => (
        <>
          {i > 0 && <span key={`sep-${id}`} className="small text-muted fw-semibold">{sep}</span>}
          <span key={id} className="badge bg-secondary d-inline-flex align-items-center gap-1">
            {label}
            <button type="button" className="border-0 bg-transparent text-white p-0 ms-1" style={{ fontSize: "1rem", lineHeight: 1 }} aria-label="Remove" onClick={onClear}>×</button>
          </span>
        </>
      ))}
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClearAll}>Clear all</button>
    </div>
  );
}

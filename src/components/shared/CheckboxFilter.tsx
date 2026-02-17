type CheckboxFilterProps<T extends string> = {
  label?: string;
  options: T[] | Array<[T, string]>;
  selected: T[];
  onChange: (selected: T[]) => void;
};

export default function CheckboxFilter<T extends string>({ label, options, selected, onChange }: CheckboxFilterProps<T>) {
  const normalizedOptions: Array<[T, string]> = options.map(opt => 
    Array.isArray(opt) ? opt : [opt, opt]
  );
  
  const handleSelectAll = () => onChange(normalizedOptions.map(([id]) => id));
  const handleSelectNone = () => onChange([]);
  const handleToggle = (id: T, checked: boolean) => {
    onChange(checked ? [...selected, id] : selected.filter(x => x !== id));
  };

  return (
    <div>
      {label && <label className="form-label mb-1">{label} ({selected.length})</label>}
      <div className="border rounded p-2" style={{ maxHeight: 150, overflowY: "auto" }}>
        <div className="d-flex gap-2 mb-1">
          <button className="btn btn-outline-secondary btn-sm" onClick={handleSelectAll}>All</button>
          <button className="btn btn-outline-secondary btn-sm" onClick={handleSelectNone}>None</button>
        </div>
        {normalizedOptions.map(([id, displayLabel]) => (
          <label className="form-check d-block" key={id}>
            <input 
              className="form-check-input" 
              type="checkbox" 
              checked={selected.includes(id)} 
              onChange={(e) => handleToggle(id, e.target.checked)} 
            />
            {" "}
            <span className="form-check-label">{displayLabel}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

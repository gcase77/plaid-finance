import { useState } from "react";

type FilterSectionProps = {
  label: string;
  summary: string;
  children: React.ReactNode;
};

export default function FilterSection({ label, summary, children }: FilterSectionProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-2 border rounded">
      <button
        type="button"
        className="btn btn-sm w-100 text-start d-flex justify-content-between align-items-center"
        onClick={() => setOpen(o => !o)}
      >
        <span className="fw-semibold fs-6">{label}</span>
        <span className="text-muted small">{summary}</span>
      </button>
      {open && <div className="p-2 border-top">{children}</div>}
    </div>
  );
}

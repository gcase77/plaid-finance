import type { ReactNode } from "react";
import type { UseTransactionFiltersReturn } from "../../hooks/useTransactionFilters";
import { getDisplayTagColor, getTextColorForBackground } from "../../utils/transactionUtils";
import type { Tag } from "../types";
import { DATE_RANGE_PRESETS, formatDateRangeLabel } from "./dateRangeUtils";

type Props = { filters: UseTransactionFiltersReturn; tags: Tag[] };
type Segment<T extends string> = { value: T; label: string };

const tagRank = (type: Tag["type"]) => (type === "meta" ? 0 : type.startsWith("spending") ? 1 : 2);

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Segment<T>[]; onChange: (v: T) => void }) {
  return (
    <div className="pill-tabs" role="group">
      {options.map((opt) => (
        <button key={opt.value} type="button" className={`btn btn-sm ${value === opt.value ? "active" : ""}`} onClick={() => onChange(opt.value)}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="form-label small fw-semibold mb-1">{label}</label>
      {children}
    </div>
  );
}

function Multi<T extends string | number>({
  label,
  options,
  selected,
  onChange,
  empty = "No options"
}: {
  label: string;
  options: Array<[T, ReactNode]>;
  selected: T[];
  onChange: (next: T[]) => void;
  empty?: string;
}) {
  const toggle = (id: T, checked: boolean) => onChange(checked ? [...selected, id] : selected.filter((x) => x !== id));
  return (
    <Field label={`${label} (${selected.length})`}>
      <div className="cluster mb-1">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onChange(options.map(([id]) => id))}>All</button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onChange([])}>None</button>
      </div>
      <div className="check-list">
        {options.length === 0 ? <span className="small text-muted">{empty}</span> : options.map(([id, node]) => (
          <label key={String(id)} className="form-check small mb-1">
            <input className="form-check-input" type="checkbox" checked={selected.includes(id)} onChange={(e) => toggle(id, e.target.checked)} />{" "}
            <span className="form-check-label">{node}</span>
          </label>
        ))}
      </div>
    </Field>
  );
}

function TagBadge({ tag }: { tag: Tag }) {
  const color = getDisplayTagColor(tag.type, tag.color);
  return <span className="badge" style={{ backgroundColor: color, color: getTextColorForBackground(color), border: "1px solid rgba(0,0,0,.12)" }}>{tag.name}</span>;
}

function CategoryPicker({ filters }: { filters: UseTransactionFiltersReturn }) {
  const { state, actions, derived } = filters;
  const all = derived.options.categoryOptionsByPrimary.flatMap((g) => g.options.map((o) => o.value));
  const selected = new Set(state.selectedCategories);
  const toggle = (value: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(value); else next.delete(value);
    actions.setSelectedCategories([...next]);
  };
  return (
    <Field label={`Detected (${state.selectedCategories.length})`}>
      <div className="cluster mb-1">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => actions.setSelectedCategories([...new Set(all)])}>All</button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => actions.setSelectedCategories([])}>None</button>
      </div>
      <div className="check-list" style={{ maxHeight: 220 }}>
        {derived.options.categoryOptionsByPrimary.length === 0 ? <span className="small text-muted">No detected categories</span> : derived.options.categoryOptionsByPrimary.map((group) => (
          <div key={group.primary} className="mb-2">
            <div className="small fw-semibold">{group.primaryLabel}</div>
            {group.options.map((opt) => (
              <label key={opt.value} className="form-check small ms-2 mb-1">
                <input className="form-check-input" type="checkbox" checked={selected.has(opt.value)} onChange={(e) => toggle(opt.value, e.target.checked)} />{" "}
                <span className="form-check-label">{opt.label}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </Field>
  );
}

export default function TransactionsFilterSection({ filters, tags }: Props) {
  const { state, actions, derived } = filters;
  const sortedTags = [...tags].sort((a, b) => tagRank(a.type) - tagRank(b.type) || a.name.localeCompare(b.name));
  const amountLabel = state.amountMin || state.amountMax ? `${state.amountMin || "-∞"} to ${state.amountMax || "∞"}` : "Any amount";

  return (
    <section className="surface-card p-3 filters-card">
      <div className="split">
        <div>
          <h2 className="h5 mb-1">Filters</h2>
          <p className="small text-muted mb-0">{formatDateRangeLabel(state.dateStart, state.dateEnd)} / {amountLabel}</p>
        </div>
        <Segmented value={state.filterOperator} onChange={actions.setFilterOperator} options={[{ value: "and", label: "AND" }, { value: "or", label: "OR" }]} />
      </div>

      <div className="filter-grid">
        <Field label="Name">
          <Segmented value={state.nameMode as "contains" | "not"} onChange={actions.setNameMode} options={[{ value: "contains", label: "Has" }, { value: "not", label: "Not" }]} />
          <input className="form-control form-control-sm mt-2" value={state.nameFilter} onChange={(e) => actions.setNameFilter(e.target.value)} placeholder="Search name" />
        </Field>
        <Field label="Merchant">
          <Segmented value={state.merchantMode} onChange={actions.setMerchantMode} options={[{ value: "contains", label: "Has" }, { value: "not", label: "Not" }, { value: "null", label: "Blank" }]} />
          <input className="form-control form-control-sm mt-2" value={state.merchantFilter} onChange={(e) => actions.setMerchantFilter(e.target.value)} disabled={state.merchantMode === "null"} placeholder="Search merchant" />
        </Field>
      </div>

      <Field label="Date range">
        <div className="cluster mb-2">
          {DATE_RANGE_PRESETS.map((preset) => (
            <button key={preset.value} type="button" className="btn btn-sm btn-outline-secondary" onClick={() => actions.applyDatePreset(preset.value)}>{preset.label}</button>
          ))}
        </div>
        <div className="filter-grid">
          <input type="date" className="form-control form-control-sm" value={state.dateStart} onChange={(e) => actions.setDateStart(e.target.value)} />
          <input type="date" className="form-control form-control-sm" value={state.dateEnd} onChange={(e) => actions.setDateEnd(e.target.value)} />
        </div>
      </Field>

      <div className="filter-grid">
        <Field label="Min amount">
          <input type="number" step="any" className="form-control form-control-sm" value={state.amountMin} onChange={(e) => actions.setAmountMin(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Max amount">
          <input type="number" step="any" className="form-control form-control-sm" value={state.amountMax} onChange={(e) => actions.setAmountMax(e.target.value)} placeholder="0" />
        </Field>
      </div>
      <div className="cluster">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { actions.setAmountMin("0"); actions.setAmountMax(""); }}>Outflows</button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { actions.setAmountMin(""); actions.setAmountMax("0"); }}>Inflows</button>
      </div>

      <Multi label="Banks" options={derived.options.bankOptions} selected={state.selectedBanks} onChange={actions.setSelectedBanks} empty="No banks" />
      <Multi label="Accounts" options={derived.options.accountOptions} selected={state.selectedAccounts} onChange={actions.setSelectedAccounts} empty="No accounts" />
      <Field label={`Tags (${state.selectedTagIds.length})`}>
        <div className="cluster mb-1">
          <button type="button" className={`btn btn-sm ${state.tagStateFilter === "untagged" ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => { actions.setTagStateFilter("untagged"); actions.setSelectedTagIds([]); }}>Untagged</button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { actions.setTagStateFilter("all"); actions.setSelectedTagIds([]); }}>Any</button>
        </div>
        <Multi
          label="Specific tags"
          options={sortedTags.map((tag) => [tag.id, <TagBadge key={tag.id} tag={tag} />])}
          selected={state.selectedTagIds}
          onChange={(ids) => { actions.setTagStateFilter("all"); actions.setSelectedTagIds(ids); }}
          empty="No tags"
        />
      </Field>
      <CategoryPicker filters={filters} />
      <button className="btn btn-outline-secondary w-100" onClick={actions.clearAllFilters}>Clear filters</button>
    </section>
  );
}

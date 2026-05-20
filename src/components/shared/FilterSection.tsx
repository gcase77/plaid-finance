import type { UseTransactionFiltersReturn } from "../../hooks/useTransactionFilters";
import type { Tag } from "../types";
import { DATE_RANGE_PRESETS, formatDateRangeLabel } from "./dateRangeUtils";
import { Segmented } from "./ui";
import { TagBadge } from "./TagBadge";

type Props = { filters: UseTransactionFiltersReturn; tags: Tag[] };

const tagRank = (type: Tag["type"]) => (type === "meta" ? 0 : type.startsWith("spending") ? 1 : 2);

function Section({ label, summary, children, open }: { label: string; summary: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="collapse" {...(open ? { open: true } : {})}>
      <summary>
        <span className="fw-semi">{label}</span>
        <span className="muted small" style={{ marginLeft: "auto" }}>{summary}</span>
      </summary>
      <div className="content">{children}</div>
    </details>
  );
}

function CheckList<T extends string | number>({
  label, options, selected, onChange, tertiary, render
}: {
  label?: string;
  options: T[] | Array<[T, React.ReactNode]>;
  selected: T[];
  onChange: (v: T[]) => void;
  tertiary?: { label: string; onClick: () => void; active?: boolean };
  render?: (val: T) => React.ReactNode;
}) {
  const norm: Array<[T, React.ReactNode]> = options.map((o) => Array.isArray(o) ? o as [T, React.ReactNode] : [o as T, render ? render(o as T) : String(o)] as [T, React.ReactNode]);
  const all = () => onChange(norm.map(([id]) => id));
  const none = () => onChange([]);
  const toggle = (id: T, c: boolean) => onChange(c ? [...selected, id] : selected.filter((x) => x !== id));
  return (
    <div className="col-flex" style={{ gap: 6 }}>
      {label && <div className="xs muted fw-semi">{label} ({selected.length})</div>}
      <div className="row-flex gap-2">
        <button className="btn ghost btn-sm" onClick={all}>All</button>
        <button className="btn ghost btn-sm" onClick={none}>None</button>
        {tertiary && <button className={`btn ${tertiary.active ? "primary" : "ghost"} btn-sm`} onClick={tertiary.onClick}>{tertiary.label}</button>}
      </div>
      <div className="scrollbox" style={{ border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: 8 }}>
        {norm.map(([id, displayLabel]) => (
          <label key={id} className="check" style={{ display: "flex", padding: "3px 0" }}>
            <input type="checkbox" checked={selected.includes(id)} onChange={(e) => toggle(id, e.target.checked)} />
            <span>{displayLabel}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function TransactionsFilterSection({ filters, tags }: Props) {
  const { state, actions, derived } = filters;
  const sortedTags = [...tags].sort((a, b) => tagRank(a.type) - tagRank(b.type) || a.name.localeCompare(b.name));

  const hasMin = state.amountMin.trim() !== "";
  const hasMax = state.amountMax.trim() !== "";
  const searchSummary = `${state.nameFilter.trim() ? `name: ${state.nameMode === "not" ? "≠" : "∋"}` : "any"}, ${
    state.merchantMode === "null" ? "merchant: unspecified" : state.merchantFilter.trim() ? `merchant: ${state.merchantMode === "not" ? "≠" : "∋"}` : "any"
  }`;
  const amountSummary = hasMin && hasMax ? `${state.amountMin}–${state.amountMax}` : hasMin ? `≥ ${state.amountMin}` : hasMax ? `≤ ${state.amountMax}` : "any";
  const sourceSummary = `${state.selectedBanks.length || "any"} bank, ${state.selectedAccounts.length || "any"} acct`;
  const tagSummaryParts: string[] = [];
  if (state.tagStateFilter === "untagged") tagSummaryParts.push("untagged");
  else if (state.selectedTagIds.length) tagSummaryParts.push(`${state.selectedTagIds.length} tag${state.selectedTagIds.length === 1 ? "" : "s"}`);
  if (state.missingTagFilter === "no_meta") tagSummaryParts.push("no meta");
  if (state.missingTagFilter === "no_income") tagSummaryParts.push("no income");
  if (state.missingTagFilter === "no_spending") tagSummaryParts.push("no spending");
  const tagSum = tagSummaryParts.length ? tagSummaryParts.join(", ") : "any";
  const catSum = state.selectedCategories.length ? `${state.selectedCategories.length} detected` : "any";

  return (
    <div className="card card-tight col-flex" style={{ gap: 8, minWidth: 0 }}>
      <div className="between">
        <h3>Filters</h3>
        <Segmented value={state.filterOperator} onChange={actions.setFilterOperator} options={[{ value: "and", label: "AND" }, { value: "or", label: "OR" }]} />
      </div>

      <Section label="Search" summary={searchSummary}>
        <div className="col-flex" style={{ gap: 10 }}>
          <div className="field">
            <label>Name</label>
            <Segmented value={state.nameMode === "null" ? "contains" : state.nameMode} onChange={(v) => actions.setNameMode(v)} options={[{ value: "contains", label: "Contains" }, { value: "not", label: "Not" }]} />
            <input className="input input-sm" value={state.nameFilter} onChange={(e) => actions.setNameFilter(e.target.value)} placeholder="Search name" />
          </div>
          <div className="field">
            <label>Merchant</label>
            <Segmented value={state.merchantMode} onChange={actions.setMerchantMode} options={[{ value: "contains", label: "Contains" }, { value: "not", label: "Not" }, { value: "null", label: "Unspecified" }]} />
            <input className="input input-sm" value={state.merchantFilter} onChange={(e) => actions.setMerchantFilter(e.target.value)} placeholder="Search merchant" disabled={state.merchantMode === "null"} />
          </div>
        </div>
      </Section>

      <Section label="Date range" summary={formatDateRangeLabel(state.dateStart, state.dateEnd)}>
        <div className="row-flex flex-wrap gap-2 mb-3">
          {DATE_RANGE_PRESETS.map(({ value, label }) => (
            <button key={value} className="btn ghost btn-sm" onClick={() => actions.applyDatePreset(value)}>{label}</button>
          ))}
        </div>
        <div className="col-flex gap-2">
          <input type="date" className="input input-sm" style={{ minWidth: 0 }} value={state.dateStart} onChange={(e) => actions.setDateStart(e.target.value)} />
          <input type="date" className="input input-sm" style={{ minWidth: 0 }} value={state.dateEnd} onChange={(e) => actions.setDateEnd(e.target.value)} />
        </div>
      </Section>

      <Section label="Amount" summary={amountSummary}>
        <div className="row-flex gap-2 mb-3">
          <div className="flex-fill">
            <div className="xs muted fw-semi mb-1">Min</div>
            <input type="number" className="input input-sm" value={state.amountMin} onChange={(e) => actions.setAmountMin(e.target.value)} placeholder="0" />
          </div>
          <div className="flex-fill">
            <div className="xs muted fw-semi mb-1">Max</div>
            <input type="number" className="input input-sm" value={state.amountMax} onChange={(e) => actions.setAmountMax(e.target.value)} placeholder="0" />
          </div>
        </div>
        <Segmented
          value={state.amountMax.trim() === "0" && !state.amountMin.trim() ? "income" : state.amountMin.trim() === "0" && !state.amountMax.trim() ? "spending" : ""}
          onChange={(v) => {
            if (v === "spending") { actions.setAmountMin("0"); actions.setAmountMax(""); }
            else if (v === "income") { actions.setAmountMin(""); actions.setAmountMax("0"); }
            else { actions.setAmountMin(""); actions.setAmountMax(""); }
          }}
          options={[{ value: "", label: "Both" }, { value: "spending", label: "Outflow" }, { value: "income", label: "Inflow" }]}
        />
      </Section>

      <Section label="Source" summary={sourceSummary}>
        <div className="col-flex" style={{ gap: 12 }}>
          <CheckList label="Bank" options={derived.options.bankOptions} selected={state.selectedBanks} onChange={actions.setSelectedBanks} />
          <CheckList label="Account" options={derived.options.accountOptions} selected={state.selectedAccounts} onChange={actions.setSelectedAccounts} />
        </div>
      </Section>

      <Section label="Category" summary={`${tagSum}, ${catSum}`}>
        <div className="col-flex" style={{ gap: 12 }}>
          <CheckList
            label="Tags"
            options={sortedTags.map((tag) => [tag.id, <TagBadge key={tag.id} tag={tag} />] as [number, React.ReactNode])}
            selected={state.selectedTagIds}
            onChange={(ids) => { actions.setTagStateFilter("all"); actions.setSelectedTagIds(ids); }}
            tertiary={{ label: "Untagged", active: state.tagStateFilter === "untagged", onClick: () => { actions.setTagStateFilter("untagged"); actions.setSelectedTagIds([]); } }}
          />
          <div className="col-flex" style={{ gap: 6 }}>
            <div className="xs muted fw-semi">Missing tags</div>
            <div className="row-flex flex-wrap gap-2">
              <button className={`btn ${state.missingTagFilter === "no_meta" ? "primary" : "ghost"} btn-sm`} onClick={() => actions.setMissingTagFilter(state.missingTagFilter === "no_meta" ? "all" : "no_meta")}>No meta</button>
              <button className={`btn ${state.missingTagFilter === "no_income" ? "primary" : "ghost"} btn-sm`} onClick={() => actions.setMissingTagFilter(state.missingTagFilter === "no_income" ? "all" : "no_income")}>No income</button>
              <button className={`btn ${state.missingTagFilter === "no_spending" ? "primary" : "ghost"} btn-sm`} onClick={() => actions.setMissingTagFilter(state.missingTagFilter === "no_spending" ? "all" : "no_spending")}>No spending</button>
            </div>
          </div>
          <div className="col-flex" style={{ gap: 6 }}>
            <div className="xs muted fw-semi">Detected ({state.selectedCategories.length})</div>
            <div className="row-flex gap-2">
              <button className="btn ghost btn-sm" onClick={() => actions.setSelectedCategories([...new Set(derived.options.categoryOptionsByPrimary.flatMap((g) => g.options.map((o) => o.value)))])}>All</button>
              <button className="btn ghost btn-sm" onClick={() => actions.setSelectedCategories([])}>None</button>
            </div>
            <div className="scrollbox" style={{ border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: 8 }}>
              {derived.options.categoryOptionsByPrimary.map((group) => {
                const groupVals = group.options.map((o) => o.value);
                const all = groupVals.length > 0 && groupVals.every((v) => state.selectedCategories.includes(v));
                return (
                  <div key={group.primary} style={{ marginBottom: 4 }}>
                    <label className="check fw-semi" style={{ display: "flex" }}>
                      <input type="checkbox" checked={all} onChange={(e) => actions.setSelectedCategories(e.target.checked ? [...new Set([...state.selectedCategories, ...groupVals])] : state.selectedCategories.filter((v) => !groupVals.includes(v)))} />
                      <span>{group.primaryLabel}</span>
                    </label>
                    <div style={{ paddingLeft: 18 }}>
                      {group.options.map((opt) => (
                        <label key={opt.value} className="check" style={{ display: "flex", padding: "2px 0" }}>
                          <input type="checkbox" checked={state.selectedCategories.includes(opt.value)} onChange={(e) => actions.setSelectedCategories(e.target.checked ? [...state.selectedCategories, opt.value] : state.selectedCategories.filter((v) => v !== opt.value))} />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      <button className="btn ghost btn-block mt-2" onClick={actions.clearAllFilters}>Clear all filters</button>
    </div>
  );
}

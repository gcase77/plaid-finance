import { ACCOUNT_TRANSFER_TAG_ID, type UseTransactionFiltersReturn } from "../../hooks/useTransactionFilters";
import type { Tag } from "../types";
import { getDisplayTagColor, getTextColorForBackground } from "../../utils/transactionUtils";

type Props = { filters: UseTransactionFiltersReturn; tags: Tag[] };

const tagRank = (type: Tag["type"]) => (type === "meta" ? 0 : type.startsWith("spending") ? 1 : 2);

const toInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const DATE_PRESETS: { value: string; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "last7", label: "Last 7 days" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "thisYear", label: "This year" },
];

function formatDateRangeLabel(dateStart: string, dateEnd: string): string {
  if (!dateStart && !dateEnd) return "All time";
  if (dateStart && dateEnd) return `${dateStart} – ${dateEnd}`;
  return dateStart ? `From ${dateStart}` : `Until ${dateEnd}`;
}

function TagBadge({ tag }: { tag: Tag }) {
  const color = getDisplayTagColor(tag.type, tag.color);
  return <span className="tag-badge" style={{ background: color, color: getTextColorForBackground(color) }}>{tag.name}</span>;
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }> }) {
  return (
    <div className="segmented" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" className={value === o.value ? "active" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Section({ label, summary, children }: { label: string; summary: string; children: React.ReactNode }) {
  return (
    <details className="collapse">
      <summary>
        <span className="fw-semi">{label}</span>
        <span className="muted small" style={{ marginLeft: "auto" }}>{summary}</span>
      </summary>
      <div className="content">{children}</div>
    </details>
  );
}

function CheckList<T extends string | number>({
  label, options, selected, onChange,
}: {
  label?: string;
  options: T[] | Array<[T, React.ReactNode]>;
  selected: T[];
  onChange: (v: T[]) => void;
}) {
  const norm: Array<[T, React.ReactNode]> = options.map((o) => Array.isArray(o) ? o as [T, React.ReactNode] : [o as T, String(o)] as [T, React.ReactNode]);
  return (
    <div className="col-flex" style={{ gap: 6 }}>
      {label && <div className="xs muted fw-semi">{label} ({selected.length})</div>}
      <div className="row-flex gap-2">
        <button className="btn ghost btn-sm" onClick={() => onChange(norm.map(([id]) => id))}>All</button>
        <button className="btn ghost btn-sm" onClick={() => onChange([])}>None</button>
      </div>
      <div className="scrollbox" style={{ border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: 8 }}>
        {norm.map(([id, displayLabel]) => (
          <label key={id} className="check" style={{ display: "flex", alignItems: "center", padding: "3px 0" }}>
            <input type="checkbox" style={{ flexShrink: 0 }} checked={selected.includes(id)} onChange={(e) => onChange(e.target.checked ? [...selected, id] : selected.filter((x) => x !== id))} />
            <span>{displayLabel}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function LandingFilterSection({ filters, tags }: Props) {
  const { state, actions, derived } = filters;
  const sortedTags = [...tags]
    .filter((t) => t.id !== ACCOUNT_TRANSFER_TAG_ID)
    .sort((a, b) => tagRank(a.type) - tagRank(b.type) || a.name.localeCompare(b.name));
  const tagOptions: Array<[number, React.ReactNode]> = [
    ...sortedTags.map((tag) => [tag.id, <TagBadge key={tag.id} tag={tag} />] as [number, React.ReactNode]),
    [ACCOUNT_TRANSFER_TAG_ID, <span key="tx" className="tag-badge" style={{ background: "var(--ink)", color: "var(--surface)", borderColor: "transparent" }}>account_transfer</span>],
  ];

  const hasMin = state.amountMin.trim() !== "";
  const hasMax = state.amountMax.trim() !== "";
  const amountSummary = hasMin && hasMax ? `${state.amountMin}–${state.amountMax}` : hasMin ? `≥ ${state.amountMin}` : hasMax ? `≤ ${state.amountMax}` : "any";
  const sourceSummary = `${state.selectedAccounts.length || "any"} acct`;
  const tagSummaryParts: string[] = [];
  if (state.selectedTagIds.length) tagSummaryParts.push(`${state.selectedTagIds.length} tag${state.selectedTagIds.length === 1 ? "" : "s"}`);
  const tagSum = tagSummaryParts.length ? tagSummaryParts.join(", ") : "any";

  const applyPreset = (value: string) => {
    if (value === "thisMonth") {
      const now = new Date();
      actions.setDateStart(toInput(new Date(now.getFullYear(), now.getMonth(), 1)));
      actions.setDateEnd(toInput(now));
      return;
    }
    actions.applyDatePreset(value);
  };

  return (
    <div className="card card-tight col-flex" style={{ gap: 8, minWidth: 0 }}>
      <Section label="Date range" summary={formatDateRangeLabel(state.dateStart, state.dateEnd)}>
        <div className="row-flex flex-wrap gap-2 mb-3">
          {DATE_PRESETS.map(({ value, label }) => (
            <button key={value} className="btn ghost btn-sm" onClick={() => applyPreset(value)}>{label}</button>
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
          options={[{ value: "spending", label: "Outflow" }, { value: "income", label: "Inflow" }]}
        />
      </Section>

      <Section label="Account" summary={sourceSummary}>
        <CheckList options={derived.options.accountOptions} selected={state.selectedAccounts} onChange={actions.setSelectedAccounts} />
      </Section>

      <Section label="Category" summary={tagSum}>
        <CheckList
          label="Tags"
          options={tagOptions}
          selected={state.selectedTagIds}
          onChange={(ids) => { actions.setTagStateFilter("all"); actions.setSelectedTagIds(ids); }}
        />
      </Section>

      <button className="btn ghost btn-block mt-2" onClick={actions.clearAllFilters}>Clear all filters</button>
    </div>
  );
}

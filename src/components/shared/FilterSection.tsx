import { useState } from "react";
import type { UseTransactionFiltersReturn } from "../../hooks/useTransactionFilters";
import { DATE_RANGE_PRESETS, formatDateRangeLabel } from "./dateRangeUtils";

type TransactionsFilterSectionProps = {
  filters: UseTransactionFiltersReturn;
};

type SegmentOption<T extends string> = { value: T; label: string };

function FilterAccordionSection({
  label,
  summary,
  children
}: {
  label: string;
  summary: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-2 border rounded">
      <button
        type="button"
        className="btn btn-sm w-100 text-start d-flex justify-content-between align-items-center"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="fw-semibold fs-6">{label}</span>
        <span className="text-muted small">{summary}</span>
      </button>
      {open && <div className="p-2 border-top">{children}</div>}
    </div>
  );
}

function SegmentedButtons<T extends string>({
  value,
  onChange,
  options
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentOption<T>[];
}) {
  return (
    <div className="btn-group btn-group-sm" role="group" style={{ fontSize: "0.75rem" }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`btn ${value === opt.value ? "btn-secondary" : "btn-outline-secondary"}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function CheckboxFilter<T extends string>({
  label,
  options,
  selected,
  onChange
}: {
  label: string;
  options: T[] | Array<[T, string]>;
  selected: T[];
  onChange: (selected: T[]) => void;
}) {
  const normalizedOptions: Array<[T, string]> = options.map((opt) =>
    Array.isArray(opt) ? (opt as [T, string]) : ([opt, opt] as [T, string])
  );

  const handleSelectAll = () => onChange(normalizedOptions.map(([id]) => id));
  const handleSelectNone = () => onChange([]);
  const handleToggle = (id: T, checked: boolean) => {
    onChange(checked ? [...selected, id] : selected.filter((x) => x !== id));
  };

  return (
    <div>
      <label className="form-label mb-1">
        {label} ({selected.length})
      </label>
      <div className="border rounded p-2" style={{ maxHeight: 150, overflowY: "auto" }}>
        <div className="d-flex gap-2 mb-1">
          <button className="btn btn-outline-secondary btn-sm" onClick={handleSelectAll}>
            All
          </button>
          <button className="btn btn-outline-secondary btn-sm" onClick={handleSelectNone}>
            None
          </button>
        </div>
        {normalizedOptions.map(([id, displayLabel]) => (
          <label className="form-check d-block" key={id}>
            <input
              className="form-check-input"
              type="checkbox"
              checked={selected.includes(id)}
              onChange={(e) => handleToggle(id, e.target.checked)}
            />{" "}
            <span className="form-check-label">{displayLabel}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function DateRangeDropdown({
  dateStart,
  dateEnd,
  onPreset,
  onRangeChange
}: {
  dateStart: string;
  dateEnd: string;
  onPreset: (preset: string) => void;
  onRangeChange: (start: string, end: string) => void;
}) {
  return (
    <div>
      <div className="btn-group btn-group-sm w-100 flex-wrap mb-2" role="group">
        {DATE_RANGE_PRESETS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => onPreset(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="small text-muted mb-1">Custom range</div>
      <div className="row g-1">
        <div className="col-6">
          <input
            type="date"
            className="form-control form-control-sm"
            value={dateStart}
            onChange={(e) => onRangeChange(e.target.value, dateEnd)}
          />
        </div>
        <div className="col-6">
          <input
            type="date"
            className="form-control form-control-sm"
            value={dateEnd}
            onChange={(e) => onRangeChange(dateStart, e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

export default function TransactionsFilterSection({ filters }: TransactionsFilterSectionProps) {
  const { state, actions, derived } = filters;

  const searchSummary = [
    state.nameFilter.trim() ? `name: ${state.nameMode === "not" ? "not" : "contains"}` : "any",
    state.merchantMode === "null"
      ? "merchant: unspecified"
      : state.merchantFilter.trim()
        ? `merchant: ${state.merchantMode === "not" ? "not" : "contains"}`
        : "any"
  ].join(", ");

  const amountSummary =
    state.amountMode && state.amountFilter.trim() ? `${state.amountMode === "gt" ? ">" : "<"} ${state.amountFilter}` : "any";
  const sourceSummary = `${state.selectedBanks.length ? `${state.selectedBanks.length} bank` : "any"}, ${
    state.selectedAccounts.length ? `${state.selectedAccounts.length} account` : "any"
  }`;
  const categorySummary = state.selectedCategories.length ? `${state.selectedCategories.length} selected` : "any";

  return (
    <>
      <div className="border rounded p-3 mb-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h4 className="mb-0">Filters</h4>
          <div style={{ minWidth: 90, textAlign: "right" }}>
            <SegmentedButtons
              value={state.filterOperator}
              onChange={actions.setFilterOperator}
              options={[
                { value: "and", label: "AND" },
                { value: "or", label: "OR" }
              ]}
            />
          </div>
        </div>

        <FilterAccordionSection label="Search" summary={searchSummary}>
          <div className="mb-3">
            <label className="form-label fw-semibold mb-1">Name</label>
            <div className="mb-2">
              <SegmentedButtons
                value={state.nameMode as "contains" | "not"}
                onChange={(v) => actions.setNameMode(v)}
                options={[
                  { value: "contains", label: "Contains" },
                  { value: "not", label: "Not" }
                ]}
              />
            </div>
            <input
              className="form-control"
              value={state.nameFilter}
              onChange={(e) => actions.setNameFilter(e.target.value)}
              placeholder="Search name"
            />
          </div>

          <div>
            <label className="form-label fw-semibold mb-1">Merchant</label>
            <div className="mb-2">
              <SegmentedButtons
                value={state.merchantMode}
                onChange={actions.setMerchantMode}
                options={[
                  { value: "contains", label: "Contains" },
                  { value: "not", label: "Not" },
                  { value: "null", label: "Unspecified" }
                ]}
              />
            </div>
            <input
              className="form-control"
              value={state.merchantFilter}
              onChange={(e) => actions.setMerchantFilter(e.target.value)}
              placeholder="Search merchant"
              disabled={state.merchantMode === "null"}
            />
          </div>
        </FilterAccordionSection>

        <FilterAccordionSection label="Date range" summary={formatDateRangeLabel(state.dateStart, state.dateEnd)}>
          <DateRangeDropdown
            dateStart={state.dateStart}
            dateEnd={state.dateEnd}
            onPreset={actions.applyDatePreset}
            onRangeChange={(start, end) => {
              actions.setDateStart(start);
              actions.setDateEnd(end);
            }}
          />
        </FilterAccordionSection>

        <FilterAccordionSection label="Amount" summary={amountSummary}>
          <div className="mb-2">
            <SegmentedButtons
              value={state.amountMode || ""}
              onChange={actions.setAmountMode}
              options={[
                { value: "", label: "Any" },
                { value: "gt", label: ">" },
                { value: "lt", label: "<" }
              ]}
            />
          </div>
          <input
            className="form-control mb-2"
            value={state.amountFilter}
            onChange={(e) => actions.setAmountFilter(e.target.value)}
            placeholder="0"
          />
          <SegmentedButtons
            value={state.amountMode === "lt" && state.amountFilter.trim() === "0" ? "income" : "spending"}
            onChange={(v) => {
              if (v === "spending") {
                actions.setAmountMode("gt");
                actions.setAmountFilter("0");
              } else {
                actions.setAmountMode("lt");
                actions.setAmountFilter("0");
              }
            }}
            options={[
              { value: "spending", label: "Spending" },
              { value: "income", label: "Income" }
            ]}
          />
        </FilterAccordionSection>

        <FilterAccordionSection label="Source" summary={sourceSummary}>
          <div className="d-flex flex-column gap-2">
            <CheckboxFilter
              label="Bank"
              options={derived.options.bankOptions}
              selected={state.selectedBanks}
              onChange={actions.setSelectedBanks}
            />
            <CheckboxFilter
              label="Account"
              options={derived.options.accountOptions}
              selected={state.selectedAccounts}
              onChange={actions.setSelectedAccounts}
            />
          </div>
        </FilterAccordionSection>

        <FilterAccordionSection label="Category" summary={categorySummary}>
          <CheckboxFilter
            label="Detected"
            options={derived.options.categoryOptions}
            selected={state.selectedCategories}
            onChange={actions.setSelectedCategories}
          />
        </FilterAccordionSection>

        <button className="btn btn-outline-secondary w-100 mt-2" onClick={actions.clearAllFilters}>
          Clear all filters
        </button>
      </div>
    </>
  );
}

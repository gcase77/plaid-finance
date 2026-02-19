import type { AmountMode, TextMode } from "../types";
import AppliedFiltersBar from "./AppliedFiltersBar";
import FilterSection from "./FilterSection";
import { DATE_RANGE_PRESETS, formatDateRangeLabel } from "./dateRangeUtils";

type FilterChip = { id: string; label: string; onClear: () => void };

type TransactionsFilterSectionProps = {
  clearAllFilters: () => void;
  applyDatePreset: (preset: string) => void;
  nameMode: TextMode;
  setNameMode: (v: TextMode) => void;
  nameFilter: string;
  setNameFilter: (v: string) => void;
  merchantMode: TextMode;
  setMerchantMode: (v: TextMode) => void;
  merchantFilter: string;
  setMerchantFilter: (v: string) => void;
  amountMode: AmountMode;
  setAmountMode: (v: AmountMode) => void;
  amountFilter: string;
  setAmountFilter: (v: string) => void;
  dateStart: string;
  setDateStart: (v: string) => void;
  dateEnd: string;
  setDateEnd: (v: string) => void;
  selectedBanks: string[];
  setSelectedBanks: (v: string[]) => void;
  bankOptions: Array<[string, string]>;
  selectedAccounts: string[];
  setSelectedAccounts: (v: string[]) => void;
  accountOptions: Array<[string, string]>;
  selectedCategories: string[];
  setSelectedCategories: (v: string[]) => void;
  categoryOptions: string[];
  filterOperator: "and" | "or";
  setFilterOperator: (v: "and" | "or") => void;
};

type SegmentOption<T extends string> = { value: T; label: string };

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
    <div className="btn-group w-100 btn-sm" role="group">
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
      <label className="form-label mb-1">{label} ({selected.length})</label>
      <div className="border rounded p-2" style={{ maxHeight: 150, overflowY: "auto" }}>
        <div className="d-flex gap-2 mb-1">
          <button className="btn btn-outline-secondary btn-sm" onClick={handleSelectAll}>All</button>
          <button className="btn btn-outline-secondary btn-sm" onClick={handleSelectNone}>None</button>
        </div>
        {normalizedOptions.map(([id, displayLabel]) => (
          <label className="form-check d-block" key={id}>
            <input className="form-check-input" type="checkbox" checked={selected.includes(id)} onChange={(e) => handleToggle(id, e.target.checked)} />
            {" "}
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
          <button key={value} type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onPreset(value)}>{label}</button>
        ))}
      </div>
      <div className="small text-muted mb-1">Custom range</div>
      <div className="row g-1">
        <div className="col-6"><input type="date" className="form-control form-control-sm" value={dateStart} onChange={(e) => onRangeChange(e.target.value, dateEnd)} /></div>
        <div className="col-6"><input type="date" className="form-control form-control-sm" value={dateEnd} onChange={(e) => onRangeChange(dateStart, e.target.value)} /></div>
      </div>
    </div>
  );
}

export default function TransactionsFilterSection(props: TransactionsFilterSectionProps) {
  const {
    clearAllFilters, applyDatePreset,
    nameMode, setNameMode, nameFilter, setNameFilter,
    merchantMode, setMerchantMode, merchantFilter, setMerchantFilter,
    amountMode, setAmountMode, amountFilter, setAmountFilter,
    dateStart, setDateStart, dateEnd, setDateEnd,
    selectedBanks, setSelectedBanks, bankOptions,
    selectedAccounts, setSelectedAccounts, accountOptions,
    selectedCategories, setSelectedCategories, categoryOptions,
    filterOperator, setFilterOperator
  } = props;

  const searchSummary = [
    nameFilter.trim() ? `name: ${nameMode === "not" ? "not" : "contains"}` : "any",
    merchantMode === "null"
      ? "merchant: unspecified"
      : merchantFilter.trim()
        ? `merchant: ${merchantMode === "not" ? "not" : "contains"}`
        : "any"
  ].join(", ");

  const amountSummary = amountMode && amountFilter.trim() ? `${amountMode === "gt" ? ">" : "<"} ${amountFilter}` : "any";
  const sourceSummary = `${selectedBanks.length ? `${selectedBanks.length} bank` : "any"}, ${selectedAccounts.length ? `${selectedAccounts.length} account` : "any"}`;
  const categorySummary = selectedCategories.length ? `${selectedCategories.length} selected` : "any";

  const filterChips: FilterChip[] = [
    nameFilter.trim() && { id: "name", label: `Name ${nameMode === "not" ? "≠" : "∋"} "${nameFilter}"`, onClear: () => { setNameFilter(""); setNameMode("contains"); } },
    merchantMode === "null" && { id: "merchant-null", label: "Merchant unspecified", onClear: () => setMerchantMode("contains") },
    merchantFilter.trim() && merchantMode !== "null" && { id: "merchant", label: `Merchant ${merchantMode === "not" ? "≠" : "∋"} "${merchantFilter}"`, onClear: () => { setMerchantFilter(""); setMerchantMode("contains"); } },
    amountMode && amountFilter.trim() && { id: "amount", label: `Amount ${amountMode === "gt" ? ">" : "<"} ${amountFilter}`, onClear: () => { setAmountMode(""); setAmountFilter(""); } },
    (dateStart || dateEnd) && { id: "date", label: formatDateRangeLabel(dateStart, dateEnd), onClear: () => { setDateStart(""); setDateEnd(""); } },
    selectedBanks.length > 0 && { id: "banks", label: `Banks: ${selectedBanks.length}`, onClear: () => setSelectedBanks([]) },
    selectedAccounts.length > 0 && { id: "accounts", label: `Accounts: ${selectedAccounts.length}`, onClear: () => setSelectedAccounts([]) },
    selectedCategories.length > 0 && { id: "categories", label: `Detected: ${selectedCategories.length}`, onClear: () => setSelectedCategories([]) }
  ].filter(Boolean) as FilterChip[];

  return (
    <>
      <div className="border rounded p-3 mb-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h4 className="mb-0">Filters</h4>
          <div style={{ minWidth: 140 }}>
            <SegmentedButtons
              value={filterOperator}
              onChange={setFilterOperator}
              options={[{ value: "and", label: "AND" }, { value: "or", label: "OR" }]}
            />
          </div>
        </div>

        <FilterSection label="Search" summary={searchSummary}>
          <div className="mb-3">
            <label className="form-label fw-semibold mb-1">Name</label>
            <div className="mb-2">
              <SegmentedButtons
                value={nameMode as "contains" | "not"}
                onChange={(v) => setNameMode(v)}
                options={[{ value: "contains", label: "Contains" }, { value: "not", label: "Not" }]}
              />
            </div>
            <input className="form-control" value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} placeholder="Search name" />
          </div>

          <div>
            <label className="form-label fw-semibold mb-1">Merchant</label>
            <div className="mb-2">
              <SegmentedButtons
                value={merchantMode}
                onChange={setMerchantMode}
                options={[
                  { value: "contains", label: "Contains" },
                  { value: "not", label: "Not" },
                  { value: "null", label: "Unspecified" }
                ]}
              />
            </div>
            <input className="form-control" value={merchantFilter} onChange={(e) => setMerchantFilter(e.target.value)} placeholder="Search merchant" disabled={merchantMode === "null"} />
          </div>
        </FilterSection>

        <FilterSection label="Date range" summary={formatDateRangeLabel(dateStart, dateEnd)}>
          <DateRangeDropdown
            dateStart={dateStart}
            dateEnd={dateEnd}
            onPreset={applyDatePreset}
            onRangeChange={(start, end) => {
              setDateStart(start);
              setDateEnd(end);
            }}
          />
        </FilterSection>

        <FilterSection label="Amount" summary={amountSummary}>
          <div className="mb-2">
            <SegmentedButtons
              value={amountMode || ""}
              onChange={setAmountMode}
              options={[{ value: "", label: "Any" }, { value: "gt", label: ">" }, { value: "lt", label: "<" }]}
            />
          </div>
          <input className="form-control mb-2" value={amountFilter} onChange={(e) => setAmountFilter(e.target.value)} placeholder="0" />
          <SegmentedButtons
            value={amountMode === "lt" && amountFilter.trim() === "0" ? "income" : "spending"}
            onChange={(v) => {
              if (v === "spending") {
                setAmountMode("gt");
                setAmountFilter("0");
              } else {
                setAmountMode("lt");
                setAmountFilter("0");
              }
            }}
            options={[{ value: "spending", label: "Spending" }, { value: "income", label: "Income" }]}
          />
        </FilterSection>

        <FilterSection label="Source" summary={sourceSummary}>
          <div className="row g-2">
            <div className="col-md-6">
              <CheckboxFilter label="Bank" options={bankOptions} selected={selectedBanks} onChange={setSelectedBanks} />
            </div>
            <div className="col-md-6">
              <CheckboxFilter label="Account" options={accountOptions} selected={selectedAccounts} onChange={setSelectedAccounts} />
            </div>
          </div>
        </FilterSection>

        <FilterSection label="Category" summary={categorySummary}>
          <CheckboxFilter label="Detected" options={categoryOptions} selected={selectedCategories} onChange={setSelectedCategories} />
        </FilterSection>

        <button className="btn btn-outline-secondary w-100 mt-2" onClick={clearAllFilters}>Clear all filters</button>
      </div>

      <AppliedFiltersBar chips={filterChips} onClearAll={clearAllFilters} operator={filterOperator} />
    </>
  );
}

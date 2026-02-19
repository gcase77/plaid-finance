import type { AmountMode, TextMode, Txn } from "./types";
import TransactionTable from "./shared/TransactionTable";
import CheckboxFilter from "./shared/CheckboxFilter";
import DateRangeDropdown from "./shared/DateRangeDropdown";
import AppliedFiltersBar from "./shared/AppliedFiltersBar";
import FilterSection from "./shared/FilterSection";
import LoadingSpinner from "./shared/LoadingSpinner";
import { formatDateRangeLabel } from "./shared/dateRangeUtils";

type TransactionsPanelProps = {
  syncTransactions: () => void;
  syncStatus: string;
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
  loadingTxns: boolean;
  filteredTransactions: Txn[];
};

type SegmentOption<T extends string> = { value: T; label: string };

function SegmentedButtons<T extends string>({
  value,
  onChange,
  options,
  size = "sm"
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentOption<T>[];
  size?: "sm" | "md";
}) {
  const cls = size === "sm" ? "btn-sm" : "";
  return (
    <div className={`btn-group w-100 ${cls}`} role="group">
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

export default function TransactionsPanel(props: TransactionsPanelProps) {
  const {
    syncTransactions, syncStatus, clearAllFilters, applyDatePreset,
    nameMode, setNameMode, nameFilter, setNameFilter,
    merchantMode, setMerchantMode, merchantFilter, setMerchantFilter,
    amountMode, setAmountMode, amountFilter, setAmountFilter,
    dateStart, setDateStart, dateEnd, setDateEnd,
    selectedBanks, setSelectedBanks, bankOptions,
    selectedAccounts, setSelectedAccounts, accountOptions,
    selectedCategories, setSelectedCategories, categoryOptions,
    filterOperator, setFilterOperator,
    loadingTxns, filteredTransactions
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

  const filterChips = [
    nameFilter.trim() && { id: "name", label: `Name ${nameMode === "not" ? "≠" : "∋"} "${nameFilter}"`, onClear: () => { setNameFilter(""); setNameMode("contains"); } },
    merchantMode === "null" && { id: "merchant-null", label: "Merchant unspecified", onClear: () => setMerchantMode("contains") },
    merchantFilter.trim() && merchantMode !== "null" && { id: "merchant", label: `Merchant ${merchantMode === "not" ? "≠" : "∋"} "${merchantFilter}"`, onClear: () => { setMerchantFilter(""); setMerchantMode("contains"); } },
    amountMode && amountFilter.trim() && { id: "amount", label: `Amount ${amountMode === "gt" ? ">" : "<"} ${amountFilter}`, onClear: () => { setAmountMode(""); setAmountFilter(""); } },
    (dateStart || dateEnd) && { id: "date", label: formatDateRangeLabel(dateStart, dateEnd), onClear: () => { setDateStart(""); setDateEnd(""); } },
    selectedBanks.length > 0 && { id: "banks", label: `Banks: ${selectedBanks.length}`, onClear: () => setSelectedBanks([]) },
    selectedAccounts.length > 0 && { id: "accounts", label: `Accounts: ${selectedAccounts.length}`, onClear: () => setSelectedAccounts([]) },
    selectedCategories.length > 0 && { id: "categories", label: `Detected: ${selectedCategories.length}`, onClear: () => setSelectedCategories([]) }
  ].filter(Boolean) as { id: string; label: string; onClear: () => void }[];

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-success" onClick={syncTransactions}>Fetch Transactions</button>
          <span className="small text-muted">{syncStatus}</span>
        </div>
      </div>

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
          <div>
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
          </div>
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

      {loadingTxns ? <LoadingSpinner /> : <TransactionTable transactions={filteredTransactions} />}
    </div>
  );
}

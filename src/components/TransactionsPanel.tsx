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
  loadingTxns: boolean;
  filteredTransactions: Txn[];
};

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
    loadingTxns, filteredTransactions
  } = props;

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

      <FilterSection label="Filters" summary={`${filterChips.length} active`}>
        <div className="row g-2 mb-2">
          <div className="col-md-6">
            <label className="form-label mb-1">Name</label>
            <div className="input-group input-group-sm">
              <select className="form-select" value={nameMode} onChange={(e) => setNameMode(e.target.value as TextMode)}>
                <option value="contains">Contains</option>
                <option value="not">Does not contain</option>
              </select>
              <input className="form-control" value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} placeholder="Name" />
            </div>
          </div>

          <div className="col-md-6">
            <label className="form-label mb-1">Merchant</label>
            <div className="input-group input-group-sm">
              <select className="form-select" value={merchantMode} onChange={(e) => setMerchantMode(e.target.value as TextMode)}>
                <option value="contains">Contains</option>
                <option value="not">Does not contain</option>
                <option value="null">Unspecified</option>
              </select>
              <input className="form-control" value={merchantFilter} onChange={(e) => setMerchantFilter(e.target.value)} placeholder="Merchant" disabled={merchantMode === "null"} />
            </div>
          </div>

          <div className="col-md-4">
            <label className="form-label mb-1">Amount</label>
            <div className="input-group input-group-sm">
              <select className="form-select" value={amountMode} onChange={(e) => setAmountMode(e.target.value as AmountMode)}>
                <option value="">Any</option>
                <option value="gt">&gt;</option>
                <option value="lt">&lt;</option>
              </select>
              <input className="form-control" value={amountFilter} onChange={(e) => setAmountFilter(e.target.value)} placeholder="0.00" />
            </div>
          </div>

          <div className="col-md-8">
            <label className="form-label mb-1">Date Range</label>
            <DateRangeDropdown
              dateStart={dateStart}
              dateEnd={dateEnd}
              onPreset={applyDatePreset}
              onRangeChange={(start, end) => {
                setDateStart(start);
                setDateEnd(end);
              }}
            />
          </div>

          <div className="col-md-4"><CheckboxFilter label="Banks" options={bankOptions} selected={selectedBanks} onChange={setSelectedBanks} /></div>
          <div className="col-md-4"><CheckboxFilter label="Accounts" options={accountOptions} selected={selectedAccounts} onChange={setSelectedAccounts} /></div>
          <div className="col-md-4"><CheckboxFilter label="Detected Categories" options={categoryOptions} selected={selectedCategories} onChange={setSelectedCategories} /></div>
        </div>
        <button className="btn btn-outline-secondary btn-sm" onClick={clearAllFilters}>Reset filters</button>
      </FilterSection>

      <AppliedFiltersBar chips={filterChips} onClearAll={clearAllFilters} />

      {loadingTxns ? <LoadingSpinner /> : <TransactionTable transactions={filteredTransactions} />}
    </div>
  );
}

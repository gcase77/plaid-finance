import type { AmountMode, TextMode, Txn } from "./types";
import TransactionTable from "./shared/TransactionTable";
import CheckboxFilter from "./shared/CheckboxFilter";
import DateRangeDropdown from "./shared/DateRangeDropdown";
import AppliedFiltersBar from "./shared/AppliedFiltersBar";
import FilterSection from "./shared/FilterSection";
import LoadingSpinner from "./shared/LoadingSpinner";
import { buildDatePreset, type DatePreset } from "../utils/datePresets";

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

  const PRESETS: { value: DatePreset; label: string }[] = [
    { value: "all", label: "All time" },
    { value: "last7", label: "Last 7 days" },
    { value: "last30", label: "Last 30 days" },
    { value: "last365", label: "Last 365 days" },
    { value: "lastMonth", label: "Last month" },
    { value: "lastYear", label: "Last year" }
  ];

  const matchPreset = (s: string, e: string): DatePreset | null => {
    for (const { value } of PRESETS) {
      const { start, end } = buildDatePreset(value);
      if (start === s && end === e) return value;
    }
    return null;
  };

  const nameSummary = nameFilter.trim() ? `${nameMode === "not" ? "not" : "contains"} "${nameFilter}"` : "any";
  const merchantSummary = merchantMode === "null" ? "is null" : merchantFilter.trim() ? `${merchantMode === "not" ? "not" : "contains"} "${merchantFilter}"` : "any";
  const activePreset = matchPreset(dateStart, dateEnd);
  const dateSummary = activePreset ? PRESETS.find(p => p.value === activePreset)!.label : (dateStart || dateEnd) ? (dateStart && dateEnd ? `${dateStart} – ${dateEnd}` : dateStart ? `From ${dateStart}` : `Until ${dateEnd}`) : "All time";
  const amountSummary = amountMode && amountFilter.trim() ? `${amountMode === "gt" ? ">" : "<"} ${amountFilter}` : "any";
  const banksSummary = selectedBanks.length > 0 ? `${selectedBanks.length} selected` : "any";
  const accountsSummary = selectedAccounts.length > 0 ? `${selectedAccounts.length} selected` : "any";
  const categoriesSummary = selectedCategories.length > 0 ? `${selectedCategories.length} selected` : "any";

  const filterChips = [
    nameFilter.trim() && { id: "name", label: `Name ${nameMode === "not" ? "≠" : "∋"} "${nameFilter}"`, onClear: () => { setNameFilter(""); setNameMode("contains"); } },
    merchantMode === "null" && { id: "merchant-null", label: "Merchant is null", onClear: () => setMerchantMode("contains") },
    merchantFilter.trim() && merchantMode !== "null" && { id: "merchant", label: `Merchant ${merchantMode === "not" ? "≠" : "∋"} "${merchantFilter}"`, onClear: () => { setMerchantFilter(""); setMerchantMode("contains"); } },
    amountMode && amountFilter.trim() && { id: "amount", label: `Amount ${amountMode === "gt" ? ">" : "<"} ${amountFilter}`, onClear: () => { setAmountMode(""); setAmountFilter(""); } },
    (dateStart || dateEnd) && { id: "date", label: dateStart && dateEnd ? `${dateStart} – ${dateEnd}` : dateStart ? `From ${dateStart}` : `Until ${dateEnd}`, onClear: () => { setDateStart(""); setDateEnd(""); } },
    selectedBanks.length > 0 && { id: "banks", label: `Banks: ${selectedBanks.length}`, onClear: () => setSelectedBanks([]) },
    selectedAccounts.length > 0 && { id: "accounts", label: `Accounts: ${selectedAccounts.length}`, onClear: () => setSelectedAccounts([]) },
    selectedCategories.length > 0 && { id: "categories", label: `Categories: ${selectedCategories.length}`, onClear: () => setSelectedCategories([]) }
  ].filter(Boolean) as { id: string; label: string; onClear: () => void }[];

  return (
    <div className="card">
      <div className="card-body">
        <h5 className="card-title">Transactions</h5>
        <div className="row g-2 mb-3">
          <div className="col-md-3"><button className="btn btn-outline-primary w-100" onClick={syncTransactions}>Fetch Transactions</button></div>
          <div className="col-md-9"><div className="small text-muted">{syncStatus}</div></div>
        </div>
        <div className="row g-3">
          <div className="col-md-4 col-lg-3">
            <div className="border rounded p-3" style={{ maxHeight: "calc(100vh - 220px)", overflowY: "auto" }}>
              <h6 className="mb-3">Filters</h6>
              
              <FilterSection label="Name" summary={nameSummary}>
                <div className="btn-group btn-group-sm w-100 mb-2">
                  <button className={`btn btn-outline-secondary ${nameMode === "contains" ? "active" : ""}`} onClick={() => setNameMode("contains")}>Contains</button>
                  <button className={`btn btn-outline-secondary ${nameMode === "not" ? "active" : ""}`} onClick={() => setNameMode("not")}>Not</button>
                </div>
                <input className="form-control form-control-sm" value={nameFilter} onChange={e => setNameFilter(e.target.value)} placeholder="Search name" />
              </FilterSection>

              <FilterSection label="Merchant" summary={merchantSummary}>
                <div className="btn-group btn-group-sm w-100 mb-2">
                  <button className={`btn btn-outline-secondary ${merchantMode === "contains" ? "active" : ""}`} onClick={() => setMerchantMode("contains")}>Contains</button>
                  <button className={`btn btn-outline-secondary ${merchantMode === "not" ? "active" : ""}`} onClick={() => setMerchantMode("not")}>Not</button>
                  <button className={`btn btn-outline-secondary ${merchantMode === "null" ? "active" : ""}`} onClick={() => setMerchantMode("null")}>Is null</button>
                </div>
                <input className="form-control form-control-sm" value={merchantFilter} onChange={e => setMerchantFilter(e.target.value)} disabled={merchantMode === "null"} placeholder="Search merchant" />
              </FilterSection>

              <FilterSection label="Date range" summary={dateSummary}>
                <DateRangeDropdown dateStart={dateStart} dateEnd={dateEnd} onPreset={applyDatePreset} onRangeChange={(s, e) => { setDateStart(s); setDateEnd(e); }} />
              </FilterSection>

              <FilterSection label="Amount" summary={amountSummary}>
                <div className="btn-group btn-group-sm w-100 mb-2">
                  <button className={`btn btn-outline-secondary ${amountMode === "" ? "active" : ""}`} onClick={() => setAmountMode("")}>Any</button>
                  <button className={`btn btn-outline-secondary ${amountMode === "gt" ? "active" : ""}`} onClick={() => setAmountMode("gt")}>&gt;</button>
                  <button className={`btn btn-outline-secondary ${amountMode === "lt" ? "active" : ""}`} onClick={() => setAmountMode("lt")}>&lt;</button>
                </div>
                <input className="form-control form-control-sm" type="number" step="0.01" value={amountFilter} onChange={e => setAmountFilter(e.target.value)} placeholder="Amount" />
                <div className="btn-group btn-group-sm w-100 mt-2">
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => { setAmountMode("gt"); setAmountFilter("0"); }}>Spending</button>
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => { setAmountMode("lt"); setAmountFilter("0"); }}>Income</button>
                </div>
              </FilterSection>

              <FilterSection label="Banks" summary={banksSummary}>
                <CheckboxFilter options={bankOptions} selected={selectedBanks} onChange={setSelectedBanks} />
              </FilterSection>

              <FilterSection label="Accounts" summary={accountsSummary}>
                <CheckboxFilter options={accountOptions} selected={selectedAccounts} onChange={setSelectedAccounts} />
              </FilterSection>

              <FilterSection label="Categories" summary={categoriesSummary}>
                <CheckboxFilter options={categoryOptions} selected={selectedCategories} onChange={setSelectedCategories} />
              </FilterSection>

              <button className="btn btn-outline-secondary btn-sm w-100 mt-2" onClick={clearAllFilters}>Clear all filters</button>
            </div>
          </div>
          <div className="col-md-8 col-lg-9">
            <AppliedFiltersBar chips={filterChips} onClearAll={clearAllFilters} />
            {loadingTxns ? (
              <LoadingSpinner message="Loading transactions..." />
            ) : (
              <TransactionTable transactions={filteredTransactions} emptyMessage="No transactions match" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

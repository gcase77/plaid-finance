import type { AmountMode, TextMode, Txn } from "./types";
import LoadingSpinner from "./shared/LoadingSpinner";
import TransactionTable from "./shared/TransactionTable";
import TransactionsFilterSection from "./shared/FilterSection";
import AppliedFiltersBar from "./shared/AppliedFiltersBar";

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

export default function TransactionsPanel({ syncTransactions, syncStatus, loadingTxns, filteredTransactions, ...filters }: TransactionsPanelProps) {
  type FilterChip = { id: string; label: string; onClear: () => void };

  const {
    clearAllFilters, applyDatePreset,
    nameMode, setNameMode, nameFilter, setNameFilter,
    merchantMode, setMerchantMode, merchantFilter, setMerchantFilter,
    amountMode, setAmountMode, amountFilter, setAmountFilter,
    dateStart, setDateStart, dateEnd, setDateEnd,
    selectedBanks, setSelectedBanks,
    selectedAccounts, setSelectedAccounts,
    selectedCategories, setSelectedCategories,
    filterOperator
  } = filters;

  const filterChips: FilterChip[] = [
    nameFilter.trim() && { id: "name", label: `Name ${nameMode === "not" ? "≠" : "∋"} "${nameFilter}"`, onClear: () => { setNameFilter(""); setNameMode("contains"); } },
    merchantMode === "null" && { id: "merchant-null", label: "Merchant unspecified", onClear: () => setMerchantMode("contains") },
    merchantFilter.trim() && merchantMode !== "null" && { id: "merchant", label: `Merchant ${merchantMode === "not" ? "≠" : "∋"} "${merchantFilter}"`, onClear: () => { setMerchantFilter(""); setMerchantMode("contains"); } },
    amountMode && amountFilter.trim() && { id: "amount", label: `Amount ${amountMode === "gt" ? ">" : "<"} ${amountFilter}`, onClear: () => { setAmountMode(""); setAmountFilter(""); } },
    (dateStart || dateEnd) && { id: "date", label: `${dateStart || "?"} → ${dateEnd || "?"}`, onClear: () => { setDateStart(""); setDateEnd(""); } },
    selectedBanks.length > 0 && { id: "banks", label: `Banks: ${selectedBanks.length}`, onClear: () => setSelectedBanks([]) },
    selectedAccounts.length > 0 && { id: "accounts", label: `Accounts: ${selectedAccounts.length}`, onClear: () => setSelectedAccounts([]) },
    selectedCategories.length > 0 && { id: "categories", label: `Detected: ${selectedCategories.length}`, onClear: () => setSelectedCategories([]) }
  ].filter(Boolean) as FilterChip[];

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-success" onClick={syncTransactions}>Fetch Transactions</button>
          <span className="small text-muted">{syncStatus}</span>
        </div>
      </div>

      <div className="row">
        <div className="col-12 col-lg-3 mb-3 mb-lg-0">
          <TransactionsFilterSection {...filters} />
        </div>
        <div className="col-12 col-lg-9">
          <AppliedFiltersBar chips={filterChips} onClearAll={clearAllFilters} operator={filterOperator} />
          {loadingTxns ? <LoadingSpinner /> : <TransactionTable transactions={filteredTransactions} />}
        </div>
      </div>
    </div>
  );
}

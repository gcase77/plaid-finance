import type { AmountMode, TextMode, Txn } from "./types";
import LoadingSpinner from "./shared/LoadingSpinner";
import TransactionTable from "./shared/TransactionTable";
import TransactionsFilterSection from "./shared/TransactionsFilterSection";

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
  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-success" onClick={syncTransactions}>Fetch Transactions</button>
          <span className="small text-muted">{syncStatus}</span>
        </div>
      </div>

      <TransactionsFilterSection {...filters} />

      {loadingTxns ? <LoadingSpinner /> : <TransactionTable transactions={filteredTransactions} />}
    </div>
  );
}

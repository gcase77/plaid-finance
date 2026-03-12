import type { UseTransactionFiltersReturn } from "../../hooks/useTransactionFilters";
import type { Tag } from "../types";
import LoadingSpinner from "../shared/LoadingSpinner";
import TransactionTable from "../shared/TransactionTable";
import TransactionsFilterSection from "../shared/FilterSection";
import AppliedFiltersBar from "../shared/AppliedFiltersBar";

type TransactionsPanelProps = {
  syncTransactions: () => Promise<void>;
  syncStatus: string;
  filters: UseTransactionFiltersReturn;
  loadingTxns: boolean;
  tags: Tag[];
};

export default function TransactionsPanel({ syncTransactions, syncStatus, loadingTxns, filters, tags }: TransactionsPanelProps) {
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
          <TransactionsFilterSection filters={filters} tags={tags} />
        </div>
        <div className="col-12 col-lg-9">
          <AppliedFiltersBar filters={filters} />
          {loadingTxns ? <LoadingSpinner /> : <TransactionTable transactions={filters.derived.filteredTransactions} tags={tags} />}
        </div>
      </div>
    </div>
  );
}

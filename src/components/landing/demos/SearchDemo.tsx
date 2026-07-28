import { useTransactionFilters } from "../../../hooks/useTransactionFilters";
import AppliedFiltersBar from "../../shared/AppliedFiltersBar";
import TransactionsFilterSection from "../../shared/FilterSection";
import TransactionTable from "../../shared/TransactionTable";
import { DEMO_TAGS, DEMO_TRANSACTIONS } from "../demoData";

export default function SearchDemo() {
  const filters = useTransactionFilters(DEMO_TRANSACTIONS);

  return (
    <div className="landing-demo-shell">
      <div className="landing-demo-hint">
        Try filtering by name, date, amount, or tags — the same controls you use in the app.
      </div>
      <div className="txn-tag-layout landing-demo-txn-layout">
        <TransactionsFilterSection filters={filters} tags={DEMO_TAGS} />
        <div className="col-flex" style={{ minWidth: 0, gap: 8 }}>
          <AppliedFiltersBar filters={filters} />
          <TransactionTable
            transactions={filters.derived.filteredTransactions}
            tags={DEMO_TAGS}
            keyPrefix="demo-search"
            emptyMessage="No transactions match your filters."
          />
        </div>
      </div>
    </div>
  );
}

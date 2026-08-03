import type { ReactNode } from "react";
import type { Tag, Txn } from "../types";
import LandingTransactionTable from "./LandingTransactionTable";

export default function LandingVizTxnPanel({
  title, transactions, tags, onClear, keyPrefix,
}: {
  title: ReactNode;
  transactions: Txn[];
  tags: Tag[];
  onClear: () => void;
  keyPrefix: string;
}) {
  return (
    <div className="card mt-3 landing-viz-txn-panel">
      <div className="between mb-3 flex-wrap gap-2">
        <h4 style={{ margin: 0 }}>{title}</h4>
        <button type="button" className="btn ghost btn-sm" onClick={onClear}>Clear</button>
      </div>
      <LandingTransactionTable transactions={transactions} tags={tags} keyPrefix={keyPrefix} emptyMessage="No transactions" />
    </div>
  );
}

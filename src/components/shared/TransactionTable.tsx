import type { Txn } from "../types";
import { getTxnIconUrl, formatTxnDate, formatTxnAmount } from "../../utils/transactionUtils";

type TransactionTableProps = {
  transactions: Txn[];
  emptyMessage?: string;
  keyPrefix?: string;
};

export default function TransactionTable({ transactions, emptyMessage = "No transactions", keyPrefix = "txn" }: TransactionTableProps) {
  if (!transactions.length) return <div className="text-muted">{emptyMessage}</div>;
  
  return (
    <div className="table-responsive">
      <table className="table table-sm table-striped align-middle mb-0">
        <thead>
          <tr>
            <th style={{ width: 40 }}></th>
            <th>Date</th>
            <th>Name</th>
            <th>Merchant</th>
            <th className="text-end">Amount</th>
            <th>Bank</th>
            <th>Account</th>
            <th>Category</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t, idx) => (
            <tr key={t.transaction_id || `${keyPrefix}-${idx}-${t.name || "tx"}`}>
              <td>{getTxnIconUrl(t) ? <img src={getTxnIconUrl(t)} alt="icon" style={{ width: 24, height: 24 }} /> : ""}</td>
              <td>{formatTxnDate(t)}</td>
              <td>{(t.original_description || "").trim() || t.name || ""}</td>
              <td>{t.merchant_name || ""}</td>
              <td className="text-end">{formatTxnAmount(t)}</td>
              <td>{t.institution_name || ""}</td>
              <td>{t.account_name || t.account_official_name || ""}</td>
              <td>{t.personal_finance_category?.detailed || t.personal_finance_category?.primary || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

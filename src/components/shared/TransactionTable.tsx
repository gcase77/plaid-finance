import type { Tag, Txn } from "../types";
import { getTxnIconUrl, formatTxnDate, formatTxnAmount, formatTxnDetectedCategory } from "../../utils/transactionUtils";

function formatAccountDisplay(institution: string, account: string): string {
  if (!account) return institution || "";
  if (!institution) return account;
  const inst = institution.trim().toLowerCase();
  const acct = account.trim();
  return acct.toLowerCase().includes(inst) ? acct : `${institution} | ${acct}`;
}

function getTxnTagLabels(t: Txn, tagMap: Map<number, string>): string[] {
  const labels = new Set<string>();
  if (t.account_transfer_group) labels.add("account_transfer");
  if (t.bucket_1_tag_id != null) labels.add(tagMap.get(t.bucket_1_tag_id) || String(t.bucket_1_tag_id));
  if (t.bucket_2_tag_id != null) labels.add(tagMap.get(t.bucket_2_tag_id) || String(t.bucket_2_tag_id));
  if (t.meta_tag_id != null) labels.add(tagMap.get(t.meta_tag_id) || String(t.meta_tag_id));
  return [...labels];
}

function TagBadges({ labels }: { labels: string[] }) {
  if (!labels.length) return <span className="text-muted small">—</span>;
  return (
    <div className="d-flex flex-wrap gap-1">
      {labels.map((label) => (
        <span key={label} className={`badge ${label === "account_transfer" ? "bg-dark" : "bg-secondary"}`}>
          {label}
        </span>
      ))}
    </div>
  );
}

type TransactionTableProps = {
  transactions: Txn[];
  emptyMessage?: string;
  keyPrefix?: string;
  taggingMode?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  tags?: Tag[];
};

export default function TransactionTable({
  transactions,
  emptyMessage = "No transactions",
  keyPrefix = "txn",
  taggingMode = false,
  selectedIds,
  onSelectionChange,
  tags = []
}: TransactionTableProps) {
  if (!transactions.length) return <div className="text-muted">{emptyMessage}</div>;

  const tagMap = new Map(tags.map((t) => [t.id, t.name]));

  const txnId = (t: Txn, idx: number) => t.transaction_id || `${keyPrefix}-${idx}`;

  const toggle = (id: string, checked: boolean) => {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectionChange(next);
  };

  const toggleAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    onSelectionChange(checked ? new Set(transactions.map(txnId)) : new Set());
  };

  const allSelected = !!selectedIds && transactions.length > 0 && transactions.every((t, i) => selectedIds.has(txnId(t, i)));

  return (
    <div className="table-responsive">
      <table className="table table-sm table-striped align-middle mb-0">
        <thead>
          <tr>
            {taggingMode && <th style={{ width: 32 }}><input type="checkbox" className="form-check-input" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} /></th>}
            <th style={{ width: 40 }}></th>
            <th>Date</th>
            <th>Tags</th>
            <th>Name</th>
            <th>Merchant</th>
            <th className="text-end">Amount</th>
            <th>Account</th>
            <th>Detected</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t, idx) => {
            const id = txnId(t, idx);
            const isSelected = !!selectedIds?.has(id);
            return (
              <tr key={id} className={isSelected ? "table-active" : ""}>
                {taggingMode && (
                  <td>
                    <input type="checkbox" className="form-check-input" checked={isSelected} onChange={(e) => toggle(id, e.target.checked)} />
                  </td>
                )}
                <td>{getTxnIconUrl(t) ? <img src={getTxnIconUrl(t)} alt="icon" style={{ width: 24, height: 24 }} /> : ""}</td>
                <td>{formatTxnDate(t)}</td>
                <td><TagBadges labels={getTxnTagLabels(t, tagMap)} /></td>
                <td>{(t.original_description || "").trim() || t.name || ""}</td>
                <td>{t.merchant_name || ""}</td>
                <td className="text-end">{formatTxnAmount(t)}</td>
                <td>{formatAccountDisplay(t.institution_name || "", t.account_name || t.account_official_name || "")}</td>
                <td>{formatTxnDetectedCategory(t.personal_finance_category)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

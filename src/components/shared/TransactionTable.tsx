import type { Tag, Txn } from "../types";
import { getTxnIconUrl, formatTxnDate, formatTxnAmount, formatTxnDetectedCategory, getDisplayTagColor, getTextColorForBackground } from "../../utils/transactionUtils";

function getTxnSummary(transactions: Txn[]) {
  const nonTransfer = transactions.filter((t) => !t.account_transfer_group);
  const income = nonTransfer.filter((t) => (t.amount ?? 0) < 0).reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);
  const spending = nonTransfer.filter((t) => (t.amount ?? 0) > 0).reduce((s, t) => s + (t.amount ?? 0), 0);
  return { income, spending, count: transactions.length };
}

function formatCurrency(amount: number) {
  return `$ ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatAccountDisplay(institution: string, account: string): string {
  if (!account) return institution || "";
  if (!institution) return account;
  const inst = institution.trim().toLowerCase();
  const acct = account.trim();
  return acct.toLowerCase().includes(inst) ? acct : `${institution} | ${acct}`;
}

type TagBadge = { key: string; label: string; color?: string; accountTransfer?: boolean };

function getTxnTagBadges(t: Txn, tagMap: Map<number, Tag>): TagBadge[] {
  const badges: TagBadge[] = [];
  const seen = new Set<string>();
  if (t.account_transfer_group) {
    badges.push({ key: "account_transfer", label: "account_transfer", accountTransfer: true });
    seen.add("account_transfer");
  }
  const addById = (tagId: number) => {
    const tag = tagMap.get(tagId);
    if (!tag) {
      const fallback = String(tagId);
      if (seen.has(fallback)) return;
      seen.add(fallback);
      badges.push({ key: fallback, label: fallback });
      return;
    }
    if (seen.has(tag.name)) return;
    seen.add(tag.name);
    badges.push({
      key: String(tag.id),
      label: tag.name,
      color: getDisplayTagColor(tag.type, tag.color)
    });
  };
  if (t.bucket_1_tag_id != null) addById(t.bucket_1_tag_id);
  if (t.bucket_2_tag_id != null) addById(t.bucket_2_tag_id);
  (t.meta_tag_ids ?? []).forEach(addById);
  return badges;
}

function TagBadges({ badges }: { badges: TagBadge[] }) {
  if (!badges.length) return <span className="text-muted small">—</span>;
  return (
    <div className="d-flex flex-wrap gap-1">
      {badges.map((badge) => (
        <span
          key={badge.key}
          className={`badge ${badge.accountTransfer ? "bg-dark" : ""}`}
          style={badge.accountTransfer || !badge.color
            ? undefined
            : { backgroundColor: badge.color, color: getTextColorForBackground(badge.color), border: "1px solid rgba(0,0,0,0.12)" }}
        >
          {badge.label}
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

  const tagMap = new Map(tags.map((t) => [t.id, t]));

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

  const { income, spending, count } = getTxnSummary(transactions);

  return (
    <>
      <div className="d-flex flex-wrap gap-4 mb-3 small">
        <span>Income: <strong>{formatCurrency(income)}</strong></span>
        <span>Spending: <strong>{formatCurrency(spending)}</strong></span>
        <span><strong>{count.toLocaleString()}</strong> transactions</span>
      </div>
      <div className="table-responsive">
      <table className="table table-sm table-striped align-middle mb-0">
        <thead>
          <tr>
            {taggingMode && <th style={{ width: 32 }}><input type="checkbox" className="form-check-input" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} /></th>}
            <th style={{ width: 40 }}></th>
            <th>Date</th>
            <th className="visually-hidden">Tags</th>
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
              <tr
                key={id}
                className={isSelected ? "table-active" : ""}
                style={taggingMode ? { cursor: "pointer" } : undefined}
                onClick={taggingMode ? () => toggle(id, !isSelected) : undefined}
              >
                {taggingMode && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="form-check-input" checked={isSelected} onChange={(e) => toggle(id, e.target.checked)} />
                  </td>
                )}
                <td>{getTxnIconUrl(t) ? <img src={getTxnIconUrl(t)} alt="icon" style={{ width: 24, height: 24 }} /> : ""}</td>
                <td>{formatTxnDate(t)}</td>
                <td><TagBadges badges={getTxnTagBadges(t, tagMap)} /></td>
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
    </>
  );
}

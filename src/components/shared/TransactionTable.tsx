import type { Tag, Txn } from "../types";
import { getTxnIconUrl, formatTxnDate, formatTxnAmount, formatTxnDetectedCategory, getDisplayTagColor, getTextColorForBackground } from "../../utils/transactionUtils";
import { collapseNettingGroups } from "../../utils/nettingUtils";

function getSummary(txns: Txn[]) {
  const nt = collapseNettingGroups(txns.filter((t) => !t.account_transfer_group));
  const income = nt.filter((t) => (t.amount ?? 0) < 0).reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);
  const spending = nt.filter((t) => (t.amount ?? 0) > 0).reduce((s, t) => s + (t.amount ?? 0), 0);
  return { income, spending, count: txns.length };
}
const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function accountDisplay(inst: string, acct: string) {
  if (!acct) return inst;
  if (!inst) return acct;
  return acct.trim().toLowerCase().includes(inst.trim().toLowerCase()) ? acct : `${inst} · ${acct}`;
}

type Badge = { key: string; label: string; color?: string; transfer?: boolean };
function tagBadges(t: Txn, tagMap: Map<number, Tag>): Badge[] {
  const out: Badge[] = [];
  const seen = new Set<string>();
  if (t.account_transfer_group) { out.push({ key: "tx", label: "account_transfer", transfer: true }); seen.add("tx"); }
  if (t.netting_group) { out.push({ key: "net", label: (t.amount ?? 0) > 0 ? "contra_spend" : "contra_income", transfer: true }); seen.add("net"); }
  const add = (id: number) => {
    const tag = tagMap.get(id);
    const key = tag ? String(tag.id) : String(id);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ key, label: tag?.name ?? String(id), color: tag ? getDisplayTagColor(tag.type, tag.color) : undefined });
  };
  if (t.bucket_1_tag_id != null) add(t.bucket_1_tag_id);
  if (t.bucket_2_tag_id != null) add(t.bucket_2_tag_id);
  (t.meta_tag_ids ?? []).forEach(add);
  return out;
}

function Badges({ badges }: { badges: Badge[] }) {
  if (!badges.length) return <span className="muted xs">—</span>;
  return (
    <div className="row-flex flex-wrap gap-1">
      {badges.map((b) => (
        <span
          key={b.key}
          className="tag-badge"
          style={b.transfer ? { background: "var(--ink)", color: "#fff", borderColor: "transparent" } : b.color ? { background: b.color, color: getTextColorForBackground(b.color) } : undefined}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}

type Props = {
  transactions: Txn[];
  emptyMessage?: string;
  keyPrefix?: string;
  taggingMode?: boolean;
  nettingMode?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  tags?: Tag[];
};

type DisplayRow = { t: Txn; groupPos?: "start" | "mid" | "end" | "solo" };
const txnEpoch = (t: Txn) => new Date(t.datetime ?? t.authorized_datetime ?? 0).valueOf();

/** In netting mode, groups sit at their anchor (largest leg) date; members sort newest-first within. */
function buildDisplayRows(transactions: Txn[], nettingMode: boolean): DisplayRow[] {
  if (!nettingMode) return transactions.map((t) => ({ t }));
  const groups = new Map<string, Txn[]>();
  const units: { sort: number; rows: DisplayRow[] }[] = [];
  for (const t of transactions) {
    if (t.netting_group) { const a = groups.get(t.netting_group) ?? []; a.push(t); groups.set(t.netting_group, a); }
    else units.push({ sort: txnEpoch(t), rows: [{ t }] });
  }
  for (const legs of groups.values()) {
    legs.sort((a, b) => txnEpoch(b) - txnEpoch(a));
    const anchor = legs.reduce((m, t) => (Math.abs(t.amount ?? 0) > Math.abs(m.amount ?? 0) ? t : m));
    units.push({
      sort: txnEpoch(anchor),
      rows: legs.map((t, i) => ({ t, groupPos: legs.length === 1 ? "solo" as const : i === 0 ? "start" as const : i === legs.length - 1 ? "end" as const : "mid" as const }))
    });
  }
  units.sort((a, b) => b.sort - a.sort);
  return units.flatMap((u) => u.rows);
}

export default function TransactionTable({ transactions, emptyMessage = "No transactions", keyPrefix = "txn", taggingMode = false, nettingMode = false, selectedIds, onSelectionChange, tags = [] }: Props) {
  if (!transactions.length) return <div className="muted">{emptyMessage}</div>;
  const tagMap = new Map(tags.map((t) => [t.id, t]));
  const txnId = (t: Txn, idx: number) => t.transaction_id || `${keyPrefix}-${idx}`;
  const toggle = (id: string, c: boolean) => {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (c) next.add(id); else next.delete(id);
    onSelectionChange(next);
  };
  const toggleAll = (c: boolean) => { if (onSelectionChange) onSelectionChange(c ? new Set(transactions.map(txnId)) : new Set()); };
  const allSelected = !!selectedIds && transactions.length > 0 && transactions.every((t, i) => selectedIds.has(txnId(t, i)));
  const { income, spending, count } = getSummary(transactions);
  const displayRows = buildDisplayRows(transactions, nettingMode);

  return (
    <>
      <div className="row-flex flex-wrap gap-4 mb-3 small">
        <span>Income: <strong>{fmt(income)}</strong></span>
        <span>Spending: <strong>{fmt(spending)}</strong></span>
        <span><strong>{count.toLocaleString()}</strong> transactions</span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {taggingMode && <th style={{ width: 32 }}><input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} /></th>}
              <th style={{ width: 30 }}></th>
              <th>Date</th>
              {taggingMode && <th>Tags</th>}
              <th>Name</th>
              <th>Merchant</th>
              <th className="text-end">Amount</th>
              {!taggingMode && <th>Tags</th>}
              <th>Account</th>
              <th>Detected</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map(({ t, groupPos }, idx) => {
              const id = txnId(t, idx);
              const sel = !!selectedIds?.has(id);
              const groupCls = groupPos
                ? `net-group ${groupPos === "start" || groupPos === "solo" ? "net-start" : ""} ${groupPos === "end" || groupPos === "solo" ? "net-end" : ""}`
                : "";
              return (
                <tr key={id} className={`${taggingMode ? "selectable" : ""} ${sel ? "selected" : ""} ${groupCls}`} onClick={taggingMode ? () => toggle(id, !sel) : undefined}>
                  {taggingMode && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={sel} onChange={(e) => toggle(id, e.target.checked)} />
                    </td>
                  )}
                  <td>{getTxnIconUrl(t) && <img src={getTxnIconUrl(t)} alt="" style={{ width: 22, height: 22, borderRadius: 6 }} />}</td>
                  <td className="text-nowrap">{formatTxnDate(t)}</td>
                  {taggingMode && <td><Badges badges={tagBadges(t, tagMap)} /></td>}
                  <td>{(t.original_description || "").trim() || t.name || ""}</td>
                  <td>{t.merchant_name || ""}</td>
                  <td className={`text-end ${(t.amount ?? 0) < 0 ? "money-positive" : ""}`}>{formatTxnAmount(t)}</td>
                  {!taggingMode && <td><Badges badges={tagBadges(t, tagMap)} /></td>}
                  <td>{accountDisplay(t.institution_name || "", t.account_name || t.account_official_name || "")}</td>
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

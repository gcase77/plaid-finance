import { memo, useCallback, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Tag, Txn } from "../types";
import { getTxnIconUrl, formatTxnDate, formatTxnAmount, formatTxnDetectedCategory, getDisplayTagColor, getTextColorForBackground, getTxnDateOnly } from "../../utils/transactionUtils";
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
const csvEsc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

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

function transactionsToCsv(rows: Txn[], tagMap: Map<number, Tag>) {
  const h = ["Date", "Name", "Merchant", "Amount", "Currency", "Tags", "Account", "Detected"].map(csvEsc).join(",");
  const b = rows.map((t) =>
    [
      getTxnDateOnly(t),
      (t.original_description || "").trim() || t.name || "",
      t.merchant_name || "",
      t.amount ?? "",
      t.iso_currency_code || "",
      tagBadges(t, tagMap).map((x) => x.label).join("; "),
      accountDisplay(t.institution_name || "", t.account_name || t.account_official_name || ""),
      formatTxnDetectedCategory(t.personal_finance_category),
    ].map(csvEsc).join(",")
  );
  return `\ufeff${h}\r\n${b.join("\r\n")}`;
}

function Badges({ badges }: { badges: Badge[] }) {
  if (!badges.length) return <span className="muted xs">—</span>;
  return (
    <div className="row-flex flex-wrap gap-1">
      {badges.map((b) => (
        <span
          key={b.key}
          className="tag-badge"
          style={b.transfer ? { background: "var(--ink)", color: "var(--surface)", borderColor: "transparent" } : b.color ? { background: b.color, color: getTextColorForBackground(b.color) } : undefined}
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

type GroupPos = "summary" | "start" | "mid" | "end" | "solo";
type DisplayRow = { t: Txn; id: string; groupPos?: GroupPos; netAmount?: number; netGroupCount?: number };
const txnEpoch = (t: Txn) => new Date(t.datetime ?? t.authorized_datetime ?? 0).valueOf();

/** In netting mode, groups sit at their anchor (largest leg) date; members sort newest-first within. */
function buildDisplayRows(transactions: Txn[], nettingMode: boolean, keyPrefix: string): DisplayRow[] {
  const withId = transactions.map((t, i) => ({ t, id: t.transaction_id || `${keyPrefix}-${i}` }));
  if (!nettingMode) return withId;
  const groups = new Map<string, typeof withId>();
  const units: { sort: number; rows: DisplayRow[] }[] = [];
  for (const r of withId) {
    if (r.t.netting_group) { const a = groups.get(r.t.netting_group) ?? []; a.push(r); groups.set(r.t.netting_group, a); }
    else units.push({ sort: txnEpoch(r.t), rows: [r] });
  }
  for (const legs of groups.values()) {
    legs.sort((a, b) => txnEpoch(b.t) - txnEpoch(a.t));
    const anchor = legs.reduce((m, r) => (Math.abs(r.t.amount ?? 0) > Math.abs(m.t.amount ?? 0) ? r : m));
    const netAmount = legs.reduce((s, r) => s + (r.t.amount ?? 0), 0);
    units.push({
      sort: txnEpoch(anchor.t),
      rows: [
        { ...anchor, id: `${keyPrefix}-net-${anchor.t.netting_group}`, groupPos: "summary" as const, netAmount, netGroupCount: legs.length },
        ...legs.map((r, i) => ({
          ...r,
          groupPos: legs.length === 1 ? "solo" as const : i === 0 ? "start" as const : i === legs.length - 1 ? "end" as const : "mid" as const
        }))
      ]
    });
  }
  units.sort((a, b) => b.sort - a.sort);
  return units.flatMap((u) => u.rows);
}

type RowProps = {
  t: Txn;
  id: string;
  groupPos?: GroupPos;
  sel: boolean;
  taggingMode: boolean;
  tagMap: Map<number, Tag>;
  onToggle: (id: string, c: boolean) => void;
  measureRef: (el: HTMLTableRowElement | null) => void;
  dataIndex: number;
  netAmount?: number;
  netGroupCount?: number;
};

const Row = memo(function Row({ t, id, groupPos, sel, taggingMode, tagMap, onToggle, measureRef, dataIndex, netAmount, netGroupCount }: RowProps) {
  const groupCls = groupPos
    ? `net-group ${groupPos === "summary" || groupPos === "start" || groupPos === "solo" ? "net-start" : ""} ${groupPos === "end" || groupPos === "solo" ? "net-end" : ""} ${groupPos === "summary" ? "net-summary" : ""}`
    : "";
  const isSummary = groupPos === "summary";
  const amountTxn = isSummary ? { ...t, amount: netAmount ?? 0 } : t;
  return (
    <tr
      ref={measureRef}
      data-index={dataIndex}
      className={`${taggingMode ? "selectable" : ""} ${sel ? "selected" : ""} ${groupCls}`}
      onClick={taggingMode && !isSummary ? () => onToggle(id, !sel) : undefined}
    >
      {taggingMode && (
        <td onClick={(e) => e.stopPropagation()}>
          {!isSummary && <input type="checkbox" checked={sel} onChange={(e) => onToggle(id, e.target.checked)} />}
        </td>
      )}
      <td>{!isSummary && getTxnIconUrl(t) && <img src={getTxnIconUrl(t)} alt="" style={{ width: 22, height: 22, borderRadius: 6 }} />}</td>
      <td className="text-nowrap">{isSummary ? "" : formatTxnDate(t)}</td>
      {taggingMode && <td>{isSummary ? <span className="muted xs">—</span> : <Badges badges={tagBadges(t, tagMap)} />}</td>}
      <td>{isSummary ? `Netted amount (${netGroupCount ?? 0} transactions)` : (t.original_description || "").trim() || t.name || ""}</td>
      <td>{isSummary ? "" : t.merchant_name || ""}</td>
      <td className={`text-end ${(amountTxn.amount ?? 0) < 0 ? "money-positive" : ""}`}>{formatTxnAmount(amountTxn)}</td>
      {!taggingMode && <td>{isSummary ? <span className="muted xs">—</span> : <Badges badges={tagBadges(t, tagMap)} />}</td>}
      <td>{isSummary ? "" : accountDisplay(t.institution_name || "", t.account_name || t.account_official_name || "")}</td>
      <td>{isSummary ? "" : formatTxnDetectedCategory(t.personal_finance_category)}</td>
    </tr>
  );
});

const ROW_ESTIMATE = 41;

export default function TransactionTable({ transactions, emptyMessage = "No transactions", keyPrefix = "txn", taggingMode = false, nettingMode = false, selectedIds, onSelectionChange, tags = [] }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const displayRows = useMemo(() => buildDisplayRows(transactions, nettingMode, keyPrefix), [transactions, nettingMode, keyPrefix]);
  const summary = useMemo(() => getSummary(transactions), [transactions]);

  const virtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 12
  });

  const selectedRef = useRef(selectedIds);
  selectedRef.current = selectedIds;
  const toggle = useCallback((id: string, c: boolean) => {
    if (!onSelectionChange || !selectedRef.current) return;
    const next = new Set(selectedRef.current);
    if (c) next.add(id); else next.delete(id);
    onSelectionChange(next);
  }, [onSelectionChange]);

  const downloadCsv = useCallback(() => {
    const blob = new Blob([transactionsToCsv(transactions, tagMap)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [transactions, tagMap]);

  if (!transactions.length) return <div className="muted">{emptyMessage}</div>;
  const selectableRows = displayRows.filter((r) => r.groupPos !== "summary");
  const toggleAll = (c: boolean) => { if (onSelectionChange) onSelectionChange(c ? new Set(selectableRows.map((r) => r.id)) : new Set()); };
  const allSelected = !!selectedIds && selectableRows.length > 0 && selectableRows.every((r) => selectedIds.has(r.id));

  const items = virtualizer.getVirtualItems();
  const padTop = items.length ? items[0].start : 0;
  const padBottom = items.length ? virtualizer.getTotalSize() - items[items.length - 1].end : 0;

  return (
    <>
      <div className="row-flex flex-wrap gap-4 mb-3 small">
        <span>Income: <strong>{fmt(summary.income)}</strong></span>
        <span>Spending: <strong>{fmt(summary.spending)}</strong></span>
        <span><strong>{summary.count.toLocaleString()}</strong> transactions</span>
      </div>
      <div className="table-wrap" ref={scrollRef} style={{ maxHeight: "70vh", overflowY: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              {taggingMode && <th style={{ width: 32 }}><input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} /></th>}
              <th style={{ width: 40, verticalAlign: "middle" }}>
                <button type="button" className="btn ghost btn-sm" style={{ padding: "2px 6px" }} title="Download this view as CSV" aria-label="Download this view as CSV" onClick={downloadCsv}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" x2="12" y1="15" y2="3" />
                  </svg>
                </button>
              </th>
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
            {padTop > 0 && <tr aria-hidden style={{ height: padTop }} />}
            {items.map((vi) => {
              const { t, id, groupPos, netAmount, netGroupCount } = displayRows[vi.index];
              return (
                <Row
                  key={id}
                  t={t}
                  id={id}
                  groupPos={groupPos}
                  sel={!!selectedIds?.has(id)}
                  taggingMode={taggingMode}
                  tagMap={tagMap}
                  onToggle={toggle}
                  measureRef={virtualizer.measureElement}
                  dataIndex={vi.index}
                  netAmount={netAmount}
                  netGroupCount={netGroupCount}
                />
              );
            })}
            {padBottom > 0 && <tr aria-hidden style={{ height: padBottom }} />}
          </tbody>
        </table>
      </div>
    </>
  );
}

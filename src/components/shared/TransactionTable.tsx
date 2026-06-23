import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  columns: ColumnDef[];
};

type ColumnId = "select" | "actions" | "date" | "tags" | "name" | "merchant" | "amount" | "account" | "detected" | "reset";
type ColumnDef = { id: ColumnId; label: string; width?: number; minWidth: number; hideable?: boolean; align?: "right"; fixed?: boolean };
type ColumnPrefs = { order: ColumnId[]; widths: Partial<Record<ColumnId, number>>; hidden: ColumnId[] };

const DATA_COLUMNS: ColumnDef[] = [
  { id: "date", label: "Date", minWidth: 92 },
  { id: "tags", label: "Tags", minWidth: 120 },
  { id: "name", label: "Name", minWidth: 180 },
  { id: "merchant", label: "Merchant", minWidth: 120 },
  { id: "amount", label: "Amount", minWidth: 96, align: "right" },
  { id: "account", label: "Account", minWidth: 150 },
  { id: "detected", label: "Detected", minWidth: 140 }
];
const PREF_VERSION = 1;
const clampWidth = (w: number, min: number) => Math.max(min, Math.round(w));

function defaultPrefs(cols: ColumnDef[]): ColumnPrefs {
  return { order: cols.map((c) => c.id), widths: {}, hidden: [] };
}

function readPrefs(key: string, cols: ColumnDef[]): ColumnPrefs | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ColumnPrefs & { version?: number };
    const ids = new Set(cols.map((c) => c.id));
    const minWidths = new Map(cols.map((c) => [c.id, c.minWidth]));
    return {
      order: [...parsed.order.filter((id) => ids.has(id)), ...cols.map((c) => c.id).filter((id) => !parsed.order.includes(id))],
      widths: Object.fromEntries(Object.entries(parsed.widths ?? {}).filter(([id]) => ids.has(id) && !cols.find((c) => c.id === id)?.fixed).map(([id, width]) => [id, clampWidth(Number(width), minWidths.get(id as ColumnId) ?? 40)])),
      hidden: (parsed.hidden ?? []).filter((id) => ids.has(id) && cols.find((c) => c.id === id)?.hideable !== false)
    };
  } catch {
    return null;
  }
}

const Row = memo(function Row({ t, id, groupPos, sel, taggingMode, tagMap, onToggle, measureRef, dataIndex, netAmount, netGroupCount, columns }: RowProps) {
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
      {columns.map((col) => {
        const cellCls = col.fixed ? "txn-col-fixed" : undefined;
        if (col.id === "select") return <td key={col.id} className={cellCls} onClick={(e) => e.stopPropagation()}>{!isSummary && <input type="checkbox" checked={sel} onChange={(e) => onToggle(id, e.target.checked)} />}</td>;
        if (col.id === "actions") return <td key={col.id} className={cellCls}>{!isSummary && getTxnIconUrl(t) && <img src={getTxnIconUrl(t)} alt="" style={{ width: 22, height: 22, borderRadius: 6 }} />}</td>;
        if (col.id === "reset") return <td key={col.id} className={cellCls} />;
        if (col.id === "date") return <td key={col.id} className="text-nowrap">{isSummary ? "" : formatTxnDate(t)}</td>;
        if (col.id === "tags") return <td key={col.id}>{isSummary ? <span className="muted xs">—</span> : <Badges badges={tagBadges(t, tagMap)} />}</td>;
        if (col.id === "name") return <td key={col.id}>{isSummary ? `Netted amount (${netGroupCount ?? 0} transactions)` : (t.original_description || "").trim() || t.name || ""}</td>;
        if (col.id === "merchant") return <td key={col.id}>{isSummary ? "" : t.merchant_name || ""}</td>;
        if (col.id === "amount") return <td key={col.id} className={`text-end ${(amountTxn.amount ?? 0) < 0 ? "money-positive" : ""}`}>{formatTxnAmount(amountTxn)}</td>;
        if (col.id === "account") return <td key={col.id}>{isSummary ? "" : accountDisplay(t.institution_name || "", t.account_name || t.account_official_name || "")}</td>;
        return <td key={col.id}>{isSummary ? "" : formatTxnDetectedCategory(t.personal_finance_category)}</td>;
      })}
    </tr>
  );
});

const ROW_ESTIMATE = 41;

export default function TransactionTable({ transactions, emptyMessage = "No transactions", keyPrefix = "txn", taggingMode = false, nettingMode = false, selectedIds, onSelectionChange, tags = [] }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRefs = useRef<Partial<Record<ColumnId, HTMLTableCellElement | null>>>({});
  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const displayRows = useMemo(() => buildDisplayRows(transactions, nettingMode, keyPrefix), [transactions, nettingMode, keyPrefix]);
  const summary = useMemo(() => getSummary(transactions), [transactions]);
  const baseColumns = useMemo<ColumnDef[]>(() => [
    ...(taggingMode ? [{ id: "select" as const, label: "Select", width: 32, minWidth: 32, hideable: false, fixed: true }] : []),
    { id: "actions", label: "Export", width: 38, minWidth: 38, hideable: false, fixed: true },
    ...DATA_COLUMNS,
    { id: "reset", label: "Reset", width: 40, minWidth: 40, hideable: false, fixed: true }
  ], [taggingMode]);
  const prefKey = `txn-table-columns:v${PREF_VERSION}:${taggingMode ? "selecting" : "viewing"}`;
  const [prefs, setPrefs] = useState<ColumnPrefs>(() => readPrefs(prefKey, baseColumns) ?? defaultPrefs(baseColumns));
  const [dragging, setDragging] = useState<ColumnId | null>(null);

  useEffect(() => setPrefs(readPrefs(prefKey, baseColumns) ?? defaultPrefs(baseColumns)), [prefKey, baseColumns]);
  useEffect(() => { localStorage.setItem(prefKey, JSON.stringify(prefs)); }, [prefKey, prefs]);

  const orderedColumns = useMemo(() => {
    const byId = new Map(baseColumns.map((c) => [c.id, c]));
    return prefs.order
      .map((id) => byId.get(id))
      .filter((c): c is ColumnDef => !!c)
      .filter((c) => !prefs.hidden.includes(c.id))
      .map((c) => ({ ...c, width: c.fixed ? c.width : prefs.widths[c.id] ?? c.width }));
  }, [baseColumns, prefs]);

  useEffect(() => {
    if (Object.keys(prefs.widths).length) return;
    const widths = Object.fromEntries(orderedColumns.filter((c) => !c.fixed).map((c) => [c.id, clampWidth(headerRefs.current[c.id]?.offsetWidth ?? c.minWidth, c.minWidth)]));
    setPrefs((p) => ({ ...p, widths }));
  }, [orderedColumns, prefs.widths]);

  const setWidth = useCallback((id: ColumnId, width: number) => {
    const minWidth = baseColumns.find((c) => c.id === id)?.minWidth ?? 40;
    setPrefs((p) => ({ ...p, widths: { ...p.widths, [id]: clampWidth(width, minWidth) } }));
  }, [baseColumns]);

  const startResize = (id: ColumnId, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = headerRefs.current[id]?.offsetWidth ?? prefs.widths[id] ?? 80;
    const move = (ev: PointerEvent) => setWidth(id, startW + ev.clientX - startX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const reorder = (from: ColumnId, to: ColumnId) => {
    if (from === to) return;
    setPrefs((p) => {
      const order = p.order.filter((id) => id !== from);
      order.splice(Math.max(0, order.indexOf(to)), 0, from);
      return { ...p, order };
    });
  };
  const resetColumns = () => {
    localStorage.removeItem(prefKey);
    setPrefs(defaultPrefs(baseColumns));
  };

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
        <details className="column-menu">
          <summary>Columns</summary>
          <div className="column-menu-panel">
            {baseColumns.filter((c) => c.hideable !== false).map((c) => (
              <label key={c.id} className="check">
                <input type="checkbox" checked={!prefs.hidden.includes(c.id)} onChange={(e) => setPrefs((p) => ({ ...p, hidden: e.target.checked ? p.hidden.filter((id) => id !== c.id) : [...p.hidden, c.id] }))} />
                {c.label}
              </label>
            ))}
          </div>
        </details>
      </div>
      <div className="table-wrap" ref={scrollRef} style={{ maxHeight: "70vh", overflowY: "auto" }}>
        <table className="table txn-table" style={{ tableLayout: Object.keys(prefs.widths).length ? "fixed" : "auto", width: Object.keys(prefs.widths).length ? orderedColumns.reduce((s, c) => s + (c.width ?? c.minWidth), 0) : "100%" }}>
          <colgroup>
            {orderedColumns.map((c) => <col key={c.id} style={{ width: c.width }} />)}
          </colgroup>
          <thead>
            <tr>
              {orderedColumns.map((col) => (
                <th
                  key={col.id}
                  ref={(el) => { headerRefs.current[col.id] = el; }}
                  className={[col.fixed && "txn-col-fixed", col.align === "right" && "text-end"].filter(Boolean).join(" ") || undefined}
                  draggable={!col.fixed}
                  onDragStart={() => setDragging(col.id)}
                  onDragOver={(e) => { if (dragging && !col.fixed) e.preventDefault(); }}
                  onDrop={() => { if (dragging && !col.fixed) reorder(dragging, col.id); setDragging(null); }}
                  onDragEnd={() => setDragging(null)}
                >
                  {col.id === "select" ? <input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} />
                    : col.id === "actions" ? (
                      <button type="button" className="btn ghost btn-sm" style={{ padding: "2px 6px" }} title="Download this view as CSV" aria-label="Download this view as CSV" onClick={downloadCsv}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" x2="12" y1="15" y2="3" />
                        </svg>
                      </button>
                    ) : col.id === "reset" ? (
                      <button type="button" className="btn ghost btn-sm" style={{ padding: "2px 6px" }} title="Reset columns to default" aria-label="Reset columns to default" onClick={resetColumns}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M3 12a9 9 0 1 0 3-6.7" />
                          <path d="M3 4v6h6" />
                          <path d="M8 12h8" />
                          <path d="M8 16h5" />
                        </svg>
                      </button>
                    ) : <span className="txn-th-label" title="Drag to reorder">{col.label}</span>}
                  {!col.fixed && <span className="col-resizer" onPointerDown={(e) => startResize(col.id, e)} />}
                </th>
              ))}
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
                  columns={orderedColumns}
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

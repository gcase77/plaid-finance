import { useMemo, useState } from "react";
import type { Tag, Txn } from "../types";
import TransactionTable from "../shared/TransactionTable";
import { getTxnDateOnly } from "../../utils/transactionUtils";

type TimelineView = "area" | "net";

type MonthRow = {
  key: string;
  label: string;
  income: number;
  spending: number;
  net: number;
  transactions: Txn[];
};

function fmt(n: number) {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function toMonthLabel(isoYYYYMM: string) {
  const [y, m] = isoYYYYMM.split("-");
  const dt = new Date(Number(y), Number(m) - 1, 1);
  return dt.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function buildMonthlyRows(txns: Txn[]): MonthRow[] {
  const map = new Map<string, MonthRow>();
  for (const t of txns) {
    const d = getTxnDateOnly(t);
    if (!d) continue;
    const key = d.slice(0, 7);
    const amt = t.amount ?? 0;
    if (amt === 0) continue;
    const row = map.get(key) ?? { key, label: toMonthLabel(key), income: 0, spending: 0, net: 0, transactions: [] };
    if (amt < 0) row.income += Math.abs(amt);
    else row.spending += amt;
    row.net = row.income - row.spending;
    row.transactions.push(t);
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function xyPoint(i: number, value: number, len: number, vMax: number, w: number, h: number, pad: number) {
  const iw = w - 2 * pad;
  const ih = h - 2 * pad;
  const x = len <= 1 ? w / 2 : pad + (i * iw) / (len - 1);
  const y = pad + ih - (value / Math.max(vMax, 1)) * ih;
  return { x, y };
}

export default function TimelineTrendChart({ transactions, tags }: { transactions: Txn[]; tags: Tag[] }) {
  const [view, setView] = useState<TimelineView>("area");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const rows = useMemo(() => buildMonthlyRows(transactions), [transactions]);
  const selected = useMemo(() => rows.find((r) => r.key === selectedMonth) ?? null, [rows, selectedMonth]);

  const width = 1200;
  const height = 420;
  const pad = 40;

  const vMax = useMemo(() => {
    if (!rows.length) return 1;
    if (view === "net") return Math.max(...rows.map((r) => Math.abs(r.net)), 1);
    return Math.max(...rows.map((r) => Math.max(r.income, r.spending)), 1);
  }, [rows, view]);

  if (!rows.length) return <p className="text-muted small mb-0">No timeline data in this range.</p>;

  const incomePoints = rows.map((r, i) => xyPoint(i, r.income, rows.length, vMax, width, height, pad));
  const spendPoints = rows.map((r, i) => xyPoint(i, r.spending, rows.length, vMax, width, height, pad));
  const incomePath = incomePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const spendPath = spendPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const zeroY = height / 2;
  const barWidth = Math.max(8, (width - 2 * pad) / rows.length - 4);

  return (
    <>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
        <div className="d-flex gap-3 small text-muted">
          <span><span className="badge" style={{ background: "rgba(29,158,117,0.25)", color: "#1D9E75", border: "1px solid #1D9E75" }}> </span> savings (gap)</span>
          <span><span className="badge" style={{ background: "rgba(216,90,48,0.25)", color: "#D85A30", border: "1px solid #D85A30" }}> </span> spending</span>
          <span><span className="badge" style={{ background: "rgba(186,117,23,0.25)", color: "#BA7517", border: "1px solid #BA7517" }}> </span> deficit</span>
        </div>
        <div className="btn-group btn-group-sm" role="group">
          <button type="button" className={`btn ${view === "area" ? "btn-secondary" : "btn-outline-secondary"}`} onClick={() => setView("area")}>Area</button>
          <button type="button" className={`btn ${view === "net" ? "btn-secondary" : "btn-outline-secondary"}`} onClick={() => setView("net")}>Net savings bar</button>
        </div>
      </div>

      <div className="overflow-x-auto border rounded p-2" style={{ background: "var(--bs-tertiary-bg)" }}>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-100" style={{ minWidth: 980, maxHeight: height }}>
          {view === "area" && rows.slice(0, -1).map((_, i) => {
            const a = incomePoints[i];
            const b = incomePoints[i + 1];
            const c = spendPoints[i + 1];
            const d = spendPoints[i];
            const avgNet = (rows[i].net + rows[i + 1].net) / 2;
            const fill = avgNet >= 0 ? "rgba(29,158,117,0.18)" : "rgba(186,117,23,0.22)";
            return <path key={`gap-${rows[i].key}`} d={`M ${a.x} ${a.y} L ${b.x} ${b.y} L ${c.x} ${c.y} L ${d.x} ${d.y} Z`} fill={fill} stroke="none" />;
          })}

          {view === "area" && (
            <>
              <path d={incomePath} fill="none" stroke="#1D9E75" strokeWidth={2.5} />
              <path d={spendPath} fill="none" stroke="#D85A30" strokeWidth={2.5} />
              {rows.map((r, i) => (
                <g key={`pt-${r.key}`}>
                  <circle cx={incomePoints[i].x} cy={incomePoints[i].y} r={3} fill="#1D9E75" style={{ cursor: "pointer" }} onClick={() => setSelectedMonth(r.key)} />
                  <circle cx={spendPoints[i].x} cy={spendPoints[i].y} r={3} fill="#D85A30" style={{ cursor: "pointer" }} onClick={() => setSelectedMonth(r.key)} />
                </g>
              ))}
            </>
          )}

          {view === "net" && (
            <>
              <line x1={pad} y1={zeroY} x2={width - pad} y2={zeroY} stroke="rgba(120,120,120,0.35)" strokeWidth={1} />
              {rows.map((r, i) => {
                const x = xyPoint(i, 0, rows.length, 1, width, height, pad).x - barWidth / 2;
                const h = (Math.abs(r.net) / Math.max(vMax, 1)) * (height / 2 - pad);
                const y = r.net >= 0 ? zeroY - h : zeroY;
                return (
                  <rect
                    key={`bar-${r.key}`}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(1, h)}
                    rx={3}
                    fill={r.net >= 0 ? "rgba(29,158,117,0.7)" : "rgba(216,90,48,0.7)"}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedMonth(r.key)}
                  />
                );
              })}
            </>
          )}

          {rows.map((r, i) => {
            const x = xyPoint(i, 0, rows.length, 1, width, height, pad).x;
            if (i % Math.ceil(rows.length / 12) !== 0 && i !== rows.length - 1) return null;
            return <text key={`xl-${r.key}`} x={x} y={height - 8} textAnchor="middle" fontSize="10" fill="var(--bs-secondary-color)">{r.label}</text>;
          })}
        </svg>
      </div>

      <p className="text-muted small mt-2 mb-0">
        {selected ? `${selected.label}: income ${fmt(selected.income)}, spending ${fmt(selected.spending)}, ${selected.net >= 0 ? `saved ${fmt(selected.net)}` : `deficit ${fmt(Math.abs(selected.net))}`}` : "Click a month point or bar to view composing transactions."}
      </p>

      {selected && (
        <div className="mt-3 border-top pt-3">
          <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <h6 className="small mb-0 fw-semibold">{selected.label}</h6>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedMonth(null)}>Clear</button>
          </div>
          <TransactionTable transactions={selected.transactions} tags={tags} keyPrefix="viz-timeline" />
        </div>
      )}
    </>
  );
}

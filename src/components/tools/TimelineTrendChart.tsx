import { useMemo, useState } from "react";
import type { Tag, Txn } from "../types";
import TransactionTable from "../shared/TransactionTable";
import { Segmented } from "../shared/ui";
import { expandNettingGroupsForDisplay } from "../../utils/nettingUtils";
import { buildTrendPeriodRows } from "./visualizeTrendsUtils";

export type TimelineView = "area" | "net";
export type TimelineGranularity = "month" | "week";

const fmt = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

const padL = 72, padR = 22, padTop = 34, padBottom = 28;
function axisTicksArea(vMax: number) {
  return [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(vMax * p));
}
function axisTicksNet(vMax: number) {
  const m = Math.max(vMax, 1);
  return [-m, -m / 2, 0, m / 2, m].map((t) => Math.round(t * 100) / 100);
}
function tickLabel(t: number) {
  const s = t < 0 ? "-" : "";
  return `${s}${fmt(Math.abs(t))}`;
}

export default function TimelineTrendChart({ transactions, allTransactions, tags, view, granularity, onViewChange, onGranularityChange }: {
  transactions: Txn[]; allTransactions: Txn[]; tags: Tag[]; view: TimelineView; granularity: TimelineGranularity;
  onViewChange: (v: TimelineView) => void; onGranularityChange: (g: TimelineGranularity) => void;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const rows = useMemo(() => buildTrendPeriodRows(transactions, granularity), [transactions, granularity]);
  const selected = rows.find((r) => r.key === selectedKey) ?? null;
  const selectedTransactions = useMemo(() => expandNettingGroupsForDisplay(selected?.transactions ?? [], allTransactions), [selected, allTransactions]);

  const width = 1200, height = 420;
  const vMax = useMemo(() => {
    if (!rows.length) return 1;
    if (view === "net") return Math.max(...rows.map((r) => Math.abs(r.net)), 1);
    return Math.max(...rows.map((r) => Math.max(r.income, r.spending)), 1);
  }, [rows, view]);

  if (!rows.length) return <p className="muted small">No timeline data in this range.</p>;

  const iw = width - padL - padR;
  const ih = height - padTop - padBottom;
  const vm = Math.max(vMax, 1);
  const xAt = (i: number) => rows.length <= 1 ? (padL + width - padR) / 2 : padL + (i * iw) / (rows.length - 1);
  const yArea = (v: number) => padTop + ih - (v / vm) * ih;
  const zeroY = padTop + ih / 2;
  const halfBand = ih / 2;
  const yNet = (signed: number) => zeroY - (signed / vm) * halfBand;
  const yTicks = view === "area" ? axisTicksArea(vMax) : axisTicksNet(vMax);

  const incomePts = rows.map((r, i) => ({ x: xAt(i), y: yArea(r.income) }));
  const spendPts = rows.map((r, i) => ({ x: xAt(i), y: yArea(r.spending) }));
  const incPath = incomePts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const spdPath = spendPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const barW = Math.max(8, iw / rows.length - 4);
  const xSkip = Math.max(1, Math.ceil(rows.length / 12));

  return (
    <>
      <div className="between mb-3 flex-wrap gap-3">
        <div className="row-flex gap-4 small">
          <span className="row-flex gap-2"><span style={{ width: 18, height: 3, background: "var(--success)", borderRadius: 2 }} /><span className="fw-semi">Income</span></span>
          <span className="row-flex gap-2"><span style={{ width: 18, height: 3, background: "var(--danger)", borderRadius: 2 }} /><span className="fw-semi">Spending</span></span>
        </div>
        <div className="row-flex gap-2 flex-wrap">
          <Segmented value={granularity} onChange={(v) => { onGranularityChange(v); setSelectedKey(null); }} options={[{ value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
          <Segmented value={view} onChange={onViewChange} options={[{ value: "area", label: "Area" }, { value: "net", label: "Net savings" }]} />
        </div>
      </div>

      <div className="viz-wrap" style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", minWidth: 980, maxHeight: height }}>
          {yTicks.map((t, ti) => {
            const yy = view === "area" ? yArea(Math.max(0, t)) : yNet(t);
            return (
              <g key={`${view}-yt-${ti}-${t}`}>
                <line x1={padL - 8} x2={width - padR} y1={yy} y2={yy} stroke="var(--line)" strokeOpacity={view === "net" && t === 0 ? 0.85 : 0.65} />
                <text x={padL - 12} y={yy + 4} textAnchor="end" fontSize="10" fill="var(--ink-muted)">{tickLabel(t)}</text>
              </g>
            );
          })}
          {view === "area" && rows.slice(0, -1).map((_, i) => {
            const a = incomePts[i], b = incomePts[i + 1], c = spendPts[i + 1], d = spendPts[i];
            const avg = (rows[i].net + rows[i + 1].net) / 2;
            const fill = avg >= 0 ? "var(--success-soft)" : "var(--danger-soft)";
            return <path key={`gap-${rows[i].key}`} d={`M ${a.x} ${a.y} L ${b.x} ${b.y} L ${c.x} ${c.y} L ${d.x} ${d.y} Z`} fill={fill} />;
          })}
          {view === "area" && (
            <>
              <path d={incPath} fill="none" stroke="var(--success)" strokeWidth={2.5} />
              <path d={spdPath} fill="none" stroke="var(--danger)" strokeWidth={2.5} />
              {rows.map((r, i) => (
                <g key={`pt-${r.key}`}>
                  <circle cx={incomePts[i].x} cy={incomePts[i].y} r={3} fill="var(--success)" style={{ cursor: "pointer" }} onClick={() => setSelectedKey(r.key)} />
                  <circle cx={spendPts[i].x} cy={spendPts[i].y} r={3} fill="var(--danger)" style={{ cursor: "pointer" }} onClick={() => setSelectedKey(r.key)} />
                </g>
              ))}
            </>
          )}
          {view === "net" && (
            <>
              {rows.map((r, i) => {
                const x = xAt(i) - barW / 2;
                const h = (Math.abs(r.net) / vm) * halfBand;
                const y = r.net >= 0 ? zeroY - h : zeroY;
                const labelY = r.net >= 0 ? y - 5 : y + h + 12;
                return (
                  <g key={`bar-${r.key}`}>
                    <rect x={x} y={y} width={barW} height={Math.max(1, h)} rx={3} fill={r.net >= 0 ? "var(--success)" : "var(--danger)"} opacity={0.75} style={{ cursor: "pointer" }} onClick={() => setSelectedKey(r.key)} />
                    {r.net !== 0 && <text x={xAt(i)} y={labelY} textAnchor="middle" fontSize="10" fill="var(--ink-muted)">Net {tickLabel(r.net)}</text>}
                  </g>
                );
              })}
            </>
          )}
          {rows.map((r, i) => {
            const x = xAt(i);
            if (i % xSkip !== 0 && i !== rows.length - 1) return null;
            return <text key={`xl-${r.key}`} x={x} y={height - 8} textAnchor="middle" fontSize="10" fill="var(--ink-muted)">{r.label}</text>;
          })}
        </svg>
      </div>

      {selected && (
        <p className="muted small mt-3">{selected.label}: income {fmt(selected.income)}, spending {fmt(selected.spending)}, {selected.net >= 0 ? `saved ${fmt(selected.net)}` : `deficit ${fmt(Math.abs(selected.net))}`}</p>
      )}

      {selected && (
        <div className="card mt-3">
          <div className="between mb-3">
            <h4>{selected.label}</h4>
            <button className="btn ghost btn-sm" onClick={() => setSelectedKey(null)}>Clear</button>
          </div>
          <TransactionTable transactions={selectedTransactions} tags={tags} keyPrefix="viz-timeline" nettingMode />
        </div>
      )}
    </>
  );
}

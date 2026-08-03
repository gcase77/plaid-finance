import { useMemo, useState } from "react";
import type { Tag, Txn } from "../types";
import { expandNettingGroupsForDisplay } from "../../utils/nettingUtils";
import { buildTrendPeriodRows } from "../tools/visualizeTrendsUtils";
import LandingVizTxnPanel from "./LandingVizTxnPanel";

export type TimelineView = "area" | "net";
export type TimelineGranularity = "month" | "week";

const fmt = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const padL = 72, padR = 22, padTop = 34, padBottom = 28, plotInset = 28;
const axisTicksArea = (vMax: number) => [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(vMax * p));
const axisTicksNet = (vMax: number) => {
  const m = Math.max(vMax, 1);
  return [-m, -m / 2, 0, m / 2, m].map((t) => Math.round(t * 100) / 100);
};
const tickLabel = (t: number) => `${t < 0 ? "-" : ""}${fmt(Math.abs(t))}`;

function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }> }) {
  return (
    <div className="segmented" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" className={value === o.value ? "active" : ""} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export default function LandingTimelineChart({
  transactions, allTransactions, tags, view, onViewChange,
}: {
  transactions: Txn[];
  allTransactions: Txn[];
  tags: Tag[];
  view: TimelineView;
  onViewChange: (v: TimelineView) => void;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const rows = useMemo(() => buildTrendPeriodRows(transactions, "week"), [transactions]);
  const selected = rows.find((r) => r.key === selectedKey) ?? null;
  const selectedTxns = useMemo(
    () => expandNettingGroupsForDisplay(selected?.transactions ?? [], allTransactions),
    [selected, allTransactions]
  );
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
  const xAt = (i: number) => {
    const left = padL + plotInset;
    const span = Math.max(iw - plotInset * 2, 1);
    return rows.length <= 1 ? left + span / 2 : left + (i * span) / (rows.length - 1);
  };
  const yArea = (v: number) => padTop + ih - (v / vm) * ih;
  const zeroY = padTop + ih / 2;
  const halfBand = ih / 2;
  const yNet = (signed: number) => zeroY - (signed / vm) * halfBand;
  const yTicks = view === "area" ? axisTicksArea(vMax) : axisTicksNet(vMax);
  const incomePts = rows.map((r, i) => ({ x: xAt(i), y: yArea(r.income) }));
  const spendPts = rows.map((r, i) => ({ x: xAt(i), y: yArea(r.spending) }));
  const incPath = incomePts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const spdPath = spendPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const barW = Math.max(14, iw / rows.length - 4);
  const hitW = Math.max(barW + 12, 28);
  const xSkip = Math.max(1, Math.ceil(rows.length / 12));

  return (
    <>
      <div className="between mb-3 flex-wrap gap-3">
        <div className="row-flex gap-4 small">
          <span className="row-flex gap-2"><span style={{ width: 18, height: 3, background: "var(--success)", borderRadius: 2 }} /><span className="fw-semi">Income</span></span>
          <span className="row-flex gap-2"><span style={{ width: 18, height: 3, background: "var(--danger)", borderRadius: 2 }} /><span className="fw-semi">Spending</span></span>
        </div>
        <Seg value={view} onChange={(v) => { onViewChange(v); setSelectedKey(null); }} options={[{ value: "area", label: "Area" }, { value: "net", label: "Net savings" }]} />
      </div>
      <div className="viz-wrap" style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", minWidth: 720, maxHeight: height }}>
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
            return <path key={`gap-${rows[i].key}`} d={`M ${a.x} ${a.y} L ${b.x} ${b.y} L ${c.x} ${c.y} L ${d.x} ${d.y} Z`} fill={avg >= 0 ? "var(--success-soft)" : "var(--danger-soft)"} />;
          })}
          {view === "area" && (
            <>
              <path d={incPath} fill="none" stroke="var(--success)" strokeWidth={2.5} />
              <path d={spdPath} fill="none" stroke="var(--danger)" strokeWidth={2.5} />
              {rows.map((r, i) => {
                const hot = hoverKey === r.key || selectedKey === r.key;
                return (
                  <g key={`pt-${r.key}`} className="landing-viz-hit" style={{ cursor: "pointer" }}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setHoverKey(r.key)} onMouseLeave={() => setHoverKey(null)}
                    onClick={() => setSelectedKey((k) => (k === r.key ? null : r.key))}
                  >
                    <circle cx={xAt(i)} cy={(incomePts[i].y + spendPts[i].y) / 2} r={16} fill="transparent" />
                    <circle cx={incomePts[i].x} cy={incomePts[i].y} r={hot ? 6 : 4} fill="var(--success)" stroke={hot ? "var(--ink)" : "none"} strokeWidth={hot ? 1.5 : 0} />
                    <circle cx={spendPts[i].x} cy={spendPts[i].y} r={hot ? 6 : 4} fill="var(--danger)" stroke={hot ? "var(--ink)" : "none"} strokeWidth={hot ? 1.5 : 0} />
                  </g>
                );
              })}
            </>
          )}
          {view === "net" && rows.map((r, i) => {
            const x = xAt(i) - barW / 2;
            const h = (Math.abs(r.net) / vm) * halfBand;
            const y = r.net >= 0 ? zeroY - h : zeroY;
            const hot = hoverKey === r.key || selectedKey === r.key;
            return (
              <g key={`bar-${r.key}`} className="landing-viz-hit" style={{ cursor: "pointer" }}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHoverKey(r.key)} onMouseLeave={() => setHoverKey(null)}
                onClick={() => setSelectedKey((k) => (k === r.key ? null : r.key))}
              >
                <rect x={xAt(i) - hitW / 2} y={Math.min(y, zeroY) - 4} width={hitW} height={Math.max(h, 1) + 8} fill="transparent" />
                <rect x={x} y={y} width={barW} height={Math.max(1, h)} rx={3}
                  fill={r.net >= 0 ? "var(--success)" : "var(--danger)"}
                  opacity={hot ? 1 : 0.75}
                  stroke={hot ? "var(--ink)" : "none"} strokeWidth={hot ? 1.5 : 0}
                />
                {r.net !== 0 && <text x={xAt(i)} y={r.net >= 0 ? y - 5 : y + h + 12} textAnchor="middle" fontSize="10" fill="var(--ink-muted)">{tickLabel(r.net)}</text>}
              </g>
            );
          })}
          {rows.map((r, i) => {
            if (i % xSkip !== 0 && i !== rows.length - 1) return null;
            return <text key={`xl-${r.key}`} x={xAt(i)} y={height - 8} textAnchor="middle" fontSize="10" fill="var(--ink-muted)">{r.label}</text>;
          })}
        </svg>
      </div>
      {selected && (
        <LandingVizTxnPanel
          title={selected.label}
          transactions={selectedTxns}
          tags={tags}
          onClear={() => setSelectedKey(null)}
          keyPrefix="landing-viz-timeline"
        />
      )}
    </>
  );
}

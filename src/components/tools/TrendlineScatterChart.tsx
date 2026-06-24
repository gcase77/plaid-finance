import { useMemo, useState } from "react";
import type { Tag, Txn } from "../types";
import TransactionTable from "../shared/TransactionTable";
import { Segmented } from "../shared/ui";
import { getTxnDateOnly } from "../../utils/transactionUtils";
import { expandNettingGroupsForDisplay } from "../../utils/nettingUtils";
import { buildTrendPeriodRows, type TrendPeriodGranularity, type TrendPeriodRow } from "./visualizeTrendsUtils";

export type TrendlineKind = "regression" | "cumulative";
export type TrendlineSeriesView = "both" | "income" | "spending";

const fmt = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const tickLabel = (t: number) => `${t < 0 ? "-" : ""}${fmt(Math.abs(t))}`;
const axisTicksPositive = (vMax: number) => [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(vMax * p * 100) / 100);
const padL = 72, padR = 22, padTop = 34, padBottom = 28, W = 1200, H = 420;
const fmtDay = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });

type Pt = { txn: Txn; ms: number; ySigned: number; income: boolean };
type TrendPt = { ms: number; y: number };
type TrendSeries = { key: string; label: string; color: string; pts: TrendPt[] };
type PeriodPt = TrendPeriodRow & { ms: number };

const rowKey = (p: Pt, i: number) => p.txn.transaction_id ?? `__${i}_${p.ms}_${p.txn.amount}_${p.txn.account_id ?? ""}`;
const clampInt = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number.isFinite(n) ? n : min)));
const linePath = (pts: TrendPt[], xAt: (ms: number) => number, yAt: (v: number) => number) => pts.map((p, i) => `${i ? "L" : "M"} ${xAt(p.ms)} ${yAt(p.y)}`).join(" ");

function polynomialFit(samples: Array<{ x: number; y: number }>, degree: number): number[] {
  const deg = Math.min(degree, Math.max(0, samples.length - 1));
  const n = deg + 1;
  const a = samples.map(({ x }) => Array.from({ length: n }, (_, i) => x ** i));
  const q: number[][] = [];
  const r = Array.from({ length: n }, () => Array(n).fill(0) as number[]);
  for (let j = 0; j < n; j++) {
    let v = a.map((row) => row[j]);
    for (let i = 0; i < j; i++) {
      r[i][j] = v.reduce((sum, val, k) => sum + val * q[i][k], 0);
      v = v.map((val, k) => val - r[i][j] * q[i][k]);
    }
    r[j][j] = Math.hypot(...v);
    if (r[j][j] < 1e-10) return [samples.reduce((s, p) => s + p.y, 0) / samples.length];
    q[j] = v.map((val) => val / r[j][j]);
  }
  const qty = q.map((col) => col.reduce((sum, val, k) => sum + val * samples[k].y, 0));
  const coeffs = Array(n).fill(0) as number[];
  for (let i = n - 1; i >= 0; i--) {
    const known = coeffs.reduce((sum, c, j) => sum + (j > i ? r[i][j] * c : 0), 0);
    coeffs[i] = (qty[i] - known) / r[i][i];
  }
  return coeffs;
}

function polynomialLine(pts: TrendPt[], degree: number, t0: number, t1: number): TrendPt[] {
  if (!pts.length) return [];
  const span = Math.max(t1 - t0, 1);
  const coeffs = polynomialFit(pts.map((p) => ({ x: ((p.ms - t0) / span) * 2 - 1, y: p.y })), degree);
  return Array.from({ length: 80 }, (_, i) => {
    const x = (i / 79) * 2 - 1;
    return { ms: t0 + ((x + 1) / 2) * span, y: coeffs.reduce((s, c, pow) => s + c * x ** pow, 0) };
  });
}

function cumulativeLine(pts: Pt[]): TrendPt[] {
  let total = 0;
  return pts.map((p) => {
    total += p.ySigned;
    return { ms: p.ms, y: total };
  });
}

export default function TrendlineScatterChart({
  transactions, allTransactions, tags, kind, seriesView, granularity, degree, onKindChange, onSeriesViewChange, onGranularityChange, onDegreeChange
}: {
  transactions: Txn[]; allTransactions: Txn[]; tags: Tag[]; kind: TrendlineKind; seriesView: TrendlineSeriesView; granularity: TrendPeriodGranularity; degree: number;
  onKindChange: (v: TrendlineKind) => void; onSeriesViewChange: (v: TrendlineSeriesView) => void; onGranularityChange: (v: TrendPeriodGranularity) => void; onDegreeChange: (v: number) => void;
}) {
  const [selId, setSelId] = useState<string | null>(null);
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string | null>(null);
  const points = useMemo((): Pt[] => {
    const out: Pt[] = [];
    transactions.forEach((txn) => {
      const amt = txn.amount ?? 0;
      if (amt === 0) return;
      const d = getTxnDateOnly(txn);
      if (!d) return;
      out.push({ txn, ms: +new Date(`${d}T12:00:00`), ySigned: -amt, income: amt < 0 });
    });
    out.sort((a, b) => a.ms - b.ms);
    return out;
  }, [transactions]);

  const selected = useMemo(
    () => (selId ? points.find((p, i) => rowKey(p, i) === selId)?.txn ?? null : null),
    [selId, points]
  );
  const selectedRows = useMemo(
    () => selected?.netting_group
      ? allTransactions.filter((t) => t.netting_group === selected.netting_group)
      : selected ? [selected] : [],
    [allTransactions, selected]
  );

  const periodPoints = useMemo((): PeriodPt[] => buildTrendPeriodRows(transactions, granularity).map((r) => ({
    ...r,
    ms: +new Date(`${r.key.length === 7 ? `${r.key}-01` : r.key}T12:00:00`)
  })), [transactions, granularity]);
  const selectedPeriod = periodPoints.find((p) => p.key === selectedPeriodKey) ?? null;
  const selectedPeriodTransactions = selectedPeriod
    ? seriesView === "income" ? selectedPeriod.incomeTransactions
      : seriesView === "spending" ? selectedPeriod.spendingTransactions
        : selectedPeriod.transactions
    : [];
  const expandedSelectedPeriodTransactions = useMemo(
    () => expandNettingGroupsForDisplay(selectedPeriodTransactions, allTransactions),
    [selectedPeriodTransactions, allTransactions]
  );

  const rawSeries = useMemo((): TrendSeries[] => {
    const label = kind === "regression" ? "Regression" : "Cumulative net";
    if (kind === "cumulative") return [{ key: "cumulative", label, color: "var(--brand)", pts: cumulativeLine(points) }];
    if (!periodPoints.length) return [];
    const t0 = periodPoints[0].ms;
    const t1 = periodPoints.at(-1)?.ms ?? t0 + 864e5;
    const build = (field: "income" | "spending") => polynomialLine(periodPoints.map((p) => ({ ms: p.ms, y: p[field] })), degree, t0, t1);
    return [
      ...(seriesView !== "spending" ? [{ key: "income", label: `Income ${label}`, color: "var(--success)", pts: build("income") }] : []),
      ...(seriesView !== "income" ? [{ key: "spending", label: `Spending ${label}`, color: "var(--danger)", pts: build("spending") }] : [])
    ].filter((s) => s.pts.length);
  }, [points, periodPoints, kind, degree, seriesView]);

  const compareMode = false;
  const series = useMemo(
    () => rawSeries,
    [rawSeries]
  );

  const layout = useMemo(() => {
    const ih = H - padTop - padBottom, iw = W - padL - padR;
    const source = kind === "regression" ? periodPoints : points;
    if (!source.length) return null;
    const lineVals = series.flatMap((s) => s.pts.map((p) => p.y));
    const t0 = Math.min(...source.map((p) => p.ms));
    const max = Math.max(...source.map((p) => p.ms));
    const t1 = max <= t0 ? t0 + 864e5 : max;
    const xAt = (ms: number) => padL + ((ms - t0) / (t1 - t0)) * iw;
    const xTicks = kind === "regression" ? periodPoints.map((p) => p.ms) : Array.from({ length: 6 }, (_, i) => Math.round(t0 + ((t1 - t0) * i) / 5));

    if (kind === "regression" || compareMode) {
      const periodVals = periodPoints.flatMap((p) => seriesView === "income" ? [p.income] : seriesView === "spending" ? [p.spending] : [p.income, p.spending]);
      const vm = Math.max(...lineVals.map((v) => Math.abs(v)), ...periodVals, 1);
      const zeroY = padTop + ih, half = ih;
      const yAt = (s: number) => zeroY - (s / vm) * half;
      return { zeroY, half, xAt, yAt, xTicks, yTicks: axisTicksPositive(vm) };
    }

    const vals = [...points.map((p) => p.ySigned), ...lineVals];
    const posMax = Math.max(...vals.filter((v) => v > 0), 1);
    const negMax = Math.max(...vals.filter((v) => v < 0).map((v) => Math.abs(v)), 1);
    const zeroY = padTop + ih / 2, half = ih / 2;
    const yAt = (s: number) => s >= 0 ? zeroY - (s / posMax) * half : zeroY + (Math.abs(s) / negMax) * half;
    return {
      zeroY, half, xAt, yAt, xTicks,
      yTicks: [...axisTicksPositive(posMax).filter((t) => t > 0), ...axisTicksPositive(negMax).filter((t) => t > 0).map((t) => -t)]
    };
  }, [points, periodPoints, series, kind, compareMode, seriesView]);

  if ((kind === "regression" ? !periodPoints.length : !points.length) || !layout) return <p className="muted small">No transactions in this range (transfers excluded; netting groups collapsed).</p>;

  const { zeroY, xAt, yAt, xTicks, yTicks } = layout;
  const r = points.length > 400 ? 2.8 : 3.8;
  const shownSelected = kind === "regression" || compareMode ? null : selected;
  const barW = Math.max(12, Math.min(46, (W - padL - padR) / Math.max(periodPoints.length, 1) - 4));
  const xSkip = Math.max(1, Math.ceil(xTicks.length / 12));
  const cumulativeFinal = kind === "cumulative" ? series[0]?.pts.at(-1) : null;

  return (
    <>
      <div className="between mb-3 flex-wrap gap-3">
        <div className="row-flex gap-6 small">
          {kind === "cumulative" ? (
            <div className="row-flex gap-2" style={{ alignItems: "center" }}><span style={{ width: 18, height: 3, background: "var(--brand)", borderRadius: 2 }} aria-hidden /><span className="fw-semi">Cumulative net</span></div>
          ) : (
            <>
              {seriesView !== "spending" && <div className="row-flex gap-2" style={{ alignItems: "center" }}><span style={{ width: 18, height: 3, background: "var(--success)", borderRadius: 2 }} aria-hidden /><span className="fw-semi">Income</span></div>}
              {seriesView !== "income" && <div className="row-flex gap-2" style={{ alignItems: "center" }}><span style={{ width: 18, height: 3, background: "var(--danger)", borderRadius: 2 }} aria-hidden /><span className="fw-semi">Spending</span></div>}
            </>
          )}
        </div>
        <span className="small muted">{kind === "regression" ? `${periodPoints.length} periods` : `${points.length} points`}</span>
      </div>
      <div className="row-flex gap-2 flex-wrap mb-3">
        <span className="small muted">Trendline</span>
        <Segmented value={kind} onChange={onKindChange} options={[
          { value: "regression", label: "Regression" },
          { value: "cumulative", label: "Cumulative Sum" }
        ]} />
        {kind === "regression" && (
          <>
            <Segmented value={granularity} onChange={(v) => { onGranularityChange(v); setSelectedPeriodKey(null); }} options={[{ value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
            <Segmented value={seriesView} onChange={onSeriesViewChange} options={[{ value: "both", label: "Both" }, { value: "income", label: "Income" }, { value: "spending", label: "Spending" }]} />
            <label className="row-flex gap-2 small" style={{ alignItems: "center" }}>
              <span className="muted">Degree</span>
              <input type="number" min={1} max={10} step={1} className="input input-sm" value={degree} onChange={(e) => onDegreeChange(clampInt(Number(e.target.value), 1, 10))} style={{ width: "5rem" }} />
            </label>
          </>
        )}
      </div>
      <div className="viz-wrap" style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 980, maxHeight: H }} role="img" aria-label="One point per transaction, date on horizontal axis, signed amount on vertical axis">
          {kind !== "regression" && !compareMode && (
            <>
              <rect x={padL - 8} y={padTop} width={W - padL - padR + 16} height={layout.half} fill="var(--success-soft)" opacity={0.22} />
              <rect x={padL - 8} y={zeroY} width={W - padL - padR + 16} height={layout.half} fill="var(--danger-soft)" opacity={0.22} />
            </>
          )}
          {yTicks.filter((t) => compareMode || t !== 0).map((t, ti) => {
            const yy = yAt(t);
            return (
              <g key={`yt-${ti}-${t}`}>
                <line x1={padL - 8} x2={W - padR} y1={yy} y2={yy} stroke="var(--line)" strokeOpacity={0.55} />
                <text x={padL - 12} y={yy + 4} textAnchor="end" fontSize="10" fill="var(--ink-muted)">{tickLabel(t)}</text>
              </g>
            );
          })}
          <line x1={padL - 8} x2={W - padR} y1={zeroY} y2={zeroY} stroke="var(--ink)" strokeOpacity={0.45} strokeWidth={2.75} strokeLinecap="square" pointerEvents="none" />
          {kind === "regression" && periodPoints.map((p) => {
            const x = xAt(p.ms) - barW / 2;
            const hi = seriesView === "income" ? p.income : seriesView === "spending" ? p.spending : Math.max(p.income, p.spending);
            const lo = seriesView === "both" ? Math.min(p.income, p.spending) : 0;
            const active = selectedPeriodKey === p.key;
            const barTotal = seriesView === "income" ? p.income : seriesView === "spending" ? p.spending : 0;
            return (
              <g key={`period-${p.key}`} style={{ cursor: "pointer" }} onClick={() => setSelectedPeriodKey((k) => k === p.key ? null : p.key)}>
                {hi > 0 && <rect x={x} y={yAt(hi)} width={barW} height={Math.max(1, yAt(lo) - yAt(hi))} rx={3} fill={seriesView === "income" || (seriesView === "both" && p.income >= p.spending) ? "var(--success)" : "var(--danger)"} opacity={active ? 0.95 : 0.72} />}
                {lo > 0 && <rect x={x} y={yAt(lo)} width={barW} height={Math.max(1, yAt(0) - yAt(lo))} rx={3} fill={p.income >= p.spending ? "var(--danger)" : "var(--success)"} opacity={active ? 0.95 : 0.72} />}
                {barTotal > 0 && <text x={xAt(p.ms)} y={yAt(barTotal) - 5} textAnchor="middle" fontSize="10" fill="var(--ink-muted)">{fmt(barTotal)}</text>}
                <title>{`${p.label}: income ${fmt(p.income)}, spending ${fmt(p.spending)}`}</title>
              </g>
            );
          })}
          {series.map((s) => (
            <path key={s.key} d={linePath(s.pts, xAt, yAt)} fill="none" stroke={s.color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity={0.95}>
              <title>{s.label}</title>
            </path>
          ))}
          {cumulativeFinal && (
            <g>
              <circle cx={xAt(cumulativeFinal.ms)} cy={yAt(cumulativeFinal.y)} r={4.5} fill="var(--brand)" />
              <text x={Math.min(W - padR - 6, xAt(cumulativeFinal.ms) + 10)} y={yAt(cumulativeFinal.y) - 8} textAnchor="end" fontSize="12" fontWeight={700} fill="var(--ink)">
                {fmt(cumulativeFinal.y)}
              </text>
            </g>
          )}
          {kind !== "regression" && !compareMode && points.map((p, i) => {
            const id = rowKey(p, i);
            const active = selId === id;
            return (
              <circle
                key={id}
                cx={xAt(p.ms)}
                cy={yAt(p.ySigned)}
                r={active ? r + 2 : r}
                fill={p.income ? "var(--success)" : "var(--danger)"}
                opacity={active ? 1 : 0.72}
                style={{ cursor: "pointer" }}
                onClick={() => setSelId((s) => (s === id ? null : id))}
              >
                <title>{`${fmtDay(p.ms)} — ${p.txn.merchant_name || p.txn.name || "Transaction"} (${p.income ? "+" : "−"}${fmt(Math.abs(p.txn.amount ?? 0))})`}</title>
              </circle>
            );
          })}
          <text aria-hidden x={padL - 12} y={zeroY + 4} textAnchor="end" fontSize="11" fontWeight={700} fill="var(--ink)">{tickLabel(0)}</text>
          {xTicks.map((ms, i) => (
            (i % xSkip === 0 || i === xTicks.length - 1) && <text key={ms} x={xAt(ms)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--ink-muted)">{kind === "regression" ? periodPoints.find((p) => p.ms === ms)?.label : fmtDay(ms)}</text>
          ))}
        </svg>
      </div>
      {selectedPeriod && (
        <p className="muted small mt-3">{selectedPeriod.label}: income {fmt(selectedPeriod.income)}, spending {fmt(selectedPeriod.spending)}, {selectedPeriod.net >= 0 ? `saved ${fmt(selectedPeriod.net)}` : `deficit ${fmt(Math.abs(selectedPeriod.net))}`}</p>
      )}
      {selectedPeriod && (
        <div className="card mt-3">
          <div className="between mb-3 flex-wrap gap-2">
            <h4>{selectedPeriod.label}</h4>
            <button type="button" className="btn ghost btn-sm" onClick={() => setSelectedPeriodKey(null)}>Clear</button>
          </div>
          <TransactionTable transactions={expandedSelectedPeriodTransactions} tags={tags} keyPrefix="viz-trendline-period" nettingMode />
        </div>
      )}
      {shownSelected && (
        <p className="muted small mt-3">
          {fmtDay(+new Date(`${getTxnDateOnly(shownSelected) ?? ""}T12:00:00`))} — {(shownSelected.amount ?? 0) < 0 ? `Income +${fmt(Math.abs(shownSelected.amount ?? 0))}` : `Spending −${fmt(shownSelected.amount ?? 0)}`}
          {shownSelected.merchant_name || shownSelected.name ? ` · ${shownSelected.merchant_name || shownSelected.name}` : ""}
        </p>
      )}
      {shownSelected && (
        <div className="card mt-3">
          <div className="between mb-3 flex-wrap gap-2">
            <h4>Transaction</h4>
            <button type="button" className="btn ghost btn-sm" onClick={() => setSelId(null)}>Clear</button>
          </div>
          <TransactionTable transactions={selectedRows} tags={tags} keyPrefix="viz-trendline-txn" nettingMode />
        </div>
      )}
    </>
  );
}

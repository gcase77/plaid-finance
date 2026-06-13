import { useMemo, useState } from "react";
import type { Tag, Txn } from "../types";
import TransactionTable from "../shared/TransactionTable";
import { Segmented, Switch } from "../shared/ui";
import { getTxnDateOnly } from "../../utils/transactionUtils";

export type TrendlineKind = "ema" | "sma" | "polynomial" | "cumulative";

const fmt = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const tickLabel = (t: number) => `${t < 0 ? "-" : ""}${fmt(Math.abs(t))}`;
const axisTicksPositive = (vMax: number) => [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(vMax * p * 100) / 100);
const padL = 72, padR = 22, padTop = 34, padBottom = 28, W = 1200, H = 420;
const fmtDay = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });

type Pt = { txn: Txn; ms: number; ySigned: number; income: boolean };
type TrendPt = { ms: number; y: number };
type TrendSeries = { key: string; label: string; color: string; pts: TrendPt[] };

const rowKey = (p: Pt, i: number) => p.txn.transaction_id ?? `__${i}_${p.ms}_${p.txn.amount}_${p.txn.account_id ?? ""}`;
const clampInt = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number.isFinite(n) ? n : min)));
const linePath = (pts: TrendPt[], xAt: (ms: number) => number, yAt: (v: number) => number) => pts.map((p, i) => `${i ? "L" : "M"} ${xAt(p.ms)} ${yAt(p.y)}`).join(" ");

function movingAverage(pts: Pt[], windowSize: number, exponential: boolean): TrendPt[] {
  if (!pts.length) return [];
  const alpha = 2 / (windowSize + 1);
  let ema = pts[0].ySigned;
  return pts.map((p, i) => {
    if (exponential) {
      ema = i === 0 ? p.ySigned : p.ySigned * alpha + ema * (1 - alpha);
      return { ms: p.ms, y: ema };
    }
    const start = Math.max(0, i - windowSize + 1);
    const slice = pts.slice(start, i + 1);
    return { ms: p.ms, y: slice.reduce((s, x) => s + x.ySigned, 0) / slice.length };
  });
}

function polynomialFit(samples: Array<{ x: number; y: number }>, degree: number): number[] {
  const deg = Math.min(degree, Math.max(0, samples.length - 1));
  const n = deg + 1;
  const a = Array.from({ length: n }, () => Array(n + 1).fill(0) as number[]);
  for (const { x, y } of samples) {
    const powers = Array.from({ length: 2 * deg + 1 }, (_, i) => x ** i);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) a[r][c] += powers[r + c];
      a[r][n] += y * powers[r];
    }
  }
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(a[r][i]) > Math.abs(a[pivot][i])) pivot = r;
    if (Math.abs(a[pivot][i]) < 1e-12) return [samples.reduce((s, p) => s + p.y, 0) / samples.length];
    [a[i], a[pivot]] = [a[pivot], a[i]];
    const div = a[i][i];
    for (let c = i; c <= n; c++) a[i][c] /= div;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = a[r][i];
      for (let c = i; c <= n; c++) a[r][c] -= f * a[i][c];
    }
  }
  return a.map((r) => r[n]);
}

function polynomialLine(pts: Pt[], degree: number, t0: number, t1: number): TrendPt[] {
  if (!pts.length) return [];
  const span = Math.max(t1 - t0, 1);
  const coeffs = polynomialFit(pts.map((p) => ({ x: (p.ms - t0) / span, y: p.ySigned })), degree);
  return Array.from({ length: 80 }, (_, i) => {
    const x = i / 79;
    return { ms: t0 + x * span, y: coeffs.reduce((s, c, pow) => s + c * x ** pow, 0) };
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
  transactions, allTransactions, tags, kind, windowSize, degree, superimpose, onKindChange, onWindowSizeChange, onDegreeChange, onSuperimposeChange
}: {
  transactions: Txn[]; allTransactions: Txn[]; tags: Tag[]; kind: TrendlineKind; windowSize: number; degree: number; superimpose: boolean;
  onKindChange: (v: TrendlineKind) => void; onWindowSizeChange: (v: number) => void; onDegreeChange: (v: number) => void; onSuperimposeChange: (v: boolean) => void;
}) {
  const [selId, setSelId] = useState<string | null>(null);
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

  const timeRange = useMemo(() => {
    if (!points.length) return null;
    const t0 = Math.min(...points.map((p) => p.ms));
    const max = Math.max(...points.map((p) => p.ms));
    return { t0, t1: max <= t0 ? t0 + 864e5 : max };
  }, [points]);

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

  const rawSeries = useMemo((): TrendSeries[] => {
    if (!timeRange) return [];
    const label = kind === "ema" ? "EMA" : kind === "sma" ? "SMA" : kind === "polynomial" ? "Polynomial" : "Cumulative net";
    if (kind === "cumulative") return [{ key: "cumulative", label, color: "var(--brand)", pts: cumulativeLine(points) }];
    const income = points.filter((p) => p.income);
    const spending = points.filter((p) => !p.income);
    const build = kind === "polynomial"
      ? (pts: Pt[]) => polynomialLine(pts, degree, timeRange.t0, timeRange.t1)
      : (pts: Pt[]) => movingAverage(pts, windowSize, kind === "ema");
    return [
      { key: "income", label: `Income ${label}`, color: "var(--success)", pts: build(income) },
      { key: "spending", label: `Spending ${label}`, color: "var(--danger)", pts: build(spending) }
    ].filter((s) => s.pts.length);
  }, [points, timeRange, kind, degree, windowSize]);

  const compareMode = kind !== "cumulative" && superimpose;
  const series = useMemo(
    () => compareMode ? rawSeries.map((s) => ({ ...s, pts: s.pts.map((p) => ({ ...p, y: Math.abs(p.y) })) })) : rawSeries,
    [rawSeries, compareMode]
  );

  const layout = useMemo(() => {
    const ih = H - padTop - padBottom, iw = W - padL - padR;
    if (!points.length || !timeRange) return null;
    const lineVals = series.flatMap((s) => s.pts.map((p) => p.y));
    const { t0, t1 } = timeRange;
    const xAt = (ms: number) => padL + ((ms - t0) / (t1 - t0)) * iw;
    const xTicks = Array.from({ length: 6 }, (_, i) => Math.round(t0 + ((t1 - t0) * i) / 5));

    if (compareMode) {
      const vm = Math.max(...lineVals.map((v) => Math.abs(v)), 1);
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
  }, [points, timeRange, series, compareMode]);

  if (!points.length || !layout) return <p className="muted small">No transactions in this range (transfers excluded; netting groups collapsed).</p>;

  const { zeroY, xAt, yAt, xTicks, yTicks } = layout;
  const r = points.length > 400 ? 2.8 : 3.8;
  const shownSelected = compareMode ? null : selected;

  return (
    <>
      <div className="between mb-3 flex-wrap gap-3">
        <div className="row-flex gap-6 small">
          {kind === "cumulative" ? (
            <div className="row-flex gap-2" style={{ alignItems: "center" }}><span style={{ width: 18, height: 3, background: "var(--brand)", borderRadius: 2 }} aria-hidden /><span className="fw-semi">Cumulative net</span></div>
          ) : (
            <>
              <div className="row-flex gap-2" style={{ alignItems: "center" }}><span style={{ width: 18, height: 3, background: "var(--success)", borderRadius: 2 }} aria-hidden /><span className="fw-semi">Income {compareMode ? "absolute" : "(+)"}</span></div>
              <div className="row-flex gap-2" style={{ alignItems: "center" }}><span style={{ width: 18, height: 3, background: "var(--danger)", borderRadius: 2 }} aria-hidden /><span className="fw-semi">Spending {compareMode ? "absolute" : "(−)"}</span></div>
            </>
          )}
        </div>
        <span className="small muted">{points.length} points</span>
      </div>
      <div className="row-flex gap-2 flex-wrap mb-3">
        <span className="small muted">Trendline</span>
        <Segmented value={kind} onChange={onKindChange} options={[
          { value: "ema", label: "EMA" },
          { value: "sma", label: "SMA" },
          { value: "polynomial", label: "Polynomial" },
          { value: "cumulative", label: "Cumulative Sum" }
        ]} />
        {kind === "ema" || kind === "sma" ? (
          <label className="row-flex gap-2 small" style={{ alignItems: "center" }}>
            <span className="muted">Time Window</span>
            <input type="number" min={3} max={60} step={1} className="input input-sm" value={windowSize} onChange={(e) => onWindowSizeChange(clampInt(Number(e.target.value), 3, 60))} style={{ width: "5rem" }} />
          </label>
        ) : kind === "polynomial" ? (
          <label className="row-flex gap-2 small" style={{ alignItems: "center" }}>
            <span className="muted">Degree</span>
            <input type="number" min={1} max={4} step={1} className="input input-sm" value={degree} onChange={(e) => onDegreeChange(clampInt(Number(e.target.value), 1, 4))} style={{ width: "5rem" }} />
          </label>
        ) : null}
        {kind !== "cumulative" && <Switch checked={superimpose} onChange={onSuperimposeChange} label={<span className="small">Superimpose</span>} />}
      </div>
      <div className="viz-wrap" style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 980, maxHeight: H }} role="img" aria-label="One point per transaction, date on horizontal axis, signed amount on vertical axis">
          {!compareMode && (
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
          {series.map((s) => (
            <path key={s.key} d={linePath(s.pts, xAt, yAt)} fill="none" stroke={s.color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity={0.95}>
              <title>{s.label}</title>
            </path>
          ))}
          {!compareMode && points.map((p, i) => {
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
          {xTicks.map((ms) => (
            <text key={ms} x={xAt(ms)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--ink-muted)">{fmtDay(ms)}</text>
          ))}
        </svg>
      </div>
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

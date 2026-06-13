import { useMemo, useState } from "react";
import type { Tag, Txn } from "../types";
import TransactionTable from "../shared/TransactionTable";
import { getTxnDateOnly } from "../../utils/transactionUtils";

const fmt = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const tickLabel = (t: number) => `${t < 0 ? "-" : ""}${fmt(Math.abs(t))}`;
const axisTicksSigned = (vMax: number) => {
  const m = Math.max(vMax, 1);
  return [-m, -m / 2, 0, m / 2, m].map((x) => Math.round(x * 100) / 100);
};
const padL = 72, padR = 22, padTop = 34, padBottom = 28, W = 1200, H = 420;
const fmtDay = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });

type Pt = { txn: Txn; ms: number; ySigned: number; income: boolean };

const rowKey = (p: Pt, i: number) => p.txn.transaction_id ?? `__${i}_${p.ms}_${p.txn.amount}_${p.txn.account_id ?? ""}`;

export default function TrendlineScatterChart({ transactions, tags }: { transactions: Txn[]; tags: Tag[] }) {
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

  const selected = useMemo(
    () => (selId ? points.find((p, i) => rowKey(p, i) === selId)?.txn ?? null : null),
    [selId, points]
  );

  const layout = useMemo(() => {
    const ih = H - padTop - padBottom, iw = W - padL - padR;
    if (!points.length) return null;
    const t0 = Math.min(...points.map((p) => p.ms));
    let t1 = Math.max(...points.map((p) => p.ms));
    if (t1 <= t0) t1 = t0 + 864e5;
    const vm = Math.max(...points.map((p) => Math.abs(p.ySigned)), 1);
    const zeroY = padTop + ih / 2, half = ih / 2, v = Math.max(vm, 1);
    const xAt = (ms: number) => padL + ((ms - t0) / (t1 - t0)) * iw;
    const yAt = (s: number) => zeroY - (s / v) * half;
    const xTicks = Array.from({ length: 6 }, (_, i) => Math.round(t0 + ((t1 - t0) * i) / 5));
    return { t0, t1, vm, zeroY, half, v, xAt, yAt, iw, ih, xTicks, yTicks: axisTicksSigned(vm) };
  }, [points]);

  if (!points.length || !layout) return <p className="muted small">No transactions in this range (transfers excluded; netting groups collapsed).</p>;

  const { zeroY, xAt, yAt, xTicks, yTicks } = layout;
  const r = points.length > 400 ? 2.8 : 3.8;

  return (
    <>
      <div className="between mb-3 flex-wrap gap-3">
        <div className="row-flex gap-6 small">
          <div className="row-flex gap-2" style={{ alignItems: "center" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)" }} aria-hidden /><span className="fw-semi">Income (+)</span></div>
          <div className="row-flex gap-2" style={{ alignItems: "center" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--danger)" }} aria-hidden /><span className="fw-semi">Spending (−)</span></div>
        </div>
        <span className="small muted">{points.length} points</span>
      </div>
      <div className="viz-wrap" style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 980, maxHeight: H }} role="img" aria-label="One point per transaction, date on horizontal axis, signed amount on vertical axis">
          <rect x={padL - 8} y={padTop} width={W - padL - padR + 16} height={layout.half} fill="var(--success-soft)" opacity={0.22} />
          <rect x={padL - 8} y={zeroY} width={W - padL - padR + 16} height={layout.half} fill="var(--danger-soft)" opacity={0.22} />
          {yTicks.filter((t) => t !== 0).map((t, ti) => {
            const yy = yAt(t);
            return (
              <g key={`yt-${ti}-${t}`}>
                <line x1={padL - 8} x2={W - padR} y1={yy} y2={yy} stroke="var(--line)" strokeOpacity={0.55} />
                <text x={padL - 12} y={yy + 4} textAnchor="end" fontSize="10" fill="var(--ink-muted)">{tickLabel(t)}</text>
              </g>
            );
          })}
          <line x1={padL - 8} x2={W - padR} y1={zeroY} y2={zeroY} stroke="var(--ink)" strokeOpacity={0.45} strokeWidth={2.75} strokeLinecap="square" pointerEvents="none" />
          {points.map((p, i) => {
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
      {selected && (
        <p className="muted small mt-3">
          {fmtDay(+new Date(`${getTxnDateOnly(selected) ?? ""}T12:00:00`))} — {(selected.amount ?? 0) < 0 ? `Income +${fmt(Math.abs(selected.amount ?? 0))}` : `Spending −${fmt(selected.amount ?? 0)}`}
          {selected.merchant_name || selected.name ? ` · ${selected.merchant_name || selected.name}` : ""}
        </p>
      )}
      {selected && (
        <div className="card mt-3">
          <div className="between mb-3 flex-wrap gap-2">
            <h4>Transaction</h4>
            <button type="button" className="btn ghost btn-sm" onClick={() => setSelId(null)}>Clear</button>
          </div>
          <TransactionTable transactions={[selected]} tags={tags} keyPrefix="viz-trendline-txn" />
        </div>
      )}
    </>
  );
}

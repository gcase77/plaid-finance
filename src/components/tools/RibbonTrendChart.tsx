import { useMemo, useState } from "react";
import type { Tag, Txn } from "../types";
import { Segmented } from "../shared/ui";
import TransactionTable from "../shared/TransactionTable";
import { getTxnDateOnly, TAG_COLOR_PALETTE } from "../../utils/transactionUtils";
import { buildTrendPieSlices, type TrendPieGrouping } from "./visualizeTrendsUtils";
import type { TimelineGranularity } from "./TimelineTrendChart";

type Side = "spending" | "income";
type Series = { key: string; label: string; color: string; values: number[]; periodTxns: Txn[][]; total: number };
type Period = { key: string; label: string; txns: Txn[] };
type Segment = { series: Series; period: Period; periodIndex: number; y0: number; y1: number };
type Selection = { seriesKey: string; periodKey: string };

const fmt = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const monthLabel = (s: string) => { const [y, m] = s.split("-"); return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" }); };
const mondayOf = (s: string) => { const d = new Date(`${s}T12:00:00`); const day = d.getDay(); d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); return d.toISOString().slice(0, 10); };
const weekLabel = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function buildPeriods(txns: Txn[], granularity: TimelineGranularity) {
  const map = new Map<string, Period>();
  for (const t of txns) {
    const d = getTxnDateOnly(t);
    if (!d) continue;
    const key = granularity === "month" ? d.slice(0, 7) : mondayOf(d);
    const row = map.get(key) ?? { key, label: granularity === "month" ? monthLabel(key) : weekLabel(key), txns: [] };
    row.txns.push(t);
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function buildSeries(periods: Period[], side: Side, grouping: TrendPieGrouping, tagMap: Map<number, Tag>): Series[] {
  const labels = new Map<string, string>();
  const totals = new Map<string, number>();
  const periodSlices = periods.map((p) => buildTrendPieSlices(p.txns, side, grouping, tagMap));
  for (const slices of periodSlices) for (const s of slices) {
    labels.set(s.key, s.label);
    totals.set(s.key, (totals.get(s.key) ?? 0) + s.amount);
  }
  const keys = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([key]) => key);
  const otherTotal = [...totals.entries()].filter(([k]) => !keys.includes(k)).reduce((sum, [, v]) => sum + v, 0);
  if (otherTotal > 0) keys.push("__other__");
  return keys.map((key, i) => ({
    key,
    label: key === "__other__" ? "Other" : labels.get(key) ?? key,
    color: TAG_COLOR_PALETTE[i % TAG_COLOR_PALETTE.length],
    values: periodSlices.map((slices) => key === "__other__"
      ? slices.filter((s) => !keys.includes(s.key)).reduce((sum, s) => sum + s.amount, 0)
      : slices.find((s) => s.key === key)?.amount ?? 0),
    periodTxns: periodSlices.map((slices) => key === "__other__"
      ? slices.filter((s) => !keys.includes(s.key)).flatMap((s) => s.transactions)
      : slices.find((s) => s.key === key)?.transactions ?? []),
    total: key === "__other__" ? otherTotal : totals.get(key) ?? 0
  })).filter((s) => s.total > 0);
}

function buildSegments(periods: Period[], series: Series[]): Segment[][] {
  return periods.map((period, periodIndex) => {
    const T = series.reduce((sum, s) => sum + s.values[periodIndex], 0);
    let acc = T;
    return [...series]
      .sort((a, b) => b.values[periodIndex] - a.values[periodIndex] || b.total - a.total)
      .map((s) => {
        const v = s.values[periodIndex];
        const y1 = acc;
        const y0 = acc - v;
        acc = y0;
        return { series: s, period, periodIndex, y0, y1 };
      });
  });
}

function ribbonPath(a: Segment, b: Segment, x0: number, x1: number, barW: number, y: (v: number) => number) {
  const r0 = x0 + barW / 2, l1 = x1 - barW / 2, c = (r0 + l1) / 2;
  return `M ${r0} ${y(a.y1)} C ${c} ${y(a.y1)} ${c} ${y(b.y1)} ${l1} ${y(b.y1)} L ${l1} ${y(b.y0)} C ${c} ${y(b.y0)} ${c} ${y(a.y0)} ${r0} ${y(a.y0)} Z`;
}

function RibbonSvg({ periods, series, selected, onSelect }: {
  periods: Period[]; series: Series[]; selected: Selection | null; onSelect: (seriesKey: string, periodKey: string) => void;
}) {
  const width = 1200, height = 420, padL = 72, padR = 22, padY = 34, barW = 44;
  const max = Math.max(...periods.map((_, i) => series.reduce((sum, s) => sum + s.values[i], 0)), 1);
  const segments = useMemo(() => buildSegments(periods, series), [periods, series]);
  const x = (i: number) => periods.length <= 1 ? width / 2 : padL + (i * (width - padL - padR)) / (periods.length - 1);
  const y = (v: number) => padY + (height - padY * 2) - (v / max) * (height - padY * 2);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(max * p));
  const xSkip = Math.max(1, Math.ceil(periods.length / 12));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", minWidth: 980, maxHeight: height }}>
      {ticks.map((t, i) => (
        <g key={`${t}-${i}`}>
          <line x1={padL - 8} x2={width - padR} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeOpacity={0.7} />
          <text x={padL - 12} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--ink-muted)">{fmt(t)}</text>
        </g>
      ))}
      {periods.slice(0, -1).flatMap((_, i) => segments[i].map((seg) => {
        const next = segments[i + 1].find((s) => s.series.key === seg.series.key);
        if (!next || (seg.y1 === seg.y0 && next.y1 === next.y0)) return null;
        const active = selected?.seriesKey === seg.series.key && (selected.periodKey === seg.period.key || selected.periodKey === next.period.key);
        const dim = selected && selected.seriesKey !== seg.series.key;
        return <path key={`${seg.series.key}-${seg.period.key}`} d={ribbonPath(seg, next, x(i), x(i + 1), barW, y)} fill={seg.series.color} opacity={active ? 0.9 : dim ? 0.18 : 0.58} />;
      }))}
      {segments.flatMap((periodSegments, i) => periodSegments.map((seg) => {
        if (seg.y1 === seg.y0) return null;
        const active = selected?.seriesKey === seg.series.key && selected.periodKey === seg.period.key;
        const dim = selected && !active;
        return (
          <rect
            key={`${seg.period.key}-${seg.series.key}`}
            x={x(i) - barW / 2}
            y={y(seg.y1)}
            width={barW}
            height={Math.max(1, y(seg.y0) - y(seg.y1))}
            rx={2}
            fill={seg.series.color}
            opacity={active ? 1 : dim ? 0.35 : 0.9}
            stroke={active ? "var(--ink)" : "var(--surface)"}
            strokeWidth={active ? 1.5 : 0.75}
            style={{ cursor: "pointer" }}
            onClick={() => onSelect(seg.series.key, seg.period.key)}
          >
            <title>{`${seg.period.label} ${seg.series.label}: ${fmt(seg.y1 - seg.y0)}`}</title>
          </rect>
        );
      }))}
      {periods.map((p, i) => {
        if (i % xSkip !== 0 && i !== periods.length - 1) return null;
        return <text key={p.key} x={x(i)} y={height - 8} textAnchor="middle" fontSize="10" fill="var(--ink-muted)">{p.label}</text>;
      })}
    </svg>
  );
}

function RibbonCard({ title, side, transactions, tags, grouping, granularity, tagMap }: {
  title: string; side: Side; transactions: Txn[]; tags: Tag[]; grouping: TrendPieGrouping; granularity: TimelineGranularity; tagMap: Map<number, Tag>;
}) {
  const [selected, setSelected] = useState<Selection | null>(null);
  const periods = useMemo(() => buildPeriods(transactions, granularity), [transactions, granularity]);
  const series = useMemo(() => buildSeries(periods, side, grouping, tagMap), [periods, side, grouping, tagMap]);
  const selectedSeries = selected ? series.find((s) => s.key === selected.seriesKey) : null;
  const selectedPeriodIndex = selected ? periods.findIndex((p) => p.key === selected.periodKey) : -1;
  const selectedPeriod = selectedPeriodIndex >= 0 ? periods[selectedPeriodIndex] : null;
  const selectedTxns = selectedSeries && selectedPeriodIndex >= 0 ? selectedSeries.periodTxns[selectedPeriodIndex] : [];
  const selectedAmount = selectedSeries && selectedPeriodIndex >= 0 ? selectedSeries.values[selectedPeriodIndex] : 0;
  const select = (seriesKey: string, periodKey: string) => setSelected((s) => s?.seriesKey === seriesKey && s.periodKey === periodKey ? null : { seriesKey, periodKey });
  if (!periods.length || !series.length) return <div className="card"><h4 className="mb-2">{title}</h4><p className="muted small">No data in this range.</p></div>;
  return (
    <div className="card">
      <h4 className="mb-2">{title}</h4>
      <div className="viz-wrap" style={{ overflowX: "auto" }}><RibbonSvg periods={periods} series={series} selected={selected} onSelect={select} /></div>
      <div className="row-flex gap-3 flex-wrap mt-3 small">
        {series.map((s) => <span key={s.key} className="row-flex gap-2"><span style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} /><span>{s.label}</span><span className="muted">{fmt(s.total)}</span></span>)}
      </div>
      {selectedSeries && selectedPeriod && (
        <div className="card mt-3">
          <div className="between mb-3 flex-wrap gap-2">
            <h4>{selectedPeriod.label} — {selectedSeries.label} <span className="muted small">({fmt(selectedAmount)})</span></h4>
            <button className="btn ghost btn-sm" onClick={() => setSelected(null)}>Clear</button>
          </div>
          <TransactionTable transactions={selectedTxns} tags={tags} keyPrefix={`viz-ribbon-${side}`} />
        </div>
      )}
    </div>
  );
}

export default function RibbonTrendChart({ transactions, tags, grouping, granularity, onGroupingChange, onGranularityChange }: {
  transactions: Txn[]; tags: Tag[]; grouping: TrendPieGrouping; granularity: TimelineGranularity;
  onGroupingChange: (g: TrendPieGrouping) => void; onGranularityChange: (g: TimelineGranularity) => void;
}) {
  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  return (
    <>
      <div className="between mb-3 flex-wrap gap-3">
        <p className="muted small" style={{ margin: 0 }}>Absolute category totals over time.</p>
        <div className="row-flex gap-2 flex-wrap">
          <Segmented value={granularity} onChange={onGranularityChange} options={[{ value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
          <Segmented value={grouping} onChange={onGroupingChange} options={[{ value: "detected", label: "Detected" }, { value: "buckets", label: "Buckets" }, { value: "meta", label: "Meta" }]} />
        </div>
      </div>
      <div className="gap-4" style={{ display: "flex", flexDirection: "column" }}>
        <RibbonCard title="Absolute Spending" side="spending" transactions={transactions} tags={tags} grouping={grouping} granularity={granularity} tagMap={tagMap} />
        <RibbonCard title="Absolute Income" side="income" transactions={transactions} tags={tags} grouping={grouping} granularity={granularity} tagMap={tagMap} />
      </div>
    </>
  );
}

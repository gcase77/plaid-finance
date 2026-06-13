import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Tag, Txn } from "../types";
import { buildAuthHeaders } from "../../lib/auth";
import { DATE_RANGE_PRESETS } from "../shared/dateRangeUtils";
import TransactionTable from "../shared/TransactionTable";
import { buildDatePreset } from "../../utils/datePresets";
import FlowSankeySvg from "./FlowSankeySvg";
import { buildFlowOfFundsModel, type FlowGrouping } from "./flowOfFundsSankey";
import TimelineTrendChart, { type TimelineGranularity, type TimelineView } from "./TimelineTrendChart";
import { buildTrendPieSlices, filterTrendsTransactions, sliceColors, type TrendPieGrouping, type TrendPieSlice } from "./visualizeTrendsUtils";
import { Segmented } from "../shared/ui";

type Props = { transactions: Txn[]; token: string | null };
type VizTab = "pie" | "flow" | "timeline";
type Selection = { side: "spending" | "income"; slice: TrendPieSlice };

const CX = 100, CY = 100, R = 90;
function pieSlicePath(a0: number, a1: number): string {
  if (a1 - a0 >= 359.99) return `M ${CX} ${CY} m 0 ${-R} a ${R} ${R} 0 1 1 0 ${2 * R} a ${R} ${R} 0 1 1 0 ${-2 * R}`;
  const rad = (d: number) => ((d - 90) * Math.PI) / 180;
  const x0 = CX + R * Math.cos(rad(a0)); const y0 = CY + R * Math.sin(rad(a0));
  const x1 = CX + R * Math.cos(rad(a1)); const y1 = CY + R * Math.sin(rad(a1));
  return `M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1} Z`;
}

function SvgPie({ slices, colors, selectedKey, onSelect }: { slices: TrendPieSlice[]; colors: Map<string, string>; selectedKey: string | null; onSelect: (s: TrendPieSlice) => void }) {
  const total = slices.reduce((s, x) => s + x.amount, 0);
  if (total <= 0) {
    return (
      <svg viewBox="0 0 200 200" style={{ width: "100%", maxHeight: 220 }}>
        <circle cx={CX} cy={CY} r={R} fill="var(--surface-alt)" stroke="var(--line)" />
        <text x={CX} y={CY} textAnchor="middle" className="small" fill="var(--ink-muted)">No data</text>
      </svg>
    );
  }
  const sweeps = slices.map((sl) => (sl.amount / total) * 360);
  const starts: number[] = sweeps.reduce<number[]>((acc, s, i) => [...acc, (acc[i - 1] ?? -90) + (i === 0 ? 0 : sweeps[i - 1])], []);
  const paths: ReactNode[] = slices.map((sl, i) => {
    const a0 = starts[i];
    const a1 = a0 + sweeps[i];
    const c = colors.get(sl.key) ?? "var(--ink-muted)";
    const dim = selectedKey && selectedKey !== sl.key;
    return (
      <path key={sl.key} d={pieSlicePath(a0, a1)} fill={c} opacity={dim ? 0.35 : 1} stroke="var(--surface)" strokeWidth={1} style={{ cursor: "pointer" }} onClick={() => onSelect(sl)}>
        <title>{`${sl.label}: $${sl.amount.toFixed(2)}`}</title>
      </path>
    );
  });
  return <svg viewBox="0 0 200 200" style={{ width: "100%", maxHeight: 220 }}>{paths}</svg>;
}

function Legend({ slices, colors, selectedKey, onSelect }: { slices: TrendPieSlice[]; colors: Map<string, string>; selectedKey: string | null; onSelect: (s: TrendPieSlice) => void }) {
  const total = slices.reduce((s, x) => s + x.amount, 0);
  if (!slices.length) return null;
  return (
    <ul className="viz-pie-legend" style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
      {slices.map((sl) => {
        const pct = total > 0 ? (100 * sl.amount) / total : 0;
        const c = colors.get(sl.key) ?? "var(--ink-muted)";
        const active = selectedKey === sl.key;
        return (
          <li key={sl.key} style={{ breakInside: "avoid", marginBottom: 4 }}>
            <button type="button" className="btn link btn-sm viz-pie-legend-row" style={{ fontWeight: active ? 700 : 500, color: "inherit" }} onClick={() => onSelect(sl)}>
              <span className="viz-pie-legend-swatch" style={{ background: c }} aria-hidden />
              <span className="viz-pie-legend-label">{sl.label}</span>
              <span className="viz-pie-legend-pct muted">{pct.toFixed(0)}%</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

const GROUPING_OPTIONS: { value: TrendPieGrouping; label: string }[] = [
  { value: "detected", label: "Detected" }, { value: "buckets", label: "Buckets" }, { value: "meta", label: "Meta" }
];
const FLOW_GROUPING: { value: FlowGrouping; label: string }[] = [
  { value: "detected", label: "Detected" }, { value: "tags", label: "Tags" }
];

const EMPTY_TAGS: Tag[] = [];

const VIZ_TRENDS_KEY = "funds-up-visualize-trends";
const VIZ_TABS = new Set<VizTab>(["pie", "flow", "timeline"]);
const PIE_GROUP = new Set<TrendPieGrouping>(["detected", "buckets", "meta"]);
const FLOW_GROUP = new Set<FlowGrouping>(["detected", "tags"]);
const TIMELINE_V = new Set<TimelineView>(["area", "net"]);
const TIMELINE_G = new Set<TimelineGranularity>(["month", "week"]);

function loadVizPrefs() {
  const d = {
    vizTab: "pie" as VizTab, grouping: "detected" as TrendPieGrouping, flowGrouping: "detected" as FlowGrouping,
    timelineView: "area" as TimelineView, timelineGranularity: "month" as TimelineGranularity
  };
  if (typeof window === "undefined") return d;
  try {
    const raw = localStorage.getItem(VIZ_TRENDS_KEY);
    if (!raw) return d;
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (typeof o.vizTab === "string" && VIZ_TABS.has(o.vizTab as VizTab)) d.vizTab = o.vizTab as VizTab;
    if (typeof o.grouping === "string" && PIE_GROUP.has(o.grouping as TrendPieGrouping)) d.grouping = o.grouping as TrendPieGrouping;
    if (typeof o.flowGrouping === "string" && FLOW_GROUP.has(o.flowGrouping as FlowGrouping)) d.flowGrouping = o.flowGrouping as FlowGrouping;
    if (typeof o.timelineView === "string" && TIMELINE_V.has(o.timelineView as TimelineView)) d.timelineView = o.timelineView as TimelineView;
    if (typeof o.timelineGranularity === "string" && TIMELINE_G.has(o.timelineGranularity as TimelineGranularity)) d.timelineGranularity = o.timelineGranularity as TimelineGranularity;
  } catch { /* ignore */ }
  return d;
}

export default function VisualizeTrendsTool({ transactions, token }: Props) {
  const initPrefs = useMemo(() => loadVizPrefs(), []);
  const [vizTab, setVizTab] = useState<VizTab>(initPrefs.vizTab);
  const [grouping, setGrouping] = useState<TrendPieGrouping>(initPrefs.grouping);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [flowGrouping, setFlowGrouping] = useState<FlowGrouping>(initPrefs.flowGrouping);
  const [flowNodeId, setFlowNodeId] = useState<string | null>(null);
  const [timelineView, setTimelineView] = useState<TimelineView>(initPrefs.timelineView);
  const [timelineGranularity, setTimelineGranularity] = useState<TimelineGranularity>(initPrefs.timelineGranularity);

  useEffect(() => {
    try {
      localStorage.setItem(VIZ_TRENDS_KEY, JSON.stringify({
        vizTab, grouping, flowGrouping, timelineView, timelineGranularity
      }));
    } catch { /* ignore */ }
  }, [vizTab, grouping, flowGrouping, timelineView, timelineGranularity]);

  const tagsQuery = useQuery({
    queryKey: ["tags"], enabled: !!token,
    queryFn: async (): Promise<Tag[]> => {
      const res = await fetch("/api/tags", { headers: buildAuthHeaders(token) });
      if (!res.ok) throw new Error(`Failed to load tags (${res.status})`);
      return (await res.json()) || [];
    }
  });
  const tags = tagsQuery.data ?? EMPTY_TAGS;
  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  const baseTxns = useMemo(() => filterTrendsTransactions(transactions, startDate, endDate), [transactions, startDate, endDate]);
  const spendSlices = useMemo(() => buildTrendPieSlices(baseTxns, "spending", grouping, tagMap), [baseTxns, grouping, tagMap]);
  const incomeSlices = useMemo(() => buildTrendPieSlices(baseTxns, "income", grouping, tagMap), [baseTxns, grouping, tagMap]);
  const spendColors = useMemo(() => sliceColors(spendSlices), [spendSlices]);
  const incomeColors = useMemo(() => sliceColors(incomeSlices), [incomeSlices]);
  const flowModel = useMemo(() => buildFlowOfFundsModel(baseTxns, flowGrouping, tagMap), [baseTxns, flowGrouping, tagMap]);
  const flowDetail = useMemo(() => flowModel?.nodes.find((n) => n.id === flowNodeId), [flowModel, flowNodeId]);

  const bumpRange = (start: string, end: string) => { setStartDate(start); setEndDate(end); setSelection(null); setFlowNodeId(null); };
  const goTab = (t: VizTab) => { setVizTab(t); setFlowNodeId(null); };
  const onSlice = (side: "spending" | "income", sl: TrendPieSlice) => setSelection((p) => p?.side === side && p.slice.key === sl.key ? null : { side, slice: sl });

  return (
    <>
      <div className="card card-tight mb-4">
        <div className="xs muted fw-semi mb-2">Date range</div>
        <div className="row-flex flex-wrap gap-2 mb-3">
          {DATE_RANGE_PRESETS.map(({ value, label }) => (
            <button key={value} className="btn ghost btn-sm" onClick={() => { const d = buildDatePreset(value); bumpRange(d.start, d.end); }}>{label}</button>
          ))}
        </div>
        <div className="row-flex flex-wrap gap-2">
          <input type="date" className="input input-sm" style={{ width: "auto", minWidth: 140 }} value={startDate} onChange={(e) => bumpRange(e.target.value, endDate)} />
          <span className="muted">–</span>
          <input type="date" className="input input-sm" style={{ width: "auto", minWidth: 140 }} value={endDate} onChange={(e) => bumpRange(startDate, e.target.value)} />
        </div>
      </div>

      <div className="tabs">
        <button className={vizTab === "pie" ? "active" : ""} onClick={() => goTab("pie")}>Pie chart</button>
        <button className={vizTab === "flow" ? "active" : ""} onClick={() => goTab("flow")}>Flow of funds</button>
        <button className={vizTab === "timeline" ? "active" : ""} onClick={() => goTab("timeline")}>Timeline</button>
      </div>

      {vizTab === "timeline" && <TimelineTrendChart transactions={baseTxns} tags={tags} view={timelineView} granularity={timelineGranularity} onViewChange={setTimelineView} onGranularityChange={setTimelineGranularity} />}

      {vizTab === "pie" && (
        <>
          <div className="row-flex gap-3 mb-3">
            <span className="small muted">Group by</span>
            <Segmented value={grouping} onChange={(v) => { setGrouping(v); setSelection(null); }} options={GROUPING_OPTIONS} />
          </div>
          <div className="viz-pie-grid">
            <div className="card">
              <h4 className="mb-2">Spending</h4>
              <SvgPie slices={spendSlices} colors={spendColors} selectedKey={selection?.side === "spending" ? selection.slice.key : null} onSelect={(sl) => onSlice("spending", sl)} />
              <Legend slices={spendSlices} colors={spendColors} selectedKey={selection?.side === "spending" ? selection.slice.key : null} onSelect={(sl) => onSlice("spending", sl)} />
            </div>
            <div className="card">
              <h4 className="mb-2">Income</h4>
              <SvgPie slices={incomeSlices} colors={incomeColors} selectedKey={selection?.side === "income" ? selection.slice.key : null} onSelect={(sl) => onSlice("income", sl)} />
              <Legend slices={incomeSlices} colors={incomeColors} selectedKey={selection?.side === "income" ? selection.slice.key : null} onSelect={(sl) => onSlice("income", sl)} />
            </div>
          </div>
          {selection && (
            <div className="card mt-4">
              <div className="between mb-3 flex-wrap gap-2">
                <h4>{selection.side === "spending" ? "Spending" : "Income"} — {selection.slice.label} <span className="muted small">(${selection.slice.amount.toFixed(2)})</span></h4>
                <button className="btn ghost btn-sm" onClick={() => setSelection(null)}>Clear</button>
              </div>
              <TransactionTable transactions={selection.slice.transactions} tags={tags} keyPrefix="viz-trend" />
            </div>
          )}
        </>
      )}

      {vizTab === "flow" && (
        <>
          <div className="row-flex gap-3 mb-3">
            <span className="small muted">Group by</span>
            <Segmented value={flowGrouping} onChange={(v) => { setFlowGrouping(v); setFlowNodeId(null); }} options={FLOW_GROUPING} />
          </div>
          {flowModel ? (
            <div className="viz-wrap mb-3">
              <div style={{ overflowX: "auto" }}>
                <FlowSankeySvg model={flowModel} width={1200} height={Math.max(448, Math.min(232 + flowModel.nodes.length * 18, 820))} selectedId={flowNodeId} onSelectNode={setFlowNodeId} />
              </div>
            </div>
          ) : <p className="muted small">No income or spending in this range.</p>}
          {flowDetail && (
            <div className="card mt-3">
              <div className="between mb-3">
                <h4>{flowDetail.label}</h4>
                <button className="btn ghost btn-sm" onClick={() => setFlowNodeId(null)}>Clear</button>
              </div>
              <TransactionTable transactions={flowDetail.transactions} tags={tags} keyPrefix="viz-flow" />
            </div>
          )}
        </>
      )}
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Tag, Txn } from "../types";
import { buildAuthHeaders } from "../../lib/auth";
import { DATE_RANGE_PRESETS } from "../shared/dateRangeUtils";
import TransactionTable from "../shared/TransactionTable";
import { TrendPiePanel } from "../shared/TrendPieChart";
import { buildDatePreset } from "../../utils/datePresets";
import FlowSankeySvg from "./FlowSankeySvg";
import { buildFlowOfFundsModel, type FlowGrouping } from "./flowOfFundsSankey";
import TimelineTrendChart, { type TimelineGranularity, type TimelineView } from "./TimelineTrendChart";
import TrendlineScatterChart, { type TrendlineKind, type TrendlineSeriesView } from "./TrendlineScatterChart";
import RibbonTrendChart from "./RibbonTrendChart";
import { buildTrendPieSlices, filterTrendsTransactions, sliceColors, type TrendPieGrouping, type TrendPieSlice } from "./visualizeTrendsUtils";
import { Segmented } from "../shared/ui";

type Props = { transactions: Txn[]; token: string | null };
type VizTab = "pie" | "flow" | "timeline" | "ribbon" | "trendline";
type Selection = { side: "spending" | "income"; slice: TrendPieSlice };

const GROUPING_OPTIONS: { value: TrendPieGrouping; label: string }[] = [
  { value: "detected", label: "Detected" }, { value: "buckets", label: "Buckets" }, { value: "meta", label: "Meta" }
];
const FLOW_GROUPING: { value: FlowGrouping; label: string }[] = [
  { value: "detected", label: "Detected" }, { value: "tags", label: "Tags" }
];

const EMPTY_TAGS: Tag[] = [];

const VIZ_TRENDS_KEY = "funds-up-visualize-trends";
const VIZ_TABS = new Set<VizTab>(["pie", "flow", "timeline", "ribbon", "trendline"]);
const PIE_GROUP = new Set<TrendPieGrouping>(["detected", "buckets", "meta"]);
const FLOW_GROUP = new Set<FlowGrouping>(["detected", "tags"]);
const TIMELINE_V = new Set<TimelineView>(["area", "net"]);
const TIMELINE_G = new Set<TimelineGranularity>(["month", "week"]);
const TRENDLINE_K = new Set<TrendlineKind>(["polynomial", "cumulative"]);
const TRENDLINE_SERIES = new Set<TrendlineSeriesView>(["both", "income", "spending"]);

function loadVizPrefs() {
  const d = {
    vizTab: "pie" as VizTab, grouping: "detected" as TrendPieGrouping, flowGrouping: "detected" as FlowGrouping,
    timelineView: "area" as TimelineView, timelineGranularity: "month" as TimelineGranularity,
    ribbonGrouping: "detected" as TrendPieGrouping, ribbonGranularity: "month" as TimelineGranularity,
    trendlineKind: "polynomial" as TrendlineKind, trendlineSeriesView: "both" as TrendlineSeriesView, trendlineGranularity: "month" as TimelineGranularity, trendlineDegree: 2
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
    if (typeof o.ribbonGrouping === "string" && PIE_GROUP.has(o.ribbonGrouping as TrendPieGrouping)) d.ribbonGrouping = o.ribbonGrouping as TrendPieGrouping;
    if (typeof o.ribbonGranularity === "string" && TIMELINE_G.has(o.ribbonGranularity as TimelineGranularity)) d.ribbonGranularity = o.ribbonGranularity as TimelineGranularity;
    if (typeof o.trendlineKind === "string" && TRENDLINE_K.has(o.trendlineKind as TrendlineKind)) d.trendlineKind = o.trendlineKind as TrendlineKind;
    if (typeof o.trendlineSeriesView === "string" && TRENDLINE_SERIES.has(o.trendlineSeriesView as TrendlineSeriesView)) d.trendlineSeriesView = o.trendlineSeriesView as TrendlineSeriesView;
    if (typeof o.trendlineGranularity === "string" && TIMELINE_G.has(o.trendlineGranularity as TimelineGranularity)) d.trendlineGranularity = o.trendlineGranularity as TimelineGranularity;
    if (typeof o.trendlineDegree === "number" && Number.isFinite(o.trendlineDegree)) d.trendlineDegree = Math.min(10, Math.max(1, Math.round(o.trendlineDegree)));
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
  const [ribbonGrouping, setRibbonGrouping] = useState<TrendPieGrouping>(initPrefs.ribbonGrouping);
  const [ribbonGranularity, setRibbonGranularity] = useState<TimelineGranularity>(initPrefs.ribbonGranularity);
  const [trendlineKind, setTrendlineKind] = useState<TrendlineKind>(initPrefs.trendlineKind);
  const [trendlineSeriesView, setTrendlineSeriesView] = useState<TrendlineSeriesView>(initPrefs.trendlineSeriesView);
  const [trendlineGranularity, setTrendlineGranularity] = useState<TimelineGranularity>(initPrefs.trendlineGranularity);
  const [trendlineDegree, setTrendlineDegree] = useState(initPrefs.trendlineDegree);

  useEffect(() => {
    try {
      localStorage.setItem(VIZ_TRENDS_KEY, JSON.stringify({
        vizTab, grouping, flowGrouping, timelineView, timelineGranularity, ribbonGrouping, ribbonGranularity,
        trendlineKind, trendlineSeriesView, trendlineGranularity, trendlineDegree
      }));
    } catch { /* ignore */ }
  }, [vizTab, grouping, flowGrouping, timelineView, timelineGranularity, ribbonGrouping, ribbonGranularity, trendlineKind, trendlineSeriesView, trendlineGranularity, trendlineDegree]);

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
        <button className={vizTab === "ribbon" ? "active" : ""} onClick={() => goTab("ribbon")}>Ribbon</button>
        <button className={vizTab === "trendline" ? "active" : ""} onClick={() => goTab("trendline")}>Trendline</button>
      </div>

      {vizTab === "timeline" && <TimelineTrendChart transactions={baseTxns} tags={tags} view={timelineView} granularity={timelineGranularity} onViewChange={setTimelineView} onGranularityChange={setTimelineGranularity} />}
      {vizTab === "ribbon" && <RibbonTrendChart transactions={baseTxns} tags={tags} grouping={ribbonGrouping} granularity={ribbonGranularity} onGroupingChange={setRibbonGrouping} onGranularityChange={setRibbonGranularity} />}
      {vizTab === "trendline" && (
        <TrendlineScatterChart
          transactions={baseTxns}
          allTransactions={transactions}
          tags={tags}
          kind={trendlineKind}
          seriesView={trendlineSeriesView}
          granularity={trendlineGranularity}
          degree={trendlineDegree}
          onKindChange={setTrendlineKind}
          onSeriesViewChange={setTrendlineSeriesView}
          onGranularityChange={setTrendlineGranularity}
          onDegreeChange={setTrendlineDegree}
        />
      )}

      {vizTab === "pie" && (
        <>
          <div className="row-flex gap-3 mb-3">
            <span className="small muted">Group by</span>
            <Segmented value={grouping} onChange={(v) => { setGrouping(v); setSelection(null); }} options={GROUPING_OPTIONS} />
          </div>
          <div className="viz-pie-grid">
            <div className="card">
              <h4 className="mb-2">Spending</h4>
              <TrendPiePanel slices={spendSlices} colors={spendColors} selectedKey={selection?.side === "spending" ? selection.slice.key : null} onSelect={(sl) => onSlice("spending", sl)} />
            </div>
            <div className="card">
              <h4 className="mb-2">Income</h4>
              <TrendPiePanel slices={incomeSlices} colors={incomeColors} selectedKey={selection?.side === "income" ? selection.slice.key : null} onSelect={(sl) => onSlice("income", sl)} />
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

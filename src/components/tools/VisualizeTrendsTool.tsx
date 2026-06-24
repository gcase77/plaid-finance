import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MissingTagFilter, Tag, TagStateFilter, Txn } from "../types";
import { buildAuthHeaders } from "../../lib/auth";
import { DATE_RANGE_PRESETS, formatDateRangeLabel } from "../shared/dateRangeUtils";
import TransactionTable from "../shared/TransactionTable";
import { TrendPiePanel } from "../shared/TrendPieChart";
import { TagBadge } from "../shared/TagBadge";
import { buildDatePreset } from "../../utils/datePresets";
import { expandNettingGroupsForDisplay } from "../../utils/nettingUtils";
import { formatCategoryLabel, formatCategorySubLabel, formatTxnDetectedCategory } from "../../utils/transactionUtils";
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
const detectedCategoryKey = (t: Txn) => t.personal_finance_category?.detailed || t.personal_finance_category?.primary || "";
const tagRank = (type: Tag["type"]) => (type === "meta" ? 0 : type.startsWith("spending") ? 1 : 2);

function Section({ label, summary, children, open }: { label: string; summary: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="collapse" {...(open ? { open: true } : {})}>
      <summary>
        <span className="fw-semi">{label}</span>
        <span className="muted small" style={{ marginLeft: "auto" }}>{summary}</span>
      </summary>
      <div className="content">{children}</div>
    </details>
  );
}

function CheckList<T extends string | number>({ label, options, selected, onChange, tertiary }: {
  label?: string; options: Array<[T, ReactNode]>; selected: T[]; onChange: (v: T[]) => void; tertiary?: { label: string; onClick: () => void; active?: boolean };
}) {
  const all = () => onChange(options.map(([id]) => id));
  const none = () => onChange([]);
  const toggle = (id: T, checked: boolean) => onChange(checked ? [...selected, id] : selected.filter((x) => x !== id));
  return (
    <div className="col-flex" style={{ gap: 6 }}>
      {label && <div className="xs muted fw-semi">{label} ({selected.length})</div>}
      <div className="row-flex gap-2">
        <button className="btn ghost btn-sm" onClick={all}>All</button>
        <button className="btn ghost btn-sm" onClick={none}>None</button>
        {tertiary && <button className={`btn ${tertiary.active ? "primary" : "ghost"} btn-sm`} onClick={tertiary.onClick}>{tertiary.label}</button>}
      </div>
      <div className="scrollbox" style={{ border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: 8 }}>
        {options.length ? options.map(([id, displayLabel]) => (
          <label key={id} className="check" style={{ display: "flex", padding: "3px 0" }}>
            <input type="checkbox" checked={selected.includes(id)} onChange={(e) => toggle(id, e.target.checked)} />
            <span>{displayLabel}</span>
          </label>
        )) : <p className="muted small" style={{ margin: 0 }}>No options in this range.</p>}
      </div>
    </div>
  );
}

const VIZ_TRENDS_KEY = "funds-up-visualize-trends";
const VIZ_TABS = new Set<VizTab>(["pie", "flow", "timeline", "ribbon", "trendline"]);
const PIE_GROUP = new Set<TrendPieGrouping>(["detected", "buckets", "meta"]);
const FLOW_GROUP = new Set<FlowGrouping>(["detected", "tags"]);
const TIMELINE_V = new Set<TimelineView>(["area", "net"]);
const TIMELINE_G = new Set<TimelineGranularity>(["month", "week"]);
const TRENDLINE_K = new Set<TrendlineKind>(["regression", "cumulative"]);
const TRENDLINE_SERIES = new Set<TrendlineSeriesView>(["both", "income", "spending"]);

function loadVizPrefs() {
  const d = {
    vizTab: "pie" as VizTab, grouping: "detected" as TrendPieGrouping, flowGrouping: "detected" as FlowGrouping,
    timelineView: "area" as TimelineView, timelineGranularity: "month" as TimelineGranularity,
    ribbonGrouping: "detected" as TrendPieGrouping, ribbonGranularity: "month" as TimelineGranularity,
    selectedCategories: [] as string[], selectedTagIds: [] as number[], tagStateFilter: "all" as TagStateFilter, missingTagFilter: "all" as MissingTagFilter,
    trendlineKind: "regression" as TrendlineKind, trendlineSeriesView: "both" as TrendlineSeriesView, trendlineGranularity: "month" as TimelineGranularity, trendlineDegree: 2
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
    if (Array.isArray(o.selectedCategories)) d.selectedCategories = o.selectedCategories.filter((x): x is string => typeof x === "string");
    if (Array.isArray(o.selectedTagIds)) d.selectedTagIds = o.selectedTagIds.filter((x): x is number => typeof x === "number");
    if (o.tagStateFilter === "all" || o.tagStateFilter === "untagged" || o.tagStateFilter === "tagged") d.tagStateFilter = o.tagStateFilter;
    if (o.missingTagFilter === "all" || o.missingTagFilter === "no_meta" || o.missingTagFilter === "no_income" || o.missingTagFilter === "no_spending") d.missingTagFilter = o.missingTagFilter;
    if (o.trendlineKind === "polynomial") d.trendlineKind = "regression";
    else if (typeof o.trendlineKind === "string" && TRENDLINE_K.has(o.trendlineKind as TrendlineKind)) d.trendlineKind = o.trendlineKind as TrendlineKind;
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
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initPrefs.selectedCategories);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(initPrefs.selectedTagIds);
  const [tagStateFilter, setTagStateFilter] = useState<TagStateFilter>(initPrefs.tagStateFilter);
  const [missingTagFilter, setMissingTagFilter] = useState<MissingTagFilter>(initPrefs.missingTagFilter);
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
        selectedCategories, selectedTagIds, tagStateFilter, missingTagFilter, trendlineKind, trendlineSeriesView, trendlineGranularity, trendlineDegree
      }));
    } catch { /* ignore */ }
  }, [vizTab, grouping, flowGrouping, timelineView, timelineGranularity, ribbonGrouping, ribbonGranularity, selectedCategories, selectedTagIds, tagStateFilter, missingTagFilter, trendlineKind, trendlineSeriesView, trendlineGranularity, trendlineDegree]);

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
  const sortedTags = useMemo(() => [...tags].sort((a, b) => tagRank(a.type) - tagRank(b.type) || a.name.localeCompare(b.name)), [tags]);

  const dateTxns = useMemo(() => filterTrendsTransactions(transactions, startDate, endDate), [transactions, startDate, endDate]);
  const categoryOptionsByPrimary = useMemo(() => {
    const byPrimary = new Map<string, Map<string, string>>();
    for (const t of dateTxns) {
      const primary = t.personal_finance_category?.primary || "";
      const key = detectedCategoryKey(t);
      if (!primary && !key) continue;
      const primaryKey = primary || key;
      const options = byPrimary.get(primaryKey) ?? new Map<string, string>();
      options.set(key || primaryKey, formatCategorySubLabel(primary, key) || formatTxnDetectedCategory(t.personal_finance_category) || key || primaryKey);
      byPrimary.set(primaryKey, options);
    }
    return [...byPrimary.entries()]
      .map(([primary, options]) => ({
        primary,
        primaryLabel: formatCategoryLabel(primary),
        options: [...options.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
      }))
      .sort((a, b) => a.primaryLabel.localeCompare(b.primaryLabel));
  }, [dateTxns]);
  const baseTxns = useMemo(
    () => dateTxns.filter((t) => {
      if (selectedCategories.length && !selectedCategories.includes(detectedCategoryKey(t))) return false;
      const hasBucketTag = t.bucket_1_tag_id != null || t.bucket_2_tag_id != null;
      const hasAnyTag = t.netting_group != null || hasBucketTag || (t.meta_tag_ids?.length ?? 0) > 0;
      if (tagStateFilter === "untagged" && hasAnyTag) return false;
      if (tagStateFilter === "tagged" && !hasAnyTag) return false;
      if (missingTagFilter === "no_meta" && (t.meta_tag_ids?.length ?? 0) > 0) return false;
      if (missingTagFilter === "no_income" && ((t.amount ?? 0) >= 0 || hasBucketTag)) return false;
      if (missingTagFilter === "no_spending" && ((t.amount ?? 0) <= 0 || hasBucketTag)) return false;
      if (selectedTagIds.length && !(
        selectedTagIds.includes(t.bucket_1_tag_id ?? -1)
        || selectedTagIds.includes(t.bucket_2_tag_id ?? -1)
        || (t.meta_tag_ids?.some((id) => selectedTagIds.includes(id)) ?? false)
      )) return false;
      return true;
    }),
    [dateTxns, missingTagFilter, selectedCategories, selectedTagIds, tagStateFilter]
  );
  const spendSlices = useMemo(() => buildTrendPieSlices(baseTxns, "spending", grouping, tagMap), [baseTxns, grouping, tagMap]);
  const incomeSlices = useMemo(() => buildTrendPieSlices(baseTxns, "income", grouping, tagMap), [baseTxns, grouping, tagMap]);
  const spendColors = useMemo(() => sliceColors(spendSlices), [spendSlices]);
  const incomeColors = useMemo(() => sliceColors(incomeSlices), [incomeSlices]);
  const flowModel = useMemo(() => buildFlowOfFundsModel(baseTxns, flowGrouping, tagMap), [baseTxns, flowGrouping, tagMap]);
  const flowDetail = useMemo(() => flowModel?.nodes.find((n) => n.id === flowNodeId), [flowModel, flowNodeId]);
  const selectionTxns = useMemo(() => expandNettingGroupsForDisplay(selection?.slice.transactions ?? [], transactions), [selection, transactions]);
  const flowDetailTxns = useMemo(() => expandNettingGroupsForDisplay(flowDetail?.transactions ?? [], transactions), [flowDetail, transactions]);

  const resetDrilldowns = () => { setSelection(null); setFlowNodeId(null); };
  const toggleCategory = (key: string, checked: boolean) => {
    setSelectedCategories((prev) => checked ? [...prev, key] : prev.filter((x) => x !== key));
    resetDrilldowns();
  };
  const setTagsFilter = (ids: number[]) => { setTagStateFilter("all"); setSelectedTagIds(ids); resetDrilldowns(); };
  const setUntagged = () => { setTagStateFilter(tagStateFilter === "untagged" ? "all" : "untagged"); setSelectedTagIds([]); resetDrilldowns(); };
  const setMissing = (v: Exclude<MissingTagFilter, "all">) => { setMissingTagFilter(missingTagFilter === v ? "all" : v); resetDrilldowns(); };
  const clearFilters = () => {
    setStartDate(""); setEndDate(""); setSelectedCategories([]); setSelectedTagIds([]);
    setTagStateFilter("all"); setMissingTagFilter("all"); resetDrilldowns();
  };
  const bumpRange = (start: string, end: string) => { setStartDate(start); setEndDate(end); setSelection(null); setFlowNodeId(null); };
  const goTab = (t: VizTab) => { setVizTab(t); setFlowNodeId(null); };
  const onSlice = (side: "spending" | "income", sl: TrendPieSlice) => setSelection((p) => p?.side === side && p.slice.key === sl.key ? null : { side, slice: sl });
  const tagSummaryParts: string[] = [];
  if (tagStateFilter === "untagged") tagSummaryParts.push("untagged");
  else if (selectedTagIds.length) tagSummaryParts.push(`${selectedTagIds.length} tag${selectedTagIds.length === 1 ? "" : "s"}`);
  if (missingTagFilter === "no_meta") tagSummaryParts.push("no meta");
  if (missingTagFilter === "no_income") tagSummaryParts.push("no income");
  if (missingTagFilter === "no_spending") tagSummaryParts.push("no spending");
  const tagSum = tagSummaryParts.length ? tagSummaryParts.join(", ") : "any";
  const catSum = selectedCategories.length ? `${selectedCategories.length} detected` : "any";

  return (
    <>
      <div className="card card-tight col-flex mb-4" style={{ gap: 8, minWidth: 0 }}>
        <div className="between">
          <h3>Filters</h3>
        </div>

        <Section label="Date range" summary={formatDateRangeLabel(startDate, endDate)}>
          <div className="row-flex flex-wrap gap-2 mb-3">
            {DATE_RANGE_PRESETS.map(({ value, label }) => (
              <button key={value} className="btn ghost btn-sm" onClick={() => { const d = buildDatePreset(value); bumpRange(d.start, d.end); }}>{label}</button>
            ))}
          </div>
          <div className="col-flex gap-2">
            <input type="date" className="input input-sm" style={{ minWidth: 0 }} value={startDate} onChange={(e) => bumpRange(e.target.value, endDate)} />
            <input type="date" className="input input-sm" style={{ minWidth: 0 }} value={endDate} onChange={(e) => bumpRange(startDate, e.target.value)} />
          </div>
        </Section>

        <Section label="Category" summary={`${tagSum}, ${catSum}`}>
          <div className="col-flex" style={{ gap: 12 }}>
            <CheckList
              label="Tags"
              options={sortedTags.map((tag) => [tag.id, <TagBadge key={tag.id} tag={tag} />] as [number, ReactNode])}
              selected={selectedTagIds}
              onChange={setTagsFilter}
              tertiary={{ label: "Untagged", active: tagStateFilter === "untagged", onClick: setUntagged }}
            />
            <div className="col-flex" style={{ gap: 6 }}>
              <div className="xs muted fw-semi">Missing tags</div>
              <div className="row-flex flex-wrap gap-2">
                <button className={`btn ${missingTagFilter === "no_meta" ? "primary" : "ghost"} btn-sm`} onClick={() => setMissing("no_meta")}>No meta</button>
                <button className={`btn ${missingTagFilter === "no_income" ? "primary" : "ghost"} btn-sm`} onClick={() => setMissing("no_income")}>No income</button>
                <button className={`btn ${missingTagFilter === "no_spending" ? "primary" : "ghost"} btn-sm`} onClick={() => setMissing("no_spending")}>No spending</button>
              </div>
            </div>
            <div className="col-flex" style={{ gap: 6 }}>
              <div className="xs muted fw-semi">Detected ({selectedCategories.length})</div>
              <div className="row-flex gap-2">
                <button className="btn ghost btn-sm" onClick={() => { setSelectedCategories([...new Set(categoryOptionsByPrimary.flatMap((g) => g.options.map((o) => o.value)))]); resetDrilldowns(); }}>All</button>
                <button className="btn ghost btn-sm" onClick={() => { setSelectedCategories([]); resetDrilldowns(); }}>None</button>
              </div>
              <div className="scrollbox" style={{ border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: 8 }}>
                {categoryOptionsByPrimary.length ? categoryOptionsByPrimary.map((group) => {
                  const groupVals = group.options.map((o) => o.value);
                  const all = groupVals.length > 0 && groupVals.every((v) => selectedCategories.includes(v));
                  return (
                    <div key={group.primary} style={{ marginBottom: 4 }}>
                      <label className="check fw-semi" style={{ display: "flex" }}>
                        <input
                          type="checkbox"
                          checked={all}
                          onChange={(e) => {
                            setSelectedCategories(e.target.checked ? [...new Set([...selectedCategories, ...groupVals])] : selectedCategories.filter((v) => !groupVals.includes(v)));
                            resetDrilldowns();
                          }}
                        />
                        <span>{group.primaryLabel}</span>
                      </label>
                      <div style={{ paddingLeft: 18 }}>
                        {group.options.map((opt) => (
                          <label key={opt.value} className="check" style={{ display: "flex", padding: "2px 0" }}>
                            <input type="checkbox" checked={selectedCategories.includes(opt.value)} onChange={(e) => toggleCategory(opt.value, e.target.checked)} />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                }) : <p className="muted small" style={{ margin: 0 }}>No detected categories in this range.</p>}
              </div>
            </div>
          </div>
        </Section>

        <button className="btn ghost btn-block mt-2" onClick={clearFilters}>Clear all filters</button>
      </div>

      <div className="tabs">
        <button className={vizTab === "pie" ? "active" : ""} onClick={() => goTab("pie")}>Pie chart</button>
        <button className={vizTab === "flow" ? "active" : ""} onClick={() => goTab("flow")}>Flow of funds</button>
        <button className={vizTab === "timeline" ? "active" : ""} onClick={() => goTab("timeline")}>Timeline</button>
        <button className={vizTab === "ribbon" ? "active" : ""} onClick={() => goTab("ribbon")}>Ribbon</button>
        <button className={vizTab === "trendline" ? "active" : ""} onClick={() => goTab("trendline")}>Trendline</button>
      </div>

      {vizTab === "timeline" && <TimelineTrendChart transactions={baseTxns} allTransactions={transactions} tags={tags} view={timelineView} granularity={timelineGranularity} onViewChange={setTimelineView} onGranularityChange={setTimelineGranularity} />}
      {vizTab === "ribbon" && <RibbonTrendChart transactions={baseTxns} allTransactions={transactions} tags={tags} grouping={ribbonGrouping} granularity={ribbonGranularity} onGroupingChange={setRibbonGrouping} onGranularityChange={setRibbonGranularity} />}
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
              <TransactionTable transactions={selectionTxns} tags={tags} keyPrefix="viz-trend" nettingMode />
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
              <TransactionTable transactions={flowDetailTxns} tags={tags} keyPrefix="viz-flow" nettingMode />
            </div>
          )}
        </>
      )}
    </>
  );
}

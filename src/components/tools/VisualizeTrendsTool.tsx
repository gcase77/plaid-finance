import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Tag, Txn } from "../types";
import { buildAuthHeaders } from "../../lib/auth";
import { DATE_RANGE_PRESETS } from "../shared/dateRangeUtils";
import TransactionTable from "../shared/TransactionTable";
import { buildDatePreset } from "../../utils/datePresets";
import FlowSankeySvg from "./FlowSankeySvg";
import { buildFlowOfFundsModel, type FlowGrouping } from "./flowOfFundsSankey";
import TimelineTrendChart from "./TimelineTrendChart";
import {
  buildTrendPieSlices,
  filterTrendsTransactions,
  sliceColors,
  type TrendPieGrouping,
  type TrendPieSlice
} from "./visualizeTrendsUtils";

type Props = { transactions: Txn[]; token: string | null };

type VizTab = "pie" | "flow" | "timeline";
type Selection = { side: "spending" | "income"; slice: TrendPieSlice };

const CX = 100;
const CY = 100;
const R = 90;

function pieSlicePath(a0: number, a1: number): string {
  if (a1 - a0 >= 359.99)
    return `M ${CX} ${CY} m 0 ${-R} a ${R} ${R} 0 1 1 0 ${2 * R} a ${R} ${R} 0 1 1 0 ${-2 * R}`;
  const rad = (d: number) => ((d - 90) * Math.PI) / 180;
  const x0 = CX + R * Math.cos(rad(a0));
  const y0 = CY + R * Math.sin(rad(a0));
  const x1 = CX + R * Math.cos(rad(a1));
  const y1 = CY + R * Math.sin(rad(a1));
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
}

function SvgPie({
  slices,
  colors,
  selectedKey,
  onSelect
}: {
  slices: TrendPieSlice[];
  colors: Map<string, string>;
  selectedKey: string | null;
  onSelect: (s: TrendPieSlice) => void;
}) {
  const total = slices.reduce((s, x) => s + x.amount, 0);
  if (total <= 0) {
    return (
      <svg viewBox="0 0 200 200" className="w-100" style={{ maxHeight: 220 }}>
        <circle cx={CX} cy={CY} r={R} fill="var(--bs-secondary-bg)" stroke="var(--bs-border-color)" />
        <text x={CX} y={CY} textAnchor="middle" className="fill-secondary small">No data</text>
      </svg>
    );
  }
  if (slices.length === 1) {
    const c = colors.get(slices[0].key) ?? "#888";
    return (
      <svg viewBox="0 0 200 200" className="w-100" style={{ maxHeight: 220, cursor: "pointer" }}
        onClick={() => onSelect(slices[0])}>
        <circle cx={CX} cy={CY} r={R} fill={c} opacity={selectedKey && selectedKey !== slices[0].key ? 0.35 : 1}
          stroke="var(--bs-body-bg)" strokeWidth={1} />
      </svg>
    );
  }
  const paths: ReactNode[] = [];
  let ang = -90;
  for (const sl of slices) {
    const sweep = (sl.amount / total) * 360;
    const a0 = ang;
    const a1 = ang + sweep;
    ang = a1;
    const path = pieSlicePath(a0, a1);
    const c = colors.get(sl.key) ?? "#888";
    const dim = selectedKey && selectedKey !== sl.key;
    paths.push(
      <path key={sl.key} d={path} fill={c} opacity={dim ? 0.35 : 1} stroke="var(--bs-body-bg)" strokeWidth={1}
        style={{ cursor: "pointer" }} onClick={() => onSelect(sl)}>
        <title>{`${sl.label}: $${sl.amount.toFixed(2)}`}</title>
      </path>
    );
  }
  return (
    <svg viewBox="0 0 200 200" className="w-100" style={{ maxHeight: 220 }}>{paths}</svg>
  );
}

const GROUPING_OPTIONS: { value: TrendPieGrouping; label: string }[] = [
  { value: "detected", label: "Detected categories" },
  { value: "buckets", label: "Income & spending buckets" },
  { value: "meta", label: "Meta tags" }
];

const FLOW_GROUPING_OPTIONS: { value: FlowGrouping; label: string }[] = [
  { value: "detected", label: "Detected categories" },
  { value: "tags", label: "My tags" }
];

const EMPTY_TAGS: Tag[] = [];

export default function VisualizeTrendsTool({ transactions, token }: Props) {
  const [vizTab, setVizTab] = useState<VizTab>("pie");
  const [grouping, setGrouping] = useState<TrendPieGrouping>("detected");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [flowGrouping, setFlowGrouping] = useState<FlowGrouping>("detected");
  const [flowNodeId, setFlowNodeId] = useState<string | null>(null);

  const tagsQuery = useQuery({
    queryKey: ["tags"],
    enabled: !!token,
    queryFn: async (): Promise<Tag[]> => {
      const res = await fetch("/api/tags", { headers: buildAuthHeaders(token) });
      if (!res.ok) throw new Error(`Failed to load tags (${res.status})`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });
  const tags = tagsQuery.data ?? EMPTY_TAGS;
  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  const baseTxns = useMemo(
    () => filterTrendsTransactions(transactions, startDate, endDate),
    [transactions, startDate, endDate]
  );

  const spendingSlices = useMemo(
    () => buildTrendPieSlices(baseTxns, "spending", grouping, tagMap),
    [baseTxns, grouping, tagMap]
  );
  const incomeSlices = useMemo(
    () => buildTrendPieSlices(baseTxns, "income", grouping, tagMap),
    [baseTxns, grouping, tagMap]
  );

  const spendColors = useMemo(() => sliceColors(spendingSlices), [spendingSlices]);
  const incomeColors = useMemo(() => sliceColors(incomeSlices), [incomeSlices]);

  const flowModel = useMemo(() => buildFlowOfFundsModel(baseTxns, flowGrouping, tagMap), [baseTxns, flowGrouping, tagMap]);
  const flowDetail = useMemo(() => flowModel?.nodes.find((n) => n.id === flowNodeId), [flowModel, flowNodeId]);

  const goTab = (t: VizTab) => {
    setVizTab(t);
    setFlowNodeId(null);
  };

  const onSlice = (side: "spending" | "income", sl: TrendPieSlice) =>
    setSelection((prev) =>
      prev?.side === side && prev.slice.key === sl.key ? null : { side, slice: sl }
    );

  const bumpRange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    setSelection(null);
    setFlowNodeId(null);
  };

  return (
    <div className="card">
      <div className="card-body">
        <h6 className="card-title mb-1">Visualize Trends</h6>
        <p className="text-muted small mb-2">Click graphs to view transactions</p>

        <div className="mb-3 pb-2 border-bottom small">
          <div className="fw-medium text-body-secondary mb-2">Date range</div>
          <div className="d-flex flex-wrap gap-1 mb-2" role="group">
            {DATE_RANGE_PRESETS.map(({ value, label }) => (
              <button key={value} type="button" className="btn btn-outline-secondary btn-sm"
                onClick={() => {
                  const d = buildDatePreset(value);
                  bumpRange(d.start, d.end);
                }}>
                {label}
              </button>
            ))}
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <input type="date" className="form-control form-control-sm" style={{ width: "auto", minWidth: "8rem" }} value={startDate}
              onChange={(e) => bumpRange(e.target.value, endDate)} />
            <span className="text-body-secondary user-select-none">–</span>
            <input type="date" className="form-control form-control-sm" style={{ width: "auto", minWidth: "8rem" }} value={endDate}
              onChange={(e) => bumpRange(startDate, e.target.value)} />
          </div>
        </div>

        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button type="button" className={`nav-link ${vizTab === "pie" ? "active" : ""}`} onClick={() => goTab("pie")}>
              Pie Chart
            </button>
          </li>
          <li className="nav-item">
            <button type="button" className={`nav-link ${vizTab === "flow" ? "active" : ""}`} onClick={() => goTab("flow")}>
              Flow of Funds
            </button>
          </li>
          <li className="nav-item">
            <button type="button" className={`nav-link ${vizTab === "timeline" ? "active" : ""}`} onClick={() => goTab("timeline")}>
              Timeline
            </button>
          </li>
        </ul>

        {vizTab === "timeline" && (
          <TimelineTrendChart transactions={baseTxns} tags={tags} />
        )}

        {vizTab === "pie" && (
          <div className="mb-3">
            <span className="small text-muted me-2 d-block d-md-inline mb-1 mb-md-0">Group by</span>
            <div className="btn-group btn-group-sm flex-wrap" role="group">
              {GROUPING_OPTIONS.map((opt) => (
                <button key={opt.value} type="button"
                  className={`btn btn-outline-primary ${grouping === opt.value ? "active" : ""}`}
                  onClick={() => { setGrouping(opt.value); setSelection(null); }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {vizTab === "flow" && (
          <div className="mb-3">
            <span className="small text-muted me-2 d-block d-md-inline mb-1 mb-md-0">Group by</span>
            <div className="btn-group btn-group-sm flex-wrap" role="group">
              {FLOW_GROUPING_OPTIONS.map((opt) => (
                <button key={opt.value} type="button"
                  className={`btn btn-outline-primary ${flowGrouping === opt.value ? "active" : ""}`}
                  onClick={() => { setFlowGrouping(opt.value); setFlowNodeId(null); }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {vizTab === "flow" && (
          <>
            {flowModel ? (
              <div className="border rounded p-2 mb-3" style={{ background: "var(--bs-tertiary-bg)" }}>
                <div className="overflow-x-auto">
                  <FlowSankeySvg
                    model={flowModel}
                    width={1200}
                    height={Math.max(448, Math.min(232 + flowModel.nodes.length * 18, 820))}
                    selectedId={flowNodeId}
                    onSelectNode={setFlowNodeId}
                  />
                </div>
              </div>
            ) : (
              <p className="text-muted small mb-0">No income or spending in this range.</p>
            )}
            {flowDetail && (
              <div className="mt-3 border-top pt-3">
                <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                  <h6 className="small mb-0 fw-semibold">{flowDetail.label}</h6>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setFlowNodeId(null)}>Clear</button>
                </div>
                <TransactionTable transactions={flowDetail.transactions} tags={tags} keyPrefix="viz-flow" />
              </div>
            )}
          </>
        )}

        {vizTab === "pie" && (
          <>
            <div className="row g-4">
              <div className="col-lg-6">
                <h6 className="small fw-semibold mb-2">Spending</h6>
                <SvgPie slices={spendingSlices} colors={spendColors}
                  selectedKey={selection?.side === "spending" ? selection.slice.key : null}
                  onSelect={(sl) => onSlice("spending", sl)} />
                <Legend slices={spendingSlices} colors={spendColors}
                  selectedKey={selection?.side === "spending" ? selection.slice.key : null}
                  onSelect={(sl) => onSlice("spending", sl)} />
              </div>
              <div className="col-lg-6">
                <h6 className="small fw-semibold mb-2">Income</h6>
                <SvgPie slices={incomeSlices} colors={incomeColors}
                  selectedKey={selection?.side === "income" ? selection.slice.key : null}
                  onSelect={(sl) => onSlice("income", sl)} />
                <Legend slices={incomeSlices} colors={incomeColors}
                  selectedKey={selection?.side === "income" ? selection.slice.key : null}
                  onSelect={(sl) => onSlice("income", sl)} />
              </div>
            </div>

            {selection && (
              <div className="mt-4 border-top pt-3">
                <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                  <h6 className="small mb-0 fw-semibold">
                    {selection.side === "spending" ? "Spending" : "Income"} — {selection.slice.label}
                    <span className="text-muted fw-normal ms-2">(${selection.slice.amount.toFixed(2)})</span>
                  </h6>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSelection(null)}>Clear</button>
                </div>
                <TransactionTable transactions={selection.slice.transactions} tags={tags} keyPrefix="viz-trend" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Legend({
  slices,
  colors,
  selectedKey,
  onSelect
}: {
  slices: TrendPieSlice[];
  colors: Map<string, string>;
  selectedKey: string | null;
  onSelect: (s: TrendPieSlice) => void;
}) {
  const total = slices.reduce((s, x) => s + x.amount, 0);
  if (!slices.length) return null;
  return (
    <ul className="list-unstyled small mb-0 mt-2" style={{ columnCount: 2, columnGap: "1rem" }}>
      {slices.map((sl) => {
        const pct = total > 0 ? (100 * sl.amount) / total : 0;
        const c = colors.get(sl.key) ?? "#888";
        return (
          <li key={sl.key} className="mb-1" style={{ breakInside: "avoid" }}>
            <button type="button"
              className={`btn btn-link btn-sm text-start text-decoration-none p-0 border-0 w-100 ${selectedKey === sl.key ? "fw-bold" : ""}`}
              onClick={() => onSelect(sl)}>
              <span className="d-inline-block rounded-circle me-1 align-middle" style={{ width: 10, height: 10, background: c }} />
              <span className="align-middle">{sl.label}</span>
              <span className="text-muted ms-1">{pct.toFixed(0)}%</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

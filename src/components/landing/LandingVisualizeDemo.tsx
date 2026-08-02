import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Tag, Txn } from "../types";
import { expandNettingGroupsForDisplay } from "../../utils/nettingUtils";
import { buildFlowOfFundsModel, type FlowGrouping } from "../tools/flowOfFundsSankey";
import { filterTrendsTransactions } from "../tools/visualizeTrendsUtils";
import demo from "./landingDemo.json";
import LandingFlowSankey from "./LandingFlowSankey";
import LandingRibbonChart from "./LandingRibbonChart";
import LandingTimelineChart, { type TimelineView } from "./LandingTimelineChart";
import LandingVizTxnPanel from "./LandingVizTxnPanel";

type VizSlide = "flow" | "timeline" | "ribbon";
const SLIDES: VizSlide[] = ["flow", "timeline", "ribbon"];
const SLIDE_LABEL: Record<VizSlide, string> = { flow: "Flow of funds", timeline: "Timeline", ribbon: "Spend per category" };
const FLOW_GROUPING: { value: FlowGrouping; label: string }[] = [
  { value: "tags", label: "My Tags" },
  { value: "detected", label: "Detected Category" },
];
type RibbonGrouping = "detected" | "buckets";

type DemoTxn = Omit<Txn, "datetime" | "authorized_datetime"> & {
  days_ago: number;
  authorized_days_ago?: number | null;
};

const { tags, transactions: rawTxns } = demo as { tags: Tag[]; transactions: DemoTxn[] };

function daysAgoToIso(daysAgo: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function resolveDemoTxns(rows: DemoTxn[]): Txn[] {
  return rows.map(({ days_ago, authorized_days_ago, ...rest }) => ({
    ...rest,
    datetime: daysAgoToIso(days_ago),
    authorized_datetime: authorized_days_ago == null ? null : daysAgoToIso(authorized_days_ago),
  }));
}

function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }> }) {
  return (
    <div className="segmented" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" className={value === o.value ? "active" : ""} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export default function LandingVisualizeDemo() {
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [index, setIndex] = useState(0);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const [flowGrouping, setFlowGrouping] = useState<FlowGrouping>("tags");
  const [flowNodeId, setFlowNodeId] = useState<string | null>(null);
  const [timelineView, setTimelineView] = useState<TimelineView>("area");
  const [ribbonGrouping, setRibbonGrouping] = useState<RibbonGrouping>("buckets");

  const transactions = useMemo(() => resolveDemoTxns(rawTxns), []);
  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t])), []);
  const baseTxns = useMemo(() => filterTrendsTransactions(transactions, "", ""), [transactions]);
  const flowModels = useMemo(() => ({
    tags: buildFlowOfFundsModel(baseTxns, "tags", tagMap, { omitMeta: true }),
    detected: buildFlowOfFundsModel(baseTxns, "detected", tagMap, { omitMeta: true }),
  }), [baseTxns, tagMap]);
  const flowModel = flowModels[flowGrouping];
  const flowHeight = Math.max(448, Math.min(232 + Math.max(flowModels.tags?.nodes.length ?? 0, flowModels.detected?.nodes.length ?? 0) * 18, 820));
  const flowDetail = useMemo(() => flowModel?.nodes.find((n) => n.id === flowNodeId), [flowModel, flowNodeId]);
  const flowDetailTxns = useMemo(
    () => expandNettingGroupsForDisplay(flowDetail?.transactions ?? [], transactions),
    [flowDetail, transactions]
  );

  const placeIndicator = (i: number) => {
    const btn = btnRefs.current[i];
    if (!btn) return;
    setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
  };

  const goTab = (t: number) => {
    if (t === index) return;
    setFlowNodeId(null);
    setIndex(t);
  };

  useEffect(() => {
    placeIndicator(index);
  }, [index]);

  useEffect(() => {
    const sync = () => placeIndicator(index);
    const id = requestAnimationFrame(sync);
    window.addEventListener("resize", sync);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", sync);
    };
  }, [index]);

  const flowBody = (
    <>
      <div className="row-flex gap-3 mb-3" style={{ justifyContent: "flex-end" }}>
        <span className="small muted">Group by</span>
        <Seg value={flowGrouping} onChange={(v) => { setFlowGrouping(v); setFlowNodeId(null); }} options={FLOW_GROUPING} />
      </div>
      {flowModel ? (
        <div className="viz-wrap">
          <div style={{ overflowX: "auto" }}>
            <LandingFlowSankey
              model={flowModel}
              width={1200}
              height={flowHeight}
              selectedId={flowNodeId}
              onSelectNode={setFlowNodeId}
            />
          </div>
        </div>
      ) : <p className="muted small">No income or spending in this range.</p>}
      {flowDetail && (
        <LandingVizTxnPanel
          title={flowDetail.label}
          transactions={flowDetailTxns}
          tags={tags}
          onClear={() => setFlowNodeId(null)}
          keyPrefix="landing-viz-flow"
        />
      )}
    </>
  );

  return (
    <>
      <header className="page-header landing-viz-header">
        <Link to="/auth" className="landing-cta">
          Connect My Bank
          <span className="landing-cta-arrow" aria-hidden>→</span>
        </Link>
        <h1>Visualize trends</h1>
      </header>
      <div className="landing-viz-layout">
        <div className="tabs landing-viz-tabs">
          {SLIDES.map((s, i) => (
            <button
              key={s}
              type="button"
              ref={(el) => { btnRefs.current[i] = el; }}
              className={index === i ? "active" : ""}
              onClick={() => goTab(i)}
            >
              {SLIDE_LABEL[s]}
            </button>
          ))}
          <span className="landing-viz-tab-ink" style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }} aria-hidden />
        </div>
        <div className="landing-viz-viewport">
          <div className="landing-viz-track" style={{ transform: `translateX(-${index * 100}%)` }}>
            <section className="landing-viz-slide" aria-label={SLIDE_LABEL.flow} aria-hidden={index !== 0}>
              {flowBody}
            </section>
            <section className="landing-viz-slide" aria-label={SLIDE_LABEL.timeline} aria-hidden={index !== 1}>
              <LandingTimelineChart
                transactions={baseTxns}
                allTransactions={transactions}
                tags={tags}
                view={timelineView}
                onViewChange={setTimelineView}
              />
            </section>
            <section className="landing-viz-slide" aria-label={SLIDE_LABEL.ribbon} aria-hidden={index !== 2}>
              <LandingRibbonChart
                transactions={baseTxns}
                allTransactions={transactions}
                tags={tags}
                grouping={ribbonGrouping}
                onGroupingChange={setRibbonGrouping}
              />
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

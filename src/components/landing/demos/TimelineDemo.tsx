import { useState } from "react";
import TimelineTrendChart, { type TimelineGranularity, type TimelineView } from "../../tools/TimelineTrendChart";
import { DEMO_TAGS, DEMO_TRANSACTIONS } from "../demoData";

export default function TimelineDemo() {
  const [view, setView] = useState<TimelineView>("area");
  const [granularity, setGranularity] = useState<TimelineGranularity>("month");

  return (
    <div className="landing-demo-shell">
      <div className="landing-demo-hint">
        Click a period to see transactions. Switch between area and net savings views.
      </div>
      <TimelineTrendChart
        transactions={DEMO_TRANSACTIONS}
        allTransactions={DEMO_TRANSACTIONS}
        tags={DEMO_TAGS}
        view={view}
        granularity={granularity}
        onViewChange={setView}
        onGranularityChange={setGranularity}
      />
    </div>
  );
}

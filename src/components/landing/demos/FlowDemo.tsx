import { useMemo, useState } from "react";
import FlowSankeySvg from "../../tools/FlowSankeySvg";
import { buildFlowOfFundsModel, type FlowGrouping } from "../../tools/flowOfFundsSankey";
import TransactionTable from "../../shared/TransactionTable";
import { Segmented } from "../../shared/ui";
import { DEMO_TAG_MAP, DEMO_TAGS, DEMO_TRANSACTIONS } from "../demoData";

export default function FlowDemo() {
  const [grouping, setGrouping] = useState<FlowGrouping>("tags");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const model = useMemo(
    () => buildFlowOfFundsModel(DEMO_TRANSACTIONS, grouping, DEMO_TAG_MAP),
    [grouping]
  );

  const drillTxns = useMemo(() => {
    if (!model || !selectedId) return [];
    const node = model.nodes.find((n) => n.id === selectedId);
    if (node) return node.transactions;
    const link = model.links.find((l) => l.source === selectedId || l.target === selectedId);
    return link?.transactions ?? [];
  }, [model, selectedId]);

  if (!model) {
    return <p className="muted small">Not enough tagged data for flow visualization.</p>;
  }

  return (
    <div className="landing-demo-shell">
      <div className="between mb-3 flex-wrap gap-2">
        <div className="landing-demo-hint" style={{ margin: 0 }}>
          Click a node to drill into transactions. Toggle between tag-based and detected-category views.
        </div>
        <Segmented
          value={grouping}
          onChange={(v) => { setGrouping(v); setSelectedId(null); }}
          options={[
            { value: "tags", label: "By tags" },
            { value: "detected", label: "By detected" }
          ]}
        />
      </div>
      <div className="viz-wrap">
        <FlowSankeySvg
          model={model}
          width={900}
          height={340}
          selectedId={selectedId}
          onSelectNode={(id) => setSelectedId((prev) => (prev === id ? null : id))}
        />
      </div>
      {selectedId && drillTxns.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p className="small fw-semi mb-2">{drillTxns.length} transaction{drillTxns.length === 1 ? "" : "s"}</p>
          <TransactionTable transactions={drillTxns} tags={DEMO_TAGS} keyPrefix="demo-flow" />
        </div>
      )}
    </div>
  );
}

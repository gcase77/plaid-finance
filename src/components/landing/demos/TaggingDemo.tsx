import { useMemo, useState } from "react";
import type { Tag, Txn } from "../../types";
import TransactionTable from "../../shared/TransactionTable";
import { TagBadge } from "../../shared/TagBadge";
import { Popover } from "../../shared/ui";
import { DEMO_TAGS, DEMO_TRANSACTIONS } from "../demoData";

function TagRow({ tag }: { tag: Tag }) {
  return (
    <div className="between" style={{ padding: "8px 12px" }}>
      <TagBadge tag={tag} />
      <span className="chip">{tag.type === "meta" ? "Meta" : tag.type.startsWith("income") ? "Income" : "Spending"}</span>
    </div>
  );
}

function applyTag(txns: Txn[], ids: Set<string>, tag: Tag): Txn[] {
  return txns.map((t) => {
    if (!t.transaction_id || !ids.has(t.transaction_id)) return t;
    if (tag.type === "meta") {
      const meta = [...new Set([...(t.meta_tag_ids ?? []), tag.id])];
      return { ...t, meta_tag_ids: meta };
    }
    const isIncome = (t.amount ?? 0) < 0;
    if (tag.type.startsWith("income") && !isIncome) return t;
    if (tag.type.startsWith("spending") && isIncome) return t;
    if (tag.type === "income_bucket_2" || tag.type === "spending_bucket_2") {
      return { ...t, bucket_2_tag_id: tag.id };
    }
    return { ...t, bucket_1_tag_id: tag.id };
  });
}

export default function TaggingDemo() {
  const [txns, setTxns] = useState<Txn[]>(() =>
    DEMO_TRANSACTIONS.filter((t) => !t.bucket_1_tag_id && (t.amount ?? 0) > 0).slice(0, 8)
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyBtn, setApplyBtn] = useState<HTMLButtonElement | null>(null);

  const sortedTags = useMemo(
    () => [...DEMO_TAGS].sort((a, b) => {
      const rank = (t: Tag) => (t.type === "meta" ? 0 : t.type.startsWith("spending") ? 1 : 2);
      return rank(a) - rank(b) || a.name.localeCompare(b.name);
    }),
    []
  );

  const applySingle = (tagId: number) => {
    const tag = DEMO_TAGS.find((t) => t.id === tagId);
    if (!tag || !selectedIds.size) return;
    setTxns((prev) => applyTag(prev, selectedIds, tag));
    setSelectedIds(new Set());
    setApplyOpen(false);
  };

  return (
    <div className="landing-demo-shell">
      <div className="landing-demo-hint">
        Select transactions, then apply a spending or meta tag — just like Tagging Mode in the app.
      </div>
      <div className="between mb-3 flex-wrap gap-2">
        <div className="row-flex gap-2 flex-wrap">
          <span className="chip chip-soft">Tagging Mode</span>
          {selectedIds.size > 0 && <span className="chip">{selectedIds.size} selected</span>}
        </div>
        <div style={{ position: "relative" }}>
          <button
            ref={setApplyBtn}
            className="btn primary btn-sm"
            disabled={!selectedIds.size}
            onClick={() => setApplyOpen((o) => !o)}
          >
            Apply tag
          </button>
          <Popover anchor={applyBtn} open={applyOpen} onClose={() => setApplyOpen(false)} width={300}>
            <div className="xs muted" style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)" }}>
              Apply to {selectedIds.size} transaction{selectedIds.size !== 1 ? "s" : ""}
            </div>
            <div className="scrollbox">
              {sortedTags.map((tag) => (
                <button
                  key={tag.id}
                  className="btn ghost btn-block"
                  style={{ padding: 0, borderRadius: 0, justifyContent: "stretch", borderColor: "transparent" }}
                  onClick={() => applySingle(tag.id)}
                >
                  <TagRow tag={tag} />
                </button>
              ))}
            </div>
          </Popover>
        </div>
      </div>
      <TransactionTable
        transactions={txns}
        tags={DEMO_TAGS}
        taggingMode
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        keyPrefix="demo-tag"
      />
    </div>
  );
}

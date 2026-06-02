import { useMemo } from "react";
import type { UseTransactionFiltersReturn } from "../../hooks/useTransactionFilters";
import type { Tag } from "../types";
import { countActiveConditions, describeNode, type LabelCtx } from "../../utils/filterTree";

export default function AppliedFiltersBar({ filters, tags }: { filters: UseTransactionFiltersReturn; tags: Tag[] }) {
  const { root, clear, derived } = filters;

  const ctx = useMemo<LabelCtx>(() => {
    const tagById = new Map(tags.map((t) => [t.id, t.name]));
    const bankById = new Map(derived.options.bankOptions);
    const accountById = new Map(derived.options.accountOptions);
    const categoryLabelByValue = new Map<string, string>();
    derived.options.categoryOptionsByPrimary.forEach((g) => g.options.forEach((o) => categoryLabelByValue.set(o.value, o.label)));
    return {
      tagName: (id) => tagById.get(id) ?? `#${id}`,
      bankLabel: (id) => bankById.get(id) ?? id,
      accountLabel: (id) => accountById.get(id) ?? id,
      categoryLabel: (value) => categoryLabelByValue.get(value) ?? value
    };
  }, [tags, derived.options]);

  if (countActiveConditions(root) === 0) return null;

  return (
    <div className="row-flex flex-wrap gap-2 mb-3" style={{ alignItems: "center" }}>
      <span className="xs muted">Showing:</span>
      <span className="chip chip-soft" style={{ lineHeight: 1.4 }}>{describeNode(root, ctx)}</span>
      <button className="btn ghost btn-sm" onClick={clear}>Clear</button>
    </div>
  );
}

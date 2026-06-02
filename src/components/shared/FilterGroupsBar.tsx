import { useMemo } from "react";
import type { UseTransactionFiltersReturn } from "../../hooks/useTransactionFilters";
import type { Tag } from "../types";
import { countActiveConditions, describeNode, type LabelCtx } from "../../utils/filterTree";
import { Segmented } from "./ui";

type Props = { filters: UseTransactionFiltersReturn; tags: Tag[] };

export default function FilterGroupsBar({ filters, tags }: Props) {
  const { state, actions, derived } = filters;

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

  const draftActive = countActiveConditions(derived.draftGroup) > 0;
  const hasGroups = state.savedGroups.length > 0;

  return (
    <div className="col-flex" style={{ gap: 8, border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: 10 }}>
      <div className="between">
        <span className="fw-semi">Filter groups</span>
        {hasGroups && (
          <div className="row-flex gap-2" style={{ alignItems: "center" }}>
            <span className="xs muted">Combine with</span>
            <Segmented
              value={state.groupsOperator}
              onChange={actions.setGroupsOperator}
              options={[{ value: "and", label: "AND" }, { value: "or", label: "OR" }]}
            />
          </div>
        )}
      </div>

      {!hasGroups && (
        <p className="xs muted" style={{ margin: 0, lineHeight: 1.4 }}>
          Build a set of conditions below, then save it as a group. Add more groups and combine them with AND/OR to express logic like
          {" "}<span className="fw-semi">(tag = hi) OR (tag = spend AND last 30 days)</span>.
        </p>
      )}

      {state.savedGroups.map((group, i) => (
        <div key={group.id} className="col-flex" style={{ gap: 4 }}>
          {i > 0 && <span className="xs muted fw-semi" style={{ textAlign: "center" }}>{state.groupsOperator === "or" ? "OR" : "AND"}</span>}
          <div className="between chip chip-soft" style={{ alignItems: "flex-start", gap: 8, padding: "6px 10px", borderRadius: "var(--r-sm)" }}>
            <span style={{ lineHeight: 1.4 }}>
              <span className="xs muted">Group {i + 1}: </span>
              {describeNode(group, ctx)}
            </span>
            <button
              type="button"
              aria-label={`Remove group ${i + 1}`}
              onClick={() => actions.removeGroup(group.id)}
              style={{ background: "transparent", border: 0, color: "inherit", cursor: "pointer", fontSize: "0.95rem", lineHeight: 1 }}
            >✕</button>
          </div>
        </div>
      ))}

      {draftActive && hasGroups && <span className="xs muted fw-semi" style={{ textAlign: "center" }}>{state.groupsOperator === "or" ? "OR" : "AND"}</span>}
      {draftActive && (
        <div className="chip" style={{ padding: "6px 10px", borderRadius: "var(--r-sm)", borderStyle: "dashed", lineHeight: 1.4 }}>
          <span className="xs muted">Current (unsaved): </span>{describeNode(derived.draftGroup, ctx)}
        </div>
      )}

      <div className="row-flex gap-2">
        <button className="btn ghost btn-sm" disabled={!draftActive} onClick={actions.addCurrentAsGroup}>
          + Save current as group
        </button>
        {hasGroups && <button className="btn ghost btn-sm" onClick={actions.clearGroups}>Clear groups</button>}
      </div>
    </div>
  );
}

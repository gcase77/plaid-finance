import { useMemo, useState } from "react";
import type { UseTransactionFiltersReturn } from "../../hooks/useTransactionFilters";
import type { Tag, TextMode } from "../types";
import { DATE_RANGE_PRESETS } from "./dateRangeUtils";
import { buildDatePreset } from "../../utils/datePresets";
import { Segmented } from "./ui";
import { TagBadge } from "./TagBadge";
import {
  CONDITION_KINDS,
  CONDITION_LABELS,
  conditionNode,
  describeNode,
  emptyCondition,
  emptyGroup,
  removeNode,
  updateNode,
  type Condition,
  type ConditionKind,
  type ConditionNode,
  type FilterNode,
  type GroupNode,
  type LabelCtx
} from "../../utils/filterTree";

type Props = { filters: UseTransactionFiltersReturn; tags: Tag[] };

const tagRank = (type: Tag["type"]) => (type === "meta" ? 0 : type.startsWith("spending") ? 1 : 2);

function MultiCheckDropdown<T extends string | number>({
  label, options, selected, onChange
}: {
  label: string;
  options: Array<[T, React.ReactNode]>;
  selected: T[];
  onChange: (v: T[]) => void;
}) {
  const toggle = (id: T, checked: boolean) => onChange(checked ? [...selected, id] : selected.filter((x) => x !== id));
  return (
    <details className="collapse" style={{ flex: "1 1 220px", minWidth: 200 }}>
      <summary>
        <span className="fw-semi">{label}</span>
        <span className="muted small" style={{ marginLeft: "auto" }}>{selected.length || "any"}</span>
      </summary>
      <div className="content">
        <div className="row-flex gap-2 mb-2">
          <button className="btn ghost btn-sm" onClick={() => onChange(options.map(([v]) => v))}>All</button>
          <button className="btn ghost btn-sm" onClick={() => onChange([])}>None</button>
        </div>
        <div className="scrollbox" style={{ border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: 8 }}>
          {options.length === 0 ? <div className="muted xs">No options.</div> : options.map(([id, node]) => (
            <label key={id} className="check" style={{ display: "flex", padding: "3px 0" }}>
              <input type="checkbox" checked={selected.includes(id)} onChange={(e) => toggle(id, e.target.checked)} />
              <span>{node}</span>
            </label>
          ))}
        </div>
      </div>
    </details>
  );
}

function ConditionValueEditor({
  condition, onChange, filters, tags
}: {
  condition: Condition;
  onChange: (c: Condition) => void;
  filters: UseTransactionFiltersReturn;
  tags: Tag[];
}) {
  const { options } = filters.derived;
  const sortedTags = useMemo(() => [...tags].sort((a, b) => tagRank(a.type) - tagRank(b.type) || a.name.localeCompare(b.name)), [tags]);
  const categoryOptions = useMemo(
    () => options.categoryOptionsByPrimary.flatMap((g) => g.options.map((o) => [o.value, o.label] as [string, React.ReactNode])),
    [options.categoryOptionsByPrimary]
  );

  switch (condition.kind) {
    case "name":
      return (
        <div className="row-flex gap-2 flex-fill" style={{ alignItems: "center", flexWrap: "wrap" }}>
          <Segmented value={condition.mode === "null" ? "contains" : condition.mode} onChange={(v: TextMode) => onChange({ ...condition, mode: v })} options={[{ value: "contains", label: "Contains" }, { value: "not", label: "Not" }]} />
          <input className="input input-sm flex-fill" style={{ minWidth: 140 }} value={condition.value} onChange={(e) => onChange({ ...condition, value: e.target.value })} placeholder="Search name" />
        </div>
      );
    case "merchant":
      return (
        <div className="row-flex gap-2 flex-fill" style={{ alignItems: "center", flexWrap: "wrap" }}>
          <Segmented value={condition.mode} onChange={(v: TextMode) => onChange({ ...condition, mode: v })} options={[{ value: "contains", label: "Contains" }, { value: "not", label: "Not" }, { value: "null", label: "Unspecified" }]} />
          <input className="input input-sm flex-fill" style={{ minWidth: 140 }} value={condition.value} onChange={(e) => onChange({ ...condition, value: e.target.value })} placeholder="Search merchant" disabled={condition.mode === "null"} />
        </div>
      );
    case "tags":
      return (
        <MultiCheckDropdown
          label="Tags"
          options={sortedTags.map((t) => [t.id, <TagBadge key={t.id} tag={t} />] as [number, React.ReactNode])}
          selected={condition.ids}
          onChange={(ids) => onChange({ ...condition, ids })}
        />
      );
    case "bank":
      return <MultiCheckDropdown label="Bank" options={options.bankOptions} selected={condition.ids} onChange={(ids) => onChange({ ...condition, ids })} />;
    case "account":
      return <MultiCheckDropdown label="Account" options={options.accountOptions} selected={condition.ids} onChange={(ids) => onChange({ ...condition, ids })} />;
    case "category":
      return <MultiCheckDropdown label="Detected" options={categoryOptions} selected={condition.values} onChange={(values) => onChange({ ...condition, values })} />;
    case "amount":
      return (
        <div className="row-flex gap-2 flex-fill" style={{ alignItems: "center" }}>
          <input type="number" className="input input-sm" style={{ maxWidth: 120 }} value={condition.min} onChange={(e) => onChange({ ...condition, min: e.target.value })} placeholder="Min" />
          <span className="muted xs">to</span>
          <input type="number" className="input input-sm" style={{ maxWidth: 120 }} value={condition.max} onChange={(e) => onChange({ ...condition, max: e.target.value })} placeholder="Max" />
        </div>
      );
    case "date":
      return (
        <div className="row-flex gap-2 flex-fill" style={{ alignItems: "center", flexWrap: "wrap" }}>
          <select className="select input-sm" defaultValue="" onChange={(e) => { if (!e.target.value) return; const d = buildDatePreset(e.target.value); onChange({ ...condition, start: d.start, end: d.end }); }}>
            <option value="">Preset…</option>
            {DATE_RANGE_PRESETS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input type="date" className="input input-sm" value={condition.start} onChange={(e) => onChange({ ...condition, start: e.target.value })} />
          <span className="muted xs">to</span>
          <input type="date" className="input input-sm" value={condition.end} onChange={(e) => onChange({ ...condition, end: e.target.value })} />
        </div>
      );
    case "tagState":
      return (
        <Segmented value={condition.value === "all" ? "untagged" : condition.value} onChange={(v: "untagged" | "tagged") => onChange({ ...condition, value: v })} options={[{ value: "untagged", label: "Untagged" }, { value: "tagged", label: "Tagged" }]} />
      );
    case "missingTag":
      return (
        <select className="select input-sm" value={condition.value === "all" ? "no_meta" : condition.value} onChange={(e) => onChange({ ...condition, value: e.target.value as "no_meta" | "no_income" | "no_spending" })}>
          <option value="no_meta">No meta tag</option>
          <option value="no_income">No income tag</option>
          <option value="no_spending">No spending tag</option>
        </select>
      );
  }
}

function ConditionRow({
  node, update, remove, filters, tags
}: {
  node: ConditionNode;
  update: (id: string, updater: (n: FilterNode) => FilterNode) => void;
  remove: (id: string) => void;
  filters: UseTransactionFiltersReturn;
  tags: Tag[];
}) {
  const setKind = (kind: ConditionKind) => update(node.id, (n) => n.type === "condition" ? { ...n, condition: emptyCondition(kind) } : n);
  const setCondition = (c: Condition) => update(node.id, (n) => n.type === "condition" ? { ...n, condition: c } : n);
  return (
    <div className="row-flex gap-2" style={{ alignItems: "center", flexWrap: "wrap", padding: "4px 0" }}>
      <select className="select input-sm" style={{ maxWidth: 170 }} value={node.condition.kind} onChange={(e) => setKind(e.target.value as ConditionKind)}>
        {CONDITION_KINDS.map((k) => <option key={k} value={k}>{CONDITION_LABELS[k]}</option>)}
      </select>
      <ConditionValueEditor condition={node.condition} onChange={setCondition} filters={filters} tags={tags} />
      <button type="button" aria-label="Remove condition" className="btn ghost btn-sm" onClick={() => remove(node.id)}>✕</button>
    </div>
  );
}

function GroupView({
  node, depth, update, remove, filters, tags
}: {
  node: GroupNode;
  depth: number;
  update: (id: string, updater: (n: FilterNode) => FilterNode) => void;
  remove: (id: string) => void;
  filters: UseTransactionFiltersReturn;
  tags: Tag[];
}) {
  const isRoot = depth === 0;
  const setOp = (op: "and" | "or") => update(node.id, (n) => n.type === "group" ? { ...n, op } : n);
  const toggleNegate = () => update(node.id, (n) => n.type === "group" ? { ...n, negate: !n.negate } : n);
  const addCondition = () => update(node.id, (n) => n.type === "group" ? { ...n, children: [...n.children, conditionNode(emptyCondition("tags"))] } : n);
  const addGroup = () => update(node.id, (n) => n.type === "group" ? { ...n, children: [...n.children, emptyGroup("and")] } : n);

  const sep = node.op === "or" ? "OR" : "AND";

  return (
    <div
      className="col-flex"
      style={{
        gap: 6,
        border: "1px solid var(--line)",
        borderLeft: `3px solid ${node.negate ? "var(--danger)" : "var(--accent, var(--ink))"}`,
        borderRadius: "var(--r-sm)",
        padding: 10,
        background: depth % 2 === 1 ? "var(--surface-2, rgba(0,0,0,0.02))" : "transparent"
      }}
    >
      <div className="row-flex gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
        <span className="xs muted fw-semi">{isRoot ? "Match" : "Group —"}</span>
        <Segmented value={node.op} onChange={setOp} options={[{ value: "and", label: "AND" }, { value: "or", label: "OR" }]} />
        <button type="button" className={`btn btn-sm ${node.negate ? "danger" : "ghost"}`} onClick={toggleNegate} title="Negate this group">NOT</button>
        <div style={{ marginLeft: "auto" }} className="row-flex gap-2">
          <button type="button" className="btn ghost btn-sm" onClick={addCondition}>+ Condition</button>
          <button type="button" className="btn ghost btn-sm" onClick={addGroup}>+ Group</button>
          {!isRoot && <button type="button" aria-label="Remove group" className="btn ghost btn-sm" onClick={() => remove(node.id)}>✕</button>}
        </div>
      </div>

      {node.children.length === 0 && <div className="muted xs" style={{ paddingLeft: 4 }}>Empty group — add a condition or nested group.</div>}

      {node.children.map((child, i) => (
        <div key={child.id} className="col-flex" style={{ gap: 4 }}>
          {i > 0 && <span className="xs muted fw-semi" style={{ paddingLeft: 4 }}>{sep}</span>}
          {child.type === "group"
            ? <GroupView node={child} depth={depth + 1} update={update} remove={remove} filters={filters} tags={tags} />
            : <ConditionRow node={child} update={update} remove={remove} filters={filters} tags={tags} />}
        </div>
      ))}
    </div>
  );
}

export default function QueryBuilder({ filters, tags }: Props) {
  const { root, setRoot, derived, savedFilters, saveFilter, loadFilter, deleteFilter, clear } = filters;
  const [saveName, setSaveName] = useState("");

  const update = (id: string, updater: (n: FilterNode) => FilterNode) => setRoot(updateNode(root, id, updater) as GroupNode);
  const remove = (id: string) => setRoot(removeNode(root, id) as GroupNode);

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

  return (
    <div className="card card-tight col-flex" style={{ gap: 10, minWidth: 0 }}>
      <div className="between">
        <h3>Filter builder</h3>
        <button className="btn ghost btn-sm" onClick={clear}>Clear</button>
      </div>

      <div className="col-flex" style={{ gap: 6, border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: 8 }}>
        <div className="xs muted fw-semi">Result</div>
        <div className="small" style={{ lineHeight: 1.5, wordBreak: "break-word" }}>{describeNode(root, ctx)}</div>
      </div>

      <GroupView node={root} depth={0} update={update} remove={remove} filters={filters} tags={tags} />

      <div className="col-flex" style={{ gap: 6, borderTop: "1px solid var(--line)", paddingTop: 8 }}>
        <div className="row-flex gap-2">
          <input className="input input-sm flex-fill" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Name this filter…" />
          <button className="btn primary btn-sm" disabled={!saveName.trim()} onClick={() => { saveFilter(saveName); setSaveName(""); }}>Save</button>
        </div>
        {savedFilters.length > 0 && (
          <div className="row-flex flex-wrap gap-2">
            {savedFilters.map((f) => (
              <span key={f.name} className="chip chip-soft" style={{ alignItems: "center" }}>
                <button type="button" className="btn ghost btn-sm" style={{ border: 0, padding: 0 }} onClick={() => loadFilter(f.name)} title="Load this filter">{f.name}</button>
                <button type="button" aria-label={`Delete ${f.name}`} onClick={() => deleteFilter(f.name)} style={{ background: "transparent", border: 0, color: "inherit", marginLeft: 6, cursor: "pointer" }}>✕</button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

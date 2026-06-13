import { useMemo, useState } from "react";
import type { Tag, Txn } from "./types";
import type { FilterGroup, FilterNode, FilterRule, FilterRuleField } from "./filterAst";
import { defaultFilterRoot, filterTransactions, newGroup, newRule } from "./filterAst";
import TxnVirtualizedTable from "./TxnVirtualizedTable";

type Props = {
  transactions: Txn[];
  emptyMessage?: string;
  keyPrefix?: string;
  taggingMode?: boolean;
  nettingMode?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  tags?: Tag[];
};

const FIELD_OPTS: { v: FilterRuleField; l: string }[] = [
  { v: "txn_date", l: "Date" },
  { v: "description", l: "Description" },
  { v: "merchant", l: "Merchant" },
  { v: "amount", l: "Amount" },
  { v: "account", l: "Account" },
  { v: "category", l: "Category" },
  { v: "tag_id", l: "Tag" }
];

function opsForField(f: FilterRuleField): { v: string; l: string }[] {
  if (f === "amount") return [{ v: "gt", l: "is greater than" }, { v: "lt", l: "is less than" }, { v: "eq", l: "equals" }];
  if (f === "tag_id") return [{ v: "has", l: "includes" }, { v: "not", l: "does not include" }];
  if (f === "txn_date") {
    return [
      { v: "on_or_after", l: "is on or after" },
      { v: "on_or_before", l: "is on or before" },
      { v: "is_on", l: "is on (calendar day)" },
      { v: "between", l: "is between" }
    ];
  }
  return [{ v: "contains", l: "contains" }, { v: "not_contains", l: "does not contain" }];
}

function patchRuleField(r: FilterRule, f: FilterRuleField): FilterRule {
  const ops = opsForField(f);
  const op = ops.some((o) => o.v === r.op) ? r.op : ops[0].v;
  return { ...r, field: f, op, value: "" };
}

function RuleRow({ rule, tags, onChange, onRemove }: { rule: FilterRule; tags: Tag[]; onChange: (r: FilterRule) => void; onRemove: () => void }) {
  const ops = opsForField(rule.field);
  const isTag = rule.field === "tag_id";
  const isAmt = rule.field === "amount";
  const isDate = rule.field === "txn_date";
  const isBetween = isDate && rule.op === "between";
  const [d0, d1] = rule.value.split("|").map((s) => s.trim());
  return (
    <div className="qb-row">
      <select value={rule.field} onChange={(e) => onChange(patchRuleField(rule, e.target.value as FilterRuleField))}>
        {FIELD_OPTS.map((o) => (
          <option key={o.v} value={o.v}>{o.l}</option>
        ))}
      </select>
      <select
        value={rule.op}
        onChange={(e) => {
          const op = e.target.value;
          let { value } = rule;
          if (isDate) {
            if (op === "between" && !value.includes("|")) value = "|";
            else if (op !== "between" && value.includes("|")) value = value.split("|")[0]?.trim() ?? "";
          }
          onChange({ ...rule, op, value });
        }}
      >
        {ops.map((o) => (
          <option key={o.v} value={o.v}>{o.l}</option>
        ))}
      </select>
      {isTag ? (
        <select value={rule.value} onChange={(e) => onChange({ ...rule, value: e.target.value })}>
          <option value="">— tag —</option>
          {tags.map((t) => (
            <option key={t.id} value={String(t.id)}>{t.name}</option>
          ))}
        </select>
      ) : isBetween ? (
        <span className="row-flex gap-1" style={{ flexWrap: "wrap", alignItems: "center", flex: "1 1 200px" }}>
          <input type="date" value={d0} onChange={(e) => onChange({ ...rule, value: `${e.target.value}|${d1}` })} />
          <span className="muted small">–</span>
          <input type="date" value={d1} onChange={(e) => onChange({ ...rule, value: `${d0}|${e.target.value}` })} />
        </span>
      ) : (
        <input
          type={isAmt ? "number" : isDate ? "date" : "text"}
          placeholder={isAmt ? "0.00" : "value…"}
          value={rule.value}
          onChange={(e) => onChange({ ...rule, value: e.target.value })}
          style={{ flex: "1 1 140px", minWidth: 100 }}
        />
      )}
      <button type="button" className="btn btn-sm danger-ghost" aria-label="Remove condition" onClick={onRemove}>×</button>
    </div>
  );
}

function GroupEditor({
  group,
  depth,
  isRoot,
  tags,
  onChange,
  onRemove
}: {
  group: FilterGroup;
  depth: number;
  isRoot?: boolean;
  tags: Tag[];
  onChange: (g: FilterGroup) => void;
  onRemove?: () => void;
}) {
  const setChild = (i: number, n: FilterNode) => onChange({ ...group, children: group.children.map((c, j) => (j === i ? n : c)) });
  const delChild = (i: number) => onChange({ ...group, children: group.children.filter((_, j) => j !== i) });
  return (
    <div className={depth ? "query-builder-group" : undefined} style={depth ? { marginTop: 4 } : undefined}>
      <div className="row-flex flex-wrap gap-2 mb-2" style={{ alignItems: "center" }}>
        {isRoot && <span className="small" style={{ fontWeight: 650 }}>Filter</span>}
        <select
          className="small"
          value={group.combinator}
          onChange={(e) => onChange({ ...group, combinator: e.target.value as FilterGroup["combinator"] })}
          aria-label={isRoot ? "Match logic" : "Subgroup match logic"}
        >
          <option value="and">All conditions are true</option>
          <option value="or">Any condition is true</option>
        </select>
        {!isRoot && onRemove && (
          <button type="button" className="btn btn-sm danger-ghost" onClick={onRemove}>Remove group</button>
        )}
      </div>
      {group.children.map((child, i) =>
        child.type === "group" ? (
          <GroupEditor
            key={child.id}
            group={child}
            depth={depth + 1}
            tags={tags}
            onChange={(g) => setChild(i, g)}
            onRemove={() => delChild(i)}
          />
        ) : (
          <RuleRow key={child.id} rule={child} tags={tags} onChange={(r) => setChild(i, r)} onRemove={() => delChild(i)} />
        )
      )}
      <div className="row-flex gap-2 mt-2 flex-wrap">
        <button type="button" className="btn btn-sm ghost" onClick={() => onChange({ ...group, children: [...group.children, newRule()] })}>+ Add condition</button>
        <button type="button" className="btn btn-sm ghost" onClick={() => onChange({ ...group, children: [...group.children, newGroup()] })}>+ Add group</button>
      </div>
    </div>
  );
}

function AstFilterPanel({ root, tags, onChange }: { root: FilterGroup; tags: Tag[]; onChange: (g: FilterGroup) => void }) {
  return (
    <div className="query-builder">
      <div className="qb-head">
        <span className="muted small">Nested AND / OR groups (custom AST).</span>
        <button type="button" className="btn btn-sm ghost" onClick={() => onChange(defaultFilterRoot())}>Clear filters</button>
      </div>
      <GroupEditor group={root} depth={0} isRoot tags={tags} onChange={onChange} />
    </div>
  );
}

export default function TransactionTable({ transactions, emptyMessage = "No transactions", keyPrefix = "txn", taggingMode = false, nettingMode = false, selectedIds, onSelectionChange, tags = [] }: Props) {
  const [filterRoot, setFilterRoot] = useState(defaultFilterRoot);
  const filtered = useMemo(() => filterTransactions(transactions, filterRoot), [transactions, filterRoot]);
  const filterActive = filterRoot.children.length > 0;
  const noneMatch = filterActive && !filtered.length;

  if (!transactions.length) return <div className="muted">{emptyMessage}</div>;

  return (
    <TxnVirtualizedTable
      transactions={filtered}
      sourceTotal={transactions.length}
      emptyMessage={emptyMessage}
      keyPrefix={keyPrefix}
      taggingMode={taggingMode}
      nettingMode={nettingMode}
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      tags={tags}
      header={<AstFilterPanel root={filterRoot} tags={tags} onChange={setFilterRoot} />}
      noneMatchHint={noneMatch ? <p className="muted small mb-2">No transactions match the current filter.</p> : undefined}
    />
  );
}

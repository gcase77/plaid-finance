import { useMemo, useState } from "react";
import { QueryBuilder } from "react-querybuilder";
import type { Field, RuleGroupType } from "react-querybuilder";
import "react-querybuilder/dist/query-builder.css";
import type { Tag, Txn } from "./types";
import TxnVirtualizedTable from "./TxnVirtualizedTable";
import { filterTxnsByRqbQuery } from "./rqbTxnEval";

const textOps = [
  { name: "contains", label: "contains" },
  { name: "doesNotContain", label: "does not contain" }
];
const numOps = [
  { name: ">", label: ">" },
  { name: "<", label: "<" },
  { name: "=", label: "=" }
];
const dateOps = [
  { name: ">=", label: "on or after" },
  { name: "<=", label: "on or before" },
  { name: "onDay", label: "on calendar day" },
  { name: "between", label: "between (comma-separated)" }
];

function txnFields(tags: Tag[]): Field[] {
  const tagValues = tags.map((t) => ({ name: String(t.id), label: t.name }));
  return [
    { name: "txn_date", label: "Date", inputType: "date", operators: dateOps, defaultOperator: ">=" },
    { name: "description", label: "Description", operators: textOps },
    { name: "merchant", label: "Merchant", operators: textOps },
    { name: "amount", label: "Amount", inputType: "number", operators: numOps, defaultOperator: ">" },
    { name: "account", label: "Account", operators: textOps },
    { name: "category", label: "Category", operators: textOps },
    {
      name: "tag_id",
      label: "Tag",
      valueEditorType: "select",
      values: tagValues,
      operators: [
        { name: "=", label: "includes" },
        { name: "!=", label: "does not include" }
      ],
      defaultOperator: "="
    }
  ];
}

const initialQuery: RuleGroupType = { combinator: "and", rules: [] };

const rqbTranslations = {
  addRule: { label: "+ Add condition", title: "Add condition" },
  removeRule: { label: "⨯", title: "Remove condition" },
  cloneRule: { label: "⧉", title: "Clone condition" },
  lockRule: { label: "🔓", title: "Lock condition" },
  lockRuleDisabled: { label: "🔒", title: "Unlock condition" },
  muteRule: { label: "🔊", title: "Mute condition" },
  unmuteRule: { label: "🔇", title: "Unmute condition" }
} as const;

export default function RqbTransactionTab({ transactions, tags = [] }: { transactions: Txn[]; tags?: Tag[] }) {
  const [query, setQuery] = useState<RuleGroupType>(initialQuery);
  const fields = useMemo(() => txnFields(tags), [tags]);
  const filtered = useMemo(() => filterTxnsByRqbQuery(transactions, query), [transactions, query]);
  const filterActive = query.rules.length > 0;
  const noneMatch = filterActive && !filtered.length;

  if (!transactions.length) return <div className="muted">No transactions</div>;

  return (
    <TxnVirtualizedTable
      transactions={filtered}
      sourceTotal={transactions.length}
      tags={tags}
      header={(
        <div className="query-builder rqb-panel mb-3">
          <div className="qb-head">
            <span className="muted small">
              Same fields as the AST tab; tree is <code className="xs">RuleGroupType</code> via{" "}
              <a href="https://react-querybuilder.js.org/" target="_blank" rel="noreferrer">react-querybuilder</a>.
              Date <em>between</em>: <code>YYYY-MM-DD,YYYY-MM-DD</code>.
            </span>
            <button type="button" className="btn btn-sm ghost" disabled={!filterActive} onClick={() => setQuery({ combinator: "and", rules: [] })}>
              Clear filters
            </button>
          </div>
          <QueryBuilder fields={fields} query={query} onQueryChange={setQuery} translations={rqbTranslations} />
        </div>
      )}
      noneMatchHint={noneMatch ? <p className="muted small mb-2">No transactions match the current filter.</p> : undefined}
    />
  );
}

import type { MissingTagFilter, TagStateFilter, TextMode, Txn } from "../components/types";
import { getTxnDateOnly } from "./transactionUtils";

export type FilterOp = "and" | "or";

export type Condition =
  | { kind: "name"; mode: TextMode; value: string }
  | { kind: "merchant"; mode: TextMode; value: string }
  | { kind: "bank"; ids: string[] }
  | { kind: "account"; ids: string[] }
  | { kind: "category"; values: string[] }
  | { kind: "amount"; min: string; max: string }
  | { kind: "date"; start: string; end: string }
  | { kind: "tagState"; value: TagStateFilter }
  | { kind: "missingTag"; value: MissingTagFilter }
  | { kind: "tags"; ids: number[] };

export type ConditionKind = Condition["kind"];

export type ConditionNode = { id: string; type: "condition"; condition: Condition };
export type GroupNode = { id: string; type: "group"; op: FilterOp; negate: boolean; children: FilterNode[] };
export type FilterNode = GroupNode | ConditionNode;

let idCounter = 0;
export const newNodeId = () => `fn_${Date.now().toString(36)}_${(idCounter += 1).toString(36)}`;

export const CONDITION_KINDS: ConditionKind[] = [
  "tags", "tagState", "missingTag", "name", "merchant", "category", "bank", "account", "amount", "date"
];

export const CONDITION_LABELS: Record<ConditionKind, string> = {
  name: "Name",
  merchant: "Merchant",
  bank: "Bank",
  account: "Account",
  category: "Detected category",
  amount: "Amount",
  date: "Date range",
  tagState: "Tag state",
  missingTag: "Missing tag",
  tags: "Tags"
};

export const emptyCondition = (kind: ConditionKind): Condition => {
  switch (kind) {
    case "name": return { kind, mode: "contains", value: "" };
    case "merchant": return { kind, mode: "contains", value: "" };
    case "bank": return { kind, ids: [] };
    case "account": return { kind, ids: [] };
    case "category": return { kind, values: [] };
    case "amount": return { kind, min: "", max: "" };
    case "date": return { kind, start: "", end: "" };
    case "tagState": return { kind, value: "untagged" };
    case "missingTag": return { kind, value: "no_meta" };
    case "tags": return { kind, ids: [] };
  }
};

export const conditionNode = (condition: Condition): ConditionNode => ({ id: newNodeId(), type: "condition", condition });
export const emptyGroup = (op: FilterOp = "and"): GroupNode => ({ id: newNodeId(), type: "group", op, negate: false, children: [] });

/** An "active" condition actually constrains the result set. Inactive ones are treated as no-ops. */
export const isConditionActive = (c: Condition): boolean => {
  switch (c.kind) {
    case "name": return c.value.trim() !== "";
    case "merchant": return c.mode === "null" || c.value.trim() !== "";
    case "bank": return c.ids.length > 0;
    case "account": return c.ids.length > 0;
    case "category": return c.values.length > 0;
    case "amount": return c.min.trim() !== "" || c.max.trim() !== "";
    case "date": return c.start !== "" || c.end !== "";
    case "tagState": return c.value !== "all";
    case "missingTag": return c.value !== "all";
    case "tags": return c.ids.length > 0;
  }
};

const txnHasAnyTag = (t: Txn) =>
  t.account_transfer_group != null || t.bucket_1_tag_id != null || t.bucket_2_tag_id != null || (t.meta_tag_ids?.length ?? 0) > 0;

const matchesTags = (t: Txn, ids: number[]) =>
  ids.includes(t.bucket_1_tag_id ?? -1) || ids.includes(t.bucket_2_tag_id ?? -1) || (t.meta_tag_ids?.some((id) => ids.includes(id)) ?? false);

/** Compile a single condition into a predicate. Inactive conditions are no-ops (always true). */
export const compileCondition = (c: Condition): ((t: Txn) => boolean) => {
  if (!isConditionActive(c)) return () => true;
  switch (c.kind) {
    case "name": {
      const q = c.value.toLowerCase().trim();
      return (t) => c.mode === "not" ? !(t.name || "").toLowerCase().includes(q) : (t.name || "").toLowerCase().includes(q);
    }
    case "merchant": {
      if (c.mode === "null") return (t) => !t.merchant_name;
      const q = c.value.toLowerCase().trim();
      return (t) => c.mode === "not" ? !(t.merchant_name || "").toLowerCase().includes(q) : (t.merchant_name || "").toLowerCase().includes(q);
    }
    case "bank": return (t) => c.ids.includes(String(t.item_id || ""));
    case "account": return (t) => c.ids.includes(String(t.account_id || ""));
    case "category": return (t) => c.values.includes(t.personal_finance_category?.detailed || t.personal_finance_category?.primary || "");
    case "amount": {
      const minVal = c.min.trim() ? Number(c.min) : null;
      const maxVal = c.max.trim() ? Number(c.max) : null;
      return (t) => {
        const amt = Number(t.amount || 0);
        if (minVal !== null && Number.isFinite(minVal) && amt < minVal) return false;
        if (maxVal !== null && Number.isFinite(maxVal) && amt > maxVal) return false;
        return true;
      };
    }
    case "date": {
      const lo = c.start ? new Date(`${c.start}T00:00:00`) : null;
      const hi = c.end ? new Date(`${c.end}T23:59:59`) : null;
      return (t) => {
        const rawDate = getTxnDateOnly(t);
        if (!rawDate) return false;
        const d = new Date(`${rawDate}T00:00:00`);
        if (Number.isNaN(d.valueOf())) return false;
        if (lo && d < lo) return false;
        if (hi && d > hi) return false;
        return true;
      };
    }
    case "tagState": return (t) => c.value === "untagged" ? !txnHasAnyTag(t) : txnHasAnyTag(t);
    case "missingTag": {
      return (t) => {
        const hasBucketTag = t.bucket_1_tag_id != null || t.bucket_2_tag_id != null;
        if (c.value === "no_meta") return (t.meta_tag_ids?.length ?? 0) === 0;
        if (c.value === "no_income") return Number(t.amount || 0) < 0 && !hasBucketTag;
        if (c.value === "no_spending") return Number(t.amount || 0) > 0 && !hasBucketTag;
        return true;
      };
    }
    case "tags": return (t) => matchesTags(t, c.ids);
  }
};

/** Compile any node (group or condition) into a single predicate. Empty groups are no-ops. */
export const compileNode = (node: FilterNode): ((t: Txn) => boolean) => {
  if (node.type === "condition") return compileCondition(node.condition);
  const preds = node.children.map(compileNode);
  if (!preds.length) return () => true;
  const base = node.op === "or" ? (t: Txn) => preds.some((p) => p(t)) : (t: Txn) => preds.every((p) => p(t));
  return node.negate ? (t: Txn) => !base(t) : base;
};

export const applyFilterTree = (root: FilterNode, transactions: Txn[]): Txn[] => {
  const pred = compileNode(root);
  return transactions.filter(pred);
};

/** Count of active (constraining) conditions in a subtree. */
export const countActiveConditions = (node: FilterNode): number => {
  if (node.type === "condition") return isConditionActive(node.condition) ? 1 : 0;
  return node.children.reduce((sum, child) => sum + countActiveConditions(child), 0);
};

// --- Immutable tree edits (used by the query builder) ---

/** Return a copy of the tree with the node `id` replaced by `updater(node)`. */
export const updateNode = (node: FilterNode, id: string, updater: (n: FilterNode) => FilterNode): FilterNode => {
  if (node.id === id) return updater(node);
  if (node.type === "group") {
    return { ...node, children: node.children.map((child) => updateNode(child, id, updater)) };
  }
  return node;
};

/** Return a copy of the tree with the node `id` removed (no-op for the root). */
export const removeNode = (node: FilterNode, id: string): FilterNode => {
  if (node.type !== "group") return node;
  return {
    ...node,
    children: node.children.filter((child) => child.id !== id).map((child) => removeNode(child, id))
  };
};

/** Deep-clone a subtree assigning fresh ids (used when loading a saved filter). */
export const cloneWithNewIds = (node: FilterNode): FilterNode => {
  if (node.type === "condition") return { id: newNodeId(), type: "condition", condition: { ...node.condition } };
  return { id: newNodeId(), type: "group", op: node.op, negate: node.negate, children: node.children.map(cloneWithNewIds) };
};

export type LabelCtx = {
  tagName: (id: number) => string;
  bankLabel: (id: string) => string;
  accountLabel: (id: string) => string;
  categoryLabel: (value: string) => string;
};

const list = (items: string[], max = 2): string => {
  if (items.length <= max) return items.join(", ");
  return `${items.slice(0, max).join(", ")} +${items.length - max}`;
};

const TAG_STATE_TEXT: Record<TagStateFilter, string> = { all: "any", untagged: "is untagged", tagged: "is tagged" };
const MISSING_TAG_TEXT: Record<MissingTagFilter, string> = { all: "any", no_meta: "missing meta tag", no_income: "missing income tag", no_spending: "missing spending tag" };

/** A short human-readable description of a single condition, e.g. `Tags: hi, spend`. */
export const describeCondition = (c: Condition, ctx: LabelCtx): string => {
  switch (c.kind) {
    case "name": return c.value.trim() ? `Name ${c.mode === "not" ? "≠" : "∋"} "${c.value.trim()}"` : "Name: any";
    case "merchant": return c.mode === "null" ? "Merchant unspecified" : c.value.trim() ? `Merchant ${c.mode === "not" ? "≠" : "∋"} "${c.value.trim()}"` : "Merchant: any";
    case "bank": return `Bank: ${c.ids.length ? list(c.ids.map(ctx.bankLabel)) : "any"}`;
    case "account": return `Account: ${c.ids.length ? list(c.ids.map(ctx.accountLabel)) : "any"}`;
    case "category": return `Detected: ${c.values.length ? list(c.values.map(ctx.categoryLabel)) : "any"}`;
    case "amount": {
      const lo = c.min.trim();
      const hi = c.max.trim();
      if (lo && hi) return `Amount ${lo}–${hi}`;
      if (lo) return `Amount ≥ ${lo}`;
      if (hi) return `Amount ≤ ${hi}`;
      return "Amount: any";
    }
    case "date": {
      if (c.start && c.end) return `Date ${c.start} → ${c.end}`;
      if (c.start) return `Date from ${c.start}`;
      if (c.end) return `Date until ${c.end}`;
      return "Date: any";
    }
    case "tagState": return `Tag state: ${TAG_STATE_TEXT[c.value]}`;
    case "missingTag": return MISSING_TAG_TEXT[c.value];
    case "tags": return `Tags: ${c.ids.length ? list(c.ids.map(ctx.tagName)) : "any"}`;
  }
};

/** A parenthesized boolean expression describing a node, e.g. `(Tags: hi) OR (Tags: spend AND Date ...)`. */
export const describeNode = (node: FilterNode, ctx: LabelCtx): string => {
  if (node.type === "condition") return describeCondition(node.condition, ctx);
  const active = node.children.filter((child) => child.type === "group" || isConditionActive(child.condition));
  if (!active.length) return "anything";
  const sep = node.op === "or" ? " OR " : " AND ";
  const inner = active.map((child) => {
    const text = describeNode(child, ctx);
    return child.type === "group" ? `(${text})` : text;
  }).join(sep);
  return node.negate ? `NOT (${inner})` : inner;
};

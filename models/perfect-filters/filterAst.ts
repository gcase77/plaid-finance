import type { Txn } from "./types";

export type FilterCombinator = "and" | "or";

export type FilterRuleField = "description" | "merchant" | "account" | "category" | "amount" | "tag_id" | "txn_date";

export type FilterRule = {
  id: string;
  type: "rule";
  field: FilterRuleField;
  op: string;
  value: string;
};

export type FilterGroup = {
  id: string;
  type: "group";
  combinator: FilterCombinator;
  children: FilterNode[];
};

export type FilterNode = FilterGroup | FilterRule;

export const newId = () => `f_${Math.random().toString(36).slice(2, 11)}`;

export function defaultFilterRoot(): FilterGroup {
  return { id: newId(), type: "group", combinator: "and", children: [] };
}

export function newRule(over?: Partial<Omit<FilterRule, "id" | "type">>): FilterRule {
  return { id: newId(), type: "rule", field: "description", op: "contains", value: "", ...over };
}

export function newGroup(): FilterGroup {
  return { id: newId(), type: "group", combinator: "and", children: [newRule()] };
}

function txnTagIds(t: Txn): number[] {
  const out: number[] = [];
  if (t.bucket_1_tag_id != null) out.push(t.bucket_1_tag_id);
  if (t.bucket_2_tag_id != null) out.push(t.bucket_2_tag_id);
  (t.meta_tag_ids ?? []).forEach((id) => out.push(id));
  return out;
}

function txnMs(t: Txn): number | null {
  const raw = t.datetime ?? t.authorized_datetime;
  if (raw == null || raw === "") return null;
  const ms = new Date(raw).valueOf();
  return Number.isNaN(ms) ? null : ms;
}

function parseYmd(s: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  return [+m[1], +m[2], +m[3]];
}

function localDayStartMs(ymd: string): number | null {
  const p = parseYmd(ymd);
  if (!p) return null;
  const [y, mo, d] = p;
  return new Date(y, mo - 1, d, 0, 0, 0, 0).getTime();
}

function localDayEndMs(ymd: string): number | null {
  const p = parseYmd(ymd);
  if (!p) return null;
  const [y, mo, d] = p;
  return new Date(y, mo - 1, d, 23, 59, 59, 999).getTime();
}

function strField(t: Txn, f: FilterRuleField): string {
  switch (f) {
    case "description":
      return `${(t.original_description || "").trim() || t.name || ""}`.toLowerCase();
    case "merchant":
      return `${t.merchant_name || ""}`.toLowerCase();
    case "account":
      return `${t.institution_name || ""} ${t.account_name || t.account_official_name || ""}`.toLowerCase();
    case "category":
      return `${t.personal_finance_category?.primary || ""} ${t.personal_finance_category?.detailed || ""}`.toLowerCase();
    case "txn_date":
      return "";
    default:
      return "";
  }
}

function evalRule(t: Txn, r: FilterRule): boolean {
  if (r.field === "amount") {
    if (!r.value.trim()) return true;
    const v = Number(r.value);
    if (Number.isNaN(v)) return false;
    const a = t.amount ?? 0;
    if (r.op === "gt") return a > v;
    if (r.op === "lt") return a < v;
    if (r.op === "eq") return a === v;
    return true;
  }
  if (r.field === "tag_id") {
    const id = parseInt(r.value, 10);
    if (Number.isNaN(id)) return true;
    const has = txnTagIds(t).includes(id);
    if (r.op === "has") return has;
    if (r.op === "not") return !has;
    return true;
  }
  if (r.field === "txn_date") {
    const ts = txnMs(t);
    if (ts == null) return false;
    if (r.op === "between") {
      const [a, b] = r.value.split("|").map((s) => s.trim());
      if (!a || !b) return true;
      const sa = localDayStartMs(a);
      const ea = localDayEndMs(a);
      const sb = localDayStartMs(b);
      const eb = localDayEndMs(b);
      if (sa == null || ea == null || sb == null || eb == null) return true;
      const lo = Math.min(sa, sb);
      const hi = Math.max(ea, eb);
      return ts >= lo && ts <= hi;
    }
    if (!r.value.trim()) return true;
    const start = localDayStartMs(r.value);
    const end = localDayEndMs(r.value);
    if (start == null || end == null) return true;
    if (r.op === "on_or_after") return ts >= start;
    if (r.op === "on_or_before") return ts <= end;
    if (r.op === "is_on") return ts >= start && ts <= end;
    return true;
  }
  if (!r.value.trim()) return true;
  const hay = strField(t, r.field);
  const needle = r.value.toLowerCase();
  if (r.op === "contains") return hay.includes(needle);
  if (r.op === "not_contains") return !hay.includes(needle);
  return true;
}

/** Empty AND → true; empty OR → false (unused branch). */
export function evalFilterGroup(t: Txn, g: FilterGroup): boolean {
  if (!g.children.length) return g.combinator === "and";
  const bits = g.children.map((n) => (n.type === "group" ? evalFilterGroup(t, n) : evalRule(t, n)));
  return g.combinator === "and" ? bits.every(Boolean) : bits.some(Boolean);
}

export function filterTransactions(txns: Txn[], root: FilterGroup): Txn[] {
  if (!root.children.length) return txns;
  return txns.filter((t) => evalFilterGroup(t, root));
}

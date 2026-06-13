import type { RuleGroupType, RuleType } from "react-querybuilder";
import type { Txn } from "./types";

function isRuleGroup(n: RuleType | RuleGroupType): n is RuleGroupType {
  return typeof n === "object" && n != null && "rules" in n && Array.isArray((n as RuleGroupType).rules);
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

function str(t: Txn, f: string): string {
  switch (f) {
    case "description":
      return `${(t.original_description || "").trim() || t.name || ""}`.toLowerCase();
    case "merchant":
      return `${t.merchant_name || ""}`.toLowerCase();
    case "account":
      return `${t.institution_name || ""} ${t.account_name || t.account_official_name || ""}`.toLowerCase();
    case "category":
      return `${t.personal_finance_category?.primary || ""} ${t.personal_finance_category?.detailed || ""}`.toLowerCase();
    default:
      return "";
  }
}

function txnTagIds(t: Txn): number[] {
  const out: number[] = [];
  if (t.bucket_1_tag_id != null) out.push(t.bucket_1_tag_id);
  if (t.bucket_2_tag_id != null) out.push(t.bucket_2_tag_id);
  (t.meta_tag_ids ?? []).forEach((id) => out.push(id));
  return out;
}

function normVal(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map((x) => String(x)).join(",");
  return String(v);
}

function parseBetween(val: string): [string, string] | null {
  const parts = val.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) return [parts[0], parts[1]];
  return null;
}

function evalLeaf(t: Txn, r: RuleType): boolean {
  const field = r.field;
  const op = r.operator;
  const val = normVal(r.value);
  if (field === "amount") {
    if (!val.trim()) return true;
    const n = Number(val);
    if (Number.isNaN(n)) return false;
    const a = t.amount ?? 0;
    if (op === ">") return a > n;
    if (op === "<") return a < n;
    if (op === "=") return a === n;
    return true;
  }
  if (field === "txn_date") {
    const ts = txnMs(t);
    if (ts == null) return false;
    if (op === "between") {
      const pair = parseBetween(val);
      if (!pair) return true;
      const [a, b] = pair;
      const sa = localDayStartMs(a);
      const ea = localDayEndMs(a);
      const sb = localDayStartMs(b);
      const eb = localDayEndMs(b);
      if (sa == null || ea == null || sb == null || eb == null) return true;
      const lo = Math.min(sa, sb);
      const hi = Math.max(ea, eb);
      return ts >= lo && ts <= hi;
    }
    if (!val.trim()) return true;
    const start = localDayStartMs(val);
    const end = localDayEndMs(val);
    if (start == null || end == null) return true;
    if (op === ">=") return ts >= start;
    if (op === "<=") return ts <= end;
    if (op === "onDay") return ts >= start && ts <= end;
    return true;
  }
  if (field === "tag_id") {
    const id = parseInt(val, 10);
    if (Number.isNaN(id)) return true;
    const has = txnTagIds(t).includes(id);
    if (op === "=") return has;
    if (op === "!=") return !has;
    return true;
  }
  if (!val.trim()) return true;
  const hay = str(t, field);
  const needle = val.toLowerCase();
  if (op === "contains") return hay.includes(needle);
  if (op === "doesNotContain") return !hay.includes(needle);
  return true;
}

function evalGroup(t: Txn, g: RuleGroupType): boolean {
  if (!g.rules.length) return true;
  const bits = g.rules.map((n) => (isRuleGroup(n) ? evalGroup(t, n) : evalLeaf(t, n)));
  let ok = g.combinator === "or" ? bits.some(Boolean) : bits.every(Boolean);
  if (g.not) ok = !ok;
  return ok;
}

export function filterTxnsByRqbQuery(txns: Txn[], q: RuleGroupType): Txn[] {
  if (!q.rules.length) return txns;
  return txns.filter((t) => evalGroup(t, q));
}

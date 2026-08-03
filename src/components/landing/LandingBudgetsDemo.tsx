import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { BudgetRuleCacheEntry, Tag, Txn } from "../types";
import { getDisplayTagColor, getTextColorForBackground } from "../../utils/transactionUtils";
import demo from "./landingDemo.json";
import LandingAccountsDemo from "./LandingAccountsDemo";

type DemoTxn = Omit<Txn, "datetime" | "authorized_datetime"> & {
  days_ago: number;
  authorized_days_ago?: number | null;
  account_transfer_group?: number | null;
  netting_group?: string | null;
  bucket_1_tag_id?: number | null;
  bucket_2_tag_id?: number | null;
  meta_tag_ids?: number[];
};

const { tags, transactions: rawTxns } = demo as { tags: Tag[]; transactions: DemoTxn[] };
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ON_BUDGET_EPS = 0.01;
const RULES: { name: string; tagId: number; amount: number }[] = [
  { name: "$80 on restaurants", tagId: 4, amount: 80 },
  { name: "$300 on travel", tagId: 6, amount: 300 },
];

function daysAgoToIso(daysAgo: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function shortDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!m || m < 1 || m > 12) return iso;
  const cur = new Date().getFullYear();
  return `${MONTH_SHORT[m - 1]} ${d}${y && y !== cur ? ` '${String(y).slice(-2)}` : ""}`;
}
function money(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function budgetDiff(e: BudgetRuleCacheEntry) {
  return (e.effective_budget ?? 0) - e.associated_spend;
}
function statusKey(e: BudgetRuleCacheEntry): "success" | "danger" | "warning" {
  const d = budgetDiff(e);
  return Math.abs(d) < ON_BUDGET_EPS ? "warning" : d >= 0 ? "success" : "danger";
}

function matchesTag(t: DemoTxn, tagId: number) {
  return t.bucket_1_tag_id === tagId || t.bucket_2_tag_id === tagId || (t.meta_tag_ids ?? []).includes(tagId);
}

function earliestStart(txns: DemoTxn[], tagId: number) {
  let maxDays: number | null = null;
  for (const t of txns) {
    if (t.account_transfer_group != null || !matchesTag(t, tagId)) continue;
    if (maxDays == null || t.days_ago > maxDays) maxDays = t.days_ago;
  }
  return maxDays == null ? new Date().toISOString().slice(0, 10) : daysAgoToIso(maxDays).slice(0, 10);
}

function buildMonthlyPeriods(startDateStr: string) {
  const anchor = new Date(`${startDateStr}T00:00:00.000Z`);
  if (Number.isNaN(anchor.valueOf())) return [];
  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  let start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 1, 1));
  let end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  const periods: { start_date: string; end_date: string }[] = [];
  while (start <= todayUTC) {
    periods.push({ start_date: start.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10) });
    if (end >= todayUTC) break;
    start = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  }
  return periods;
}

function buildTagCache(txns: DemoTxn[], tagId: number, flatAmount: number, startDate: string): BudgetRuleCacheEntry[] {
  const periods = buildMonthlyPeriods(startDate);
  const cache = periods.map((p) => ({
    ...p,
    base_budget: null as number | null,
    effective_budget: null as number | null,
    balance: null as number | null,
    associated_spend: 0,
    associated_income: 0,
  }));
  for (const t of txns) {
    if (t.account_transfer_group != null) continue;
    const amount = t.amount ?? 0;
    const iso = daysAgoToIso(t.days_ago).slice(0, 10);
    const idx = periods.findIndex((p) => iso >= p.start_date && iso <= p.end_date);
    if (idx < 0) continue;
    if (amount < 0) cache[idx].associated_income += Math.abs(amount);
    if (matchesTag(t, tagId) && amount > 0) cache[idx].associated_spend += amount;
  }
  for (let i = 1; i < cache.length; i += 1) {
    cache[i].base_budget = flatAmount;
    cache[i].effective_budget = flatAmount;
    cache[i].balance = 0;
  }
  return cache;
}

function TagBadge({ tag }: { tag: Tag }) {
  const color = getDisplayTagColor(tag.type, tag.color);
  return <span className="tag-badge" style={{ background: color, color: getTextColorForBackground(color) }}>{tag.name}</span>;
}

function BudgetBars({ cache }: { cache: BudgetRuleCacheEntry[] }) {
  const periods = cache.slice(1);
  if (!periods.length) return <div className="muted small">No period data yet.</div>;
  const maxVal = Math.max(...periods.map((p) => Math.max(p.effective_budget ?? 0, p.associated_spend)), 1);
  const newest = periods[periods.length - 1];
  const diff = newest ? budgetDiff(newest) : null;

  return (
    <div>
      {diff != null && newest?.effective_budget != null && (
        <p className="muted small mb-2">
          {diff >= 0
            ? `You have ${money(diff)} left to spend before ${shortDate(newest.end_date)}.`
            : `You are ${money(Math.abs(diff))} over budget until ${shortDate(newest.end_date)}.`}
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[...periods].reverse().map((e) => {
          const key = statusKey(e);
          const color = key === "success" ? "var(--success)" : key === "danger" ? "var(--danger)" : "var(--warning)";
          const budget = e.effective_budget ?? 0;
          const spendPct = maxVal ? (e.associated_spend / maxVal) * 100 : 0;
          const budgetPct = budget > 0 ? (budget / maxVal) * 100 : 0;
          const d = budgetDiff(e);
          const label = e.effective_budget == null ? "—" : Math.abs(d) < ON_BUDGET_EPS ? "on budget" : d >= 0 ? `${money(Math.abs(d)).replace("$", "▼ $")} saved` : `${money(Math.abs(d)).replace("$", "▲ $")} over`;
          return (
            <div key={e.end_date} className="row-flex gap-2 small">
              <span className="muted xs text-nowrap" style={{ minWidth: 56 }}>{shortDate(e.end_date)}</span>
              <div className="bar" style={{ flex: 1 }} title={`${money(e.associated_spend)} of ${budget > 0 ? money(budget) : "—"}`}>
                <div style={{ left: 0, width: `${spendPct}%`, background: color, opacity: 0.85, borderRadius: "var(--r-pill)" }} />
                {budget > 0 && <div style={{ left: `${budgetPct}%`, width: 2, top: -2, bottom: -2, background: "var(--ink)", opacity: 0.7 }} />}
              </div>
              <span className={`text-${key} xs text-nowrap`} style={{ minWidth: 88, textAlign: "right" }}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function LandingBudgetsDemo() {
  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), []);
  const rules = useMemo(
    () => RULES.map((r) => {
      const start = earliestStart(rawTxns, r.tagId);
      return { ...r, tag: tagsById.get(r.tagId), cache: buildTagCache(rawTxns, r.tagId, r.amount, start) };
    }),
    [tagsById]
  );

  return (
    <>
      <header className="page-header landing-find-header">
        <h1>Keep your budgets in check</h1>
        <Link to="/auth" className="landing-cta">
          Connect My Bank
          <span className="landing-cta-arrow" aria-hidden>→</span>
        </Link>
      </header>
      <div className="landing-budgets-layout">
        <div className="landing-budgets-rules">
          {rules.map((rule) => (
            <div key={rule.tagId} className="card" style={{ padding: 0 }}>
              <div className="row-flex flex-wrap gap-2" style={{ padding: "var(--s3) var(--s4)" }}>
                <span className="fw-semi">{rule.name}</span>
                {rule.tag && <TagBadge tag={rule.tag} />}
                <span className="chip">{money(rule.amount)} monthly</span>
                <span className="chip">Rollover: None</span>
              </div>
              <div style={{ padding: "0 var(--s4) var(--s3)" }}>
                <BudgetBars cache={rule.cache} />
              </div>
            </div>
          ))}
        </div>
        <div className="landing-budgets-divider" aria-hidden />
        <div className="landing-budgets-accounts">
          <LandingAccountsDemo />
        </div>
      </div>
    </>
  );
}

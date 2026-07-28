import { useMemo, useState } from "react";
import type { BudgetRule, BudgetRuleCacheEntry } from "../../types";
import { TagBadge } from "../../shared/TagBadge";
import { DEMO_BUDGET_RULES, DEMO_TAG_MAP } from "../demoData";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WINDOW_SIZE = 3;
const ON_BUDGET_EPS = 0.01;

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

function ruleAmountLabel(r: Pick<BudgetRule, "type" | "flat_amount" | "percent" | "calendar_window">) {
  const w = r.calendar_window === "month" ? "monthly" : "weekly";
  return r.type === "flat_rate"
    ? `${r.flat_amount == null ? "—" : money(r.flat_amount)} ${w}`
    : `${r.percent ?? "—"}% of income ${w}`;
}

function BudgetBars({ cache }: { cache: BudgetRuleCacheEntry[] }) {
  const periods = useMemo(() => cache.slice(1), [cache]);
  const [start, setStart] = useState(() => Math.max(0, cache.length - 1 - WINDOW_SIZE));
  if (!periods.length) return <div className="muted small">No period data yet.</div>;
  const maxStart = Math.max(0, periods.length - WINDOW_SIZE);
  const safeStart = Math.min(start, maxStart);
  const visible = periods.slice(safeStart, safeStart + WINDOW_SIZE);
  const maxVal = Math.max(...visible.map((p) => Math.max(p.effective_budget ?? 0, p.associated_spend)), 1);
  const newest = periods[periods.length - 1];
  const diff = newest ? budgetDiff(newest) : null;

  return (
    <div>
      <div className="between mb-2 flex-wrap gap-2">
        {diff != null && newest?.effective_budget != null && (
          <p className="muted small" style={{ flex: 1 }}>
            {diff >= 0
              ? `You have ${money(diff)} left to spend before ${shortDate(newest.end_date)}.`
              : `You are ${money(Math.abs(diff))} over budget until ${shortDate(newest.end_date)}.`}
          </p>
        )}
        <div className="row-flex gap-1">
          <button className="btn ghost btn-icon btn-sm" disabled={safeStart + WINDOW_SIZE >= periods.length} onClick={() => setStart((s) => Math.min(periods.length - WINDOW_SIZE, s + WINDOW_SIZE))} aria-label="Newer">▲</button>
          <button className="btn ghost btn-icon btn-sm" disabled={safeStart <= 0} onClick={() => setStart((s) => Math.max(0, s - WINDOW_SIZE))} aria-label="Older">▼</button>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[...visible].reverse().map((e) => {
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

export default function BudgetRulesPreview() {
  return (
    <div className="landing-demo-shell">
      <div className="landing-demo-hint">
        Set flat or percent-of-income budgets by tag, category, or all spending — with rollover tracking.
      </div>
      <div className="col-flex" style={{ gap: 12 }}>
        {DEMO_BUDGET_RULES.map((rule) => {
          const tag = rule.tag_id != null ? DEMO_TAG_MAP.get(rule.tag_id) : undefined;
          return (
            <div key={rule.id} className="card" style={{ padding: 0 }}>
              <div className="row-flex flex-wrap gap-2" style={{ padding: "var(--s3) var(--s4)" }}>
                <span className="fw-semi">{rule.name}</span>
                {tag && <TagBadge tag={tag} />}
                {rule.rule_source_type === "all_spending" && <span className="chip chip-soft">All spending</span>}
                <span className="chip">{ruleAmountLabel(rule)}</span>
                <span className="chip">Rollover: {rule.rollover_options === "none" ? "None" : rule.rollover_options === "surplus" ? "Surplus" : rule.rollover_options === "deficit" ? "Deficit" : "Both"}</span>
              </div>
              <div style={{ padding: "0 var(--s4) var(--s3)" }}>
                <BudgetBars cache={rule.cache ?? []} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

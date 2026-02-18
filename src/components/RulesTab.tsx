import { useState } from "react";
import type { BudgetRule, BudgetRuleStatus, BudgetRuleType, CalendarWindow, RolloverOption, Tag } from "./types";
import type { CreateRuleArgs } from "../hooks/useRules";
import LoadingSpinner from "./shared/LoadingSpinner";

type Props = {
  tags: Tag[];
  rules: BudgetRule[];
  statuses: BudgetRuleStatus[];
  loading: boolean;
  error: string | null;
  createRule: (args: CreateRuleArgs) => Promise<BudgetRule>;
  deleteRule: (id: number) => Promise<void>;
  loadRules: () => Promise<void>;
};

type Step = "bucket" | "type" | "window" | "rollover" | "value";

const ROLLOVER_LABELS: Record<RolloverOption, string> = {
  none: "None",
  surplus: "Surplus",
  deficit: "Deficit",
  both: "Both"
};

const ROLLOVER_DESCRIPTIONS: Record<RolloverOption, string> = {
  none: "Each period starts fresh",
  surplus: "Unused budget carries forward",
  deficit: "Overspending carries forward as debt",
  both: "Both surplus and deficit carry forward"
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function RuleCard({
  rule,
  status,
  onDelete
}: {
  rule: BudgetRule;
  status: BudgetRuleStatus | undefined;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const cp = status?.current_period;
  const pct = cp && cp.effective_budget > 0 ? Math.min(100, (cp.spending / cp.effective_budget) * 100) : 0;
  const over = cp ? cp.spending > cp.effective_budget : false;

  const handleDelete = async () => {
    if (!confirm(`Delete rule "${rule.name}"?`)) return;
    setDeleting(true);
    try { await onDelete(); } finally { setDeleting(false); }
  };

  return (
    <div className="border rounded p-3 mb-3">
      <div className="d-flex justify-content-between align-items-start mb-2">
        <div>
          <span className="fw-semibold">{rule.name}</span>
          <span className="ms-2 text-muted small">{rule.tag.name}</span>
          <span className="ms-2 badge bg-secondary">{rule.tag.type === "spending_bucket_2" ? "Sub-bucket" : "Bucket"}</span>
          <span className="ms-1 badge bg-primary">{rule.calendar_window === "month" ? "Monthly" : "Weekly"}</span>
          {rule.rollover_options !== "none" && (
            <span className="ms-1 badge bg-info text-dark">Rollover: {ROLLOVER_LABELS[rule.rollover_options]}</span>
          )}
        </div>
        <button className="btn btn-outline-danger btn-sm" onClick={handleDelete} disabled={deleting}>
          {deleting ? "..." : "Delete"}
        </button>
      </div>

      <div className="small text-muted mb-1">
        {rule.type === "flat_rate"
          ? `Budget: ${fmt(rule.flat_amount ?? 0)} / ${rule.calendar_window}`
          : `Budget: ${((rule.percent ?? 0) * 100).toFixed(1)}% of prev ${rule.calendar_window}'s income`}
      </div>

      {cp ? (
        <>
          <div className="d-flex justify-content-between small mb-1">
            <span>
              Spent: <strong>{fmt(cp.spending)}</strong>
              {rule.rollover_options !== "none" && status && status.carry !== 0 && (
                <span className={`ms-2 ${status.carry > 0 ? "text-success" : "text-danger"}`}>
                  ({status.carry > 0 ? "+" : ""}{fmt(status.carry)} rollover)
                </span>
              )}
            </span>
            <span>Budget: <strong>{fmt(cp.effective_budget)}</strong></span>
          </div>
          <div className="progress mb-1 position-relative" style={{ height: 10 }}>
            {over && cp.spending > 0 ? (
              <>
                <div className="progress-bar bg-success" style={{ width: `${Math.min(100, Math.max(0, (cp.effective_budget / cp.spending) * 100))}%` }} />
                <div className="progress-bar bg-danger" style={{ width: `${100 - Math.min(100, Math.max(0, (cp.effective_budget / cp.spending) * 100))}%` }} />
                <div
                  className="position-absolute top-0 h-100"
                  style={{
                    left: `${Math.max(0, (cp.effective_budget / cp.spending) * 100)}%`,
                    width: 2,
                    background: "rgba(255,255,255,0.85)",
                    transform: "translateX(-50%)"
                  }}
                />
              </>
            ) : (
              <div className={`progress-bar ${pct > 85 ? "bg-warning" : "bg-success"}`} style={{ width: `${pct}%` }} />
            )}
          </div>
          <div className={`small ${over ? "text-danger fw-semibold" : "text-muted"}`}>
            {over ? `Over by ${fmt(Math.abs(cp.remaining))}` : `${fmt(cp.remaining)} remaining`}
          </div>

          {(rule.rollover_options !== "none" || rule.type === "percent_of_income") && status && status.period_history.length > 1 && (
            <button className="btn btn-link btn-sm p-0 mt-1" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Hide history" : "Show history"}
            </button>
          )}

          {expanded && status && (
            <div className="mt-2 border-top pt-2">
              <div className="small fw-semibold mb-1">Period History</div>
              <table className="table table-sm table-borderless mb-0 small">
                <thead>
                  <tr>
                    <th>Period</th>
                    {rule.type === "percent_of_income" && <th className="text-end">Income</th>}
                    <th className="text-end">Budget</th>
                    <th className="text-end">Spent</th>
                    <th className="text-end">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {status.period_history.slice(0, -1).map((p, i) => (
                    <tr key={i}>
                      <td>{new Date(new Date(p.end).getTime() - 86400000).toLocaleDateString('en-US', { timeZone: 'UTC' })}</td>
                      {rule.type === "percent_of_income" && <td className="text-end">{p.income != null ? fmt(p.income) : "—"}</td>}
                      <td className="text-end">{fmt(p.budget)}</td>
                      <td className="text-end">{fmt(p.spending)}</td>
                      <td className={`text-end ${p.delta >= 0 ? "text-success" : "text-danger"}`}>
                        {p.delta >= 0 ? "+" : ""}{fmt(p.delta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="text-muted small">No data yet</div>
      )}
    </div>
  );
}

function CreateRuleForm({
  tags,
  onCreate,
  onCancel
}: {
  tags: Tag[];
  onCreate: (args: CreateRuleArgs) => Promise<void>;
  onCancel: () => void;
}) {
  const spendingTags = tags.filter((t) => t.type === "spending_bucket_1" || t.type === "spending_bucket_2");

  const [step, setStep] = useState<Step>("bucket");
  const [ruleName, setRuleName] = useState("");
  const [tagId, setTagId] = useState<number | null>(null);
  const [ruleType, setRuleType] = useState<BudgetRuleType>("flat_rate");
  const [window, setWindow] = useState<CalendarWindow>("month");
  const [rollover, setRollover] = useState<RolloverOption>("none");
  const [flatAmount, setFlatAmount] = useState("");
  const [percent, setPercent] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [useEarliest, setUseEarliest] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const selectedTag = spendingTags.find((t) => t.id === tagId);

  const handleSubmit = async () => {
    setSubmitError("");
    setSubmitting(true);
    try {
      const args: CreateRuleArgs = {
        tag_id: tagId!,
        name: ruleName.trim(),
        type: ruleType,
        calendar_window: window,
        rollover_options: rollover,
        ...(ruleType === "flat_rate" ? { flat_amount: Number(flatAmount) } : { percent: Number(percent) / 100 }),
        ...(useEarliest ? { use_earliest_transaction: true } : { start_date: startDate })
      };
      await onCreate(args);
    } catch (e: any) {
      setSubmitError(e.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="border rounded p-3 mb-3 bg-light">
      <h6 className="mb-3">New Budget Rule</h6>

      {/* Name */}
      <div className="mb-3">
        <label className="form-label small fw-semibold">Name</label>
        <input
          className="form-control form-control-sm"
          placeholder="e.g. Dining out, Subscriptions"
          value={ruleName}
          onChange={(e) => setRuleName(e.target.value)}
        />
      </div>

      {/* Step: Bucket */}
      <div className="mb-3">
        <label className="form-label small fw-semibold">1. Spending Bucket</label>
        {spendingTags.length === 0 ? (
          <div className="text-muted small">No spending buckets found. Create some in the Buckets tab first.</div>
        ) : (
          <select
            className="form-select form-select-sm"
            value={tagId ?? ""}
            onChange={(e) => { setTagId(Number(e.target.value)); setStep("type"); }}
          >
            <option value="">Select a bucket...</option>
            {spendingTags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.type === "spending_bucket_2" ? "Sub-bucket" : "Bucket"})
              </option>
            ))}
          </select>
        )}
      </div>

      {tagId != null && (
        <>
          {/* Step: Type */}
          <div className="mb-3">
            <label className="form-label small fw-semibold">2. Budget Type</label>
            <div className="btn-group w-100">
              <button
                className={`btn btn-sm ${ruleType === "flat_rate" ? "btn-primary" : "btn-outline-primary"}`}
                onClick={() => { setRuleType("flat_rate"); setStep("window"); }}
              >
                Flat Amount
              </button>
              <button
                className={`btn btn-sm ${ruleType === "percent_of_income" ? "btn-primary" : "btn-outline-primary"}`}
                onClick={() => { setRuleType("percent_of_income"); setStep("window"); }}
              >
                % of Income
              </button>
            </div>
          </div>

          {/* Step: Window */}
          <div className="mb-3">
            <label className="form-label small fw-semibold">3. Calendar Window</label>
            <div className="btn-group w-100">
              <button
                className={`btn btn-sm ${window === "month" ? "btn-primary" : "btn-outline-primary"}`}
                onClick={() => { setWindow("month"); setStep("rollover"); }}
              >
                Monthly
              </button>
              <button
                className={`btn btn-sm ${window === "week" ? "btn-primary" : "btn-outline-primary"}`}
                onClick={() => { setWindow("week"); setStep("rollover"); }}
              >
                Weekly
              </button>
            </div>
          </div>

          {/* Step: Rollover */}
          <div className="mb-3">
            <label className="form-label small fw-semibold">4. Rollover</label>
            <div className="row g-2">
              {(["none", "surplus", "deficit", "both"] as RolloverOption[]).map((opt) => (
                <div className="col-6" key={opt}>
                  <button
                    className={`btn btn-sm w-100 ${rollover === opt ? "btn-primary" : "btn-outline-secondary"}`}
                    onClick={() => { setRollover(opt); setStep("value"); }}
                  >
                    {ROLLOVER_LABELS[opt]}
                  </button>
                  <div className="text-muted" style={{ fontSize: "0.7rem" }}>{ROLLOVER_DESCRIPTIONS[opt]}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Step: Value + Start Date */}
          <div className="mb-3">
            <label className="form-label small fw-semibold">
              5. {ruleType === "flat_rate" ? "Budget Amount" : "Percent of Previous Period Income"}
            </label>
            <div className="input-group input-group-sm mb-2">
              {ruleType === "flat_rate" && <span className="input-group-text">$</span>}
              <input
                className="form-control form-control-sm"
                type="number"
                min="0"
                step={ruleType === "flat_rate" ? "0.01" : "0.1"}
                value={ruleType === "flat_rate" ? flatAmount : percent}
                onChange={(e) => ruleType === "flat_rate" ? setFlatAmount(e.target.value) : setPercent(e.target.value)}
                placeholder={ruleType === "flat_rate" ? "e.g. 500" : "e.g. 15"}
              />
              {ruleType === "percent_of_income" && <span className="input-group-text">%</span>}
            </div>

            <label className="form-label small fw-semibold">Start Date</label>
            <div className="d-flex gap-2 align-items-center">
              <input
                type="date"
                className="form-control form-control-sm"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setUseEarliest(false); }}
                disabled={useEarliest}
              />
            </div>
            <div className="form-check mt-1">
              <input
                id="use-earliest"
                type="checkbox"
                className="form-check-input"
                checked={useEarliest}
                onChange={(e) => setUseEarliest(e.target.checked)}
              />
              <label htmlFor="use-earliest" className="form-check-label small">
                Use earliest transaction in "{selectedTag?.name}"
              </label>
            </div>
          </div>

          {submitError && <div className="alert alert-danger py-2 small">{submitError}</div>}

          <div className="d-flex gap-2">
            <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={submitting || !ruleName.trim() || (!flatAmount && !percent) || (tagId == null)}>
              {submitting ? "Creating..." : "Create Rule"}
            </button>
            <button className="btn btn-outline-secondary btn-sm" onClick={onCancel}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function RulesTab({ tags, rules, statuses, loading, error, createRule, deleteRule, loadRules }: Props) {
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleCreate = async (args: CreateRuleArgs) => {
    await createRule(args);
    setCreating(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await loadRules(); } finally { setRefreshing(false); }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="mb-0">Budget Rules</h6>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary btn-sm" onClick={handleRefresh} disabled={refreshing || loading}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          {!creating && (
            <button className="btn btn-outline-primary btn-sm" onClick={() => setCreating(true)}>+ New Rule</button>
          )}
        </div>
      </div>

      {creating && (
        <CreateRuleForm tags={tags} onCreate={handleCreate} onCancel={() => setCreating(false)} />
      )}

      {loading ? (
        <LoadingSpinner message="Loading rules..." />
      ) : error ? (
        <div className="alert alert-danger py-2 small">{error}</div>
      ) : rules.length === 0 ? (
        <div className="text-muted small">No budget rules yet. Create one to get started.</div>
      ) : (
        rules.map((rule) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            status={statuses.find((s) => s.rule_id === rule.id)}
            onDelete={() => deleteRule(rule.id)}
          />
        ))
      )}
    </div>
  );
}

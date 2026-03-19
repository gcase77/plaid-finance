import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buildAuthHeaders } from "../../lib/auth";
import {
  formatCategoryLabel,
  formatTxnDetectedCategory,
  getDisplayTagColor,
  getTextColorForBackground,
  normalizeDetectedCategoryValue
} from "../../utils/transactionUtils";
import type {
  BudgetRule,
  BudgetRuleCacheEntry,
  BudgetRuleSourceType,
  BudgetRuleType,
  CalendarWindow,
  RolloverOption,
  Tag,
  TransactionBaseRow,
  TransactionMetaRow
} from "../types";
import LoadingSpinner from "../shared/LoadingSpinner";

type Props = { token: string | null };

type FormState = {
  name: string;
  rule_source_type: BudgetRuleSourceType;
  tag_id: string;
  detected_category: string;
  start_date: string;
  type: BudgetRuleType;
  flat_amount: string;
  percent: string;
  calendar_window: CalendarWindow;
  rollover_options: RolloverOption;
};

const BLANK: FormState = {
  name: "",
  rule_source_type: "tag",
  tag_id: "",
  detected_category: "",
  start_date: new Date().toISOString().slice(0, 10),
  type: "flat_rate",
  flat_amount: "",
  percent: "",
  calendar_window: "month",
  rollover_options: "none"
};

const ruleToForm = (r: BudgetRule): FormState => ({
  name: r.name,
  rule_source_type: r.rule_source_type,
  tag_id: r.tag_id != null ? String(r.tag_id) : "",
  detected_category: r.detected_category ?? "",
  start_date: r.start_date.slice(0, 10),
  type: r.type,
  flat_amount: r.flat_amount != null ? String(r.flat_amount) : "",
  percent: r.percent != null ? String(r.percent) : "",
  calendar_window: r.calendar_window,
  rollover_options: r.rollover_options
});

const createFormToBody = (f: FormState) => ({
  name: f.name.trim(),
  rule_source_type: f.rule_source_type,
  tag_id: f.rule_source_type === "tag" ? Number(f.tag_id) : null,
  detected_category: f.rule_source_type === "detected_category" ? normalizeDetectedCategoryValue(f.detected_category) : null,
  start_date: f.start_date,
  type: f.type,
  flat_amount: f.type === "flat_rate" ? Number(f.flat_amount) : null,
  percent: f.type === "percent_of_income" ? Number(f.percent) : null,
  calendar_window: f.calendar_window,
  rollover_options: f.rollover_options
});

const updateFormToBody = (f: FormState) => ({
  name: f.name.trim(),
  start_date: f.start_date,
  type: f.type,
  flat_amount: f.type === "flat_rate" ? Number(f.flat_amount) : null,
  percent: f.type === "percent_of_income" ? Number(f.percent) : null,
  calendar_window: f.calendar_window,
  rollover_options: f.rollover_options
});

const ROLLOVER_OPTS: RolloverOption[] = ["none", "surplus", "deficit", "both"];
const ROLLOVER_LABELS: Record<RolloverOption, string> = { none: "None", surplus: "Surplus", deficit: "Deficit", both: "Both" };
const EMPTY_TAGS: Tag[] = [];
const SOURCE_LABELS: Record<BudgetRuleSourceType, string> = { tag: "Tag", detected_category: "Detected category" };

const WINDOW_SIZE = 3;
const ON_BUDGET_EPS = 0.01;

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function toShortDate(iso: string): string {
  const iso10 = iso.slice(0, 10); // keep YYYY-MM-DD, ignore time / timezone
  const parts = iso10.split("-");
  if (parts.length !== 3) return iso;
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (Number.isNaN(m) || Number.isNaN(d) || m < 1 || m > 12) return iso;
  return `${MONTH_SHORT[m - 1]} ${d}`;
}

function budgetDiff(e: BudgetRuleCacheEntry): number {
  return (e.effective_budget ?? 0) - e.associated_spend;
}

function statusColor(e: BudgetRuleCacheEntry): "success" | "danger" | "warning" {
  const diff = budgetDiff(e);
  if (Math.abs(diff) < ON_BUDGET_EPS) return "warning";
  return diff >= 0 ? "success" : "danger";
}

function statusBadge(e: BudgetRuleCacheEntry): string {
  const diff = budgetDiff(e);
  const x = Math.abs(diff).toFixed(0);
  if (Math.abs(diff) < ON_BUDGET_EPS) return "= on budget";
  return diff >= 0 ? `▼ $${x} saved` : `▲ $${x} over`;
}

function statusTooltip(e: BudgetRuleCacheEntry): string {
  const budget = e.effective_budget ?? 0;
  const diff = budgetDiff(e);
  if (Math.abs(diff) < ON_BUDGET_EPS) return `Exactly on budget ($${budget.toFixed(2)})`;
  const d = Math.abs(diff).toFixed(2);
  return diff >= 0
    ? `Under by $${d} — $${e.associated_spend.toFixed(2)} of $${budget.toFixed(2)}`
    : `Over by $${d} of $${budget.toFixed(2)} budget`;
}

function BtnGroup<T extends string>({
  options, labels, value, onChange
}: { options: T[]; labels: Record<T, string>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="btn-group btn-group-sm">
      {options.map(o => (
        <button
          key={o} type="button"
          className={`btn ${value === o ? "btn-primary" : "btn-outline-secondary"}`}
          onClick={() => onChange(o)}
        >
          {labels[o]}
        </button>
      ))}
    </div>
  );
}

function RuleForm({
  form,
  setForm,
  spendingTags,
  detectedCategoryOptions,
  sourceLocked,
  useEarliestStart,
  setUseEarliestStart,
  getEarliestStartDate,
  checkboxId,
  onSave,
  onCancel,
  isPending,
  error
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  spendingTags: Tag[];
  detectedCategoryOptions: Array<{ value: string; label: string }>;
  sourceLocked: boolean;
  useEarliestStart: boolean;
  setUseEarliestStart: (value: boolean) => void;
  getEarliestStartDate: (sourceType: BudgetRuleSourceType, sourceValue: string) => Promise<string | null>;
  checkboxId: string;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
  error: string | null;
}) {
  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (key === "start_date" && useEarliestStart) setUseEarliestStart(false);
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSourceTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextSourceType = e.target.value as BudgetRuleSourceType;
    setUseEarliestStart(false);
    setForm((prev) => ({
      ...prev,
      rule_source_type: nextSourceType,
      tag_id: "",
      detected_category: ""
    }));
  };

  const handleSourceValueChange = async (nextValue: string) => {
    if (form.rule_source_type === "tag") {
      setForm((prev) => ({ ...prev, tag_id: nextValue }));
    } else {
      setForm((prev) => ({ ...prev, detected_category: nextValue }));
    }
    if (!useEarliestStart || !nextValue) return;
    const earliest = await getEarliestStartDate(form.rule_source_type, nextValue);
    if (!earliest) return;
    setForm((prev) => ({ ...prev, start_date: earliest }));
  };

  const handleUseEarliestChange = async (checked: boolean) => {
    setUseEarliestStart(checked);
    const sourceValue = form.rule_source_type === "tag" ? form.tag_id : form.detected_category;
    if (!checked || !sourceValue) return;
    const earliest = await getEarliestStartDate(form.rule_source_type, sourceValue);
    if (!earliest) return;
    setForm((prev) => ({ ...prev, start_date: earliest }));
  };

  return (
    <div className="border rounded p-3 mb-3 bg-light">
      {error && <div className="alert alert-danger py-1 small mb-2">{error}</div>}
      <div className="row g-2 mb-2">
        <div className="col-12 col-md-4">
          <label className="form-label small mb-1">Name</label>
          <input className="form-control form-control-sm" value={form.name} onChange={set("name")} placeholder="Rule name" autoFocus />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label small mb-1">Based On</label>
          <select
            className="form-select form-select-sm"
            value={form.rule_source_type}
            onChange={handleSourceTypeChange}
            disabled={sourceLocked}
          >
            <option value="tag">Tag</option>
            <option value="detected_category">Detected category</option>
          </select>
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label small mb-1">{form.rule_source_type === "tag" ? "Tag" : "Detected Category"}</label>
          {form.rule_source_type === "tag" ? (
            <select
              className="form-select form-select-sm"
              value={form.tag_id}
              disabled={sourceLocked}
              onChange={(e) => void handleSourceValueChange(e.target.value)}
            >
              <option value="">Select tag…</option>
              {spendingTags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          ) : (
            <select
              className="form-select form-select-sm"
              value={form.detected_category}
              disabled={sourceLocked}
              onChange={(e) => void handleSourceValueChange(e.target.value)}
            >
              <option value="">Select category…</option>
              {detectedCategoryOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          )}
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label small mb-1">Start Date</label>
          <input type="date" className="form-control form-control-sm mb-1" value={form.start_date} onChange={set("start_date")} />
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              id={checkboxId}
              checked={useEarliestStart}
              onChange={(e) => void handleUseEarliestChange(e.target.checked)}
            />
            <label className="form-check-label small" htmlFor={checkboxId}>
              {form.rule_source_type === "tag" ? "Use earliest tagged transaction" : "Use earliest detected transaction"}
            </label>
          </div>
        </div>
      </div>
      <div className="row g-2 mb-3 align-items-end">
        <div className="col-auto">
          <label className="form-label small mb-1">Type</label>
          <div>
            <BtnGroup
              options={["flat_rate", "percent_of_income"] as BudgetRuleType[]}
              labels={{ flat_rate: "Flat Rate", percent_of_income: "% of Income" }}
              value={form.type}
              onChange={v => setForm({ ...form, type: v, flat_amount: "", percent: "" })}
            />
          </div>
        </div>
        {form.type === "flat_rate" ? (
          <div className="col-auto">
            <label className="form-label small mb-1">Amount ($)</label>
            <input
              type="number" min="0" className="form-control form-control-sm"
              style={{ width: 120 }} value={form.flat_amount} onChange={set("flat_amount")} placeholder="0.00"
            />
          </div>
        ) : (
          <div className="col-auto">
            <label className="form-label small mb-1">Percent (%)</label>
            <input
              type="number" min="0" max="100" className="form-control form-control-sm"
              style={{ width: 100 }} value={form.percent} onChange={set("percent")} placeholder="0"
            />
          </div>
        )}
        <div className="col-auto">
          <label className="form-label small mb-1">Window</label>
          <div>
            <BtnGroup
              options={["month", "week"] as CalendarWindow[]}
              labels={{ month: "Monthly", week: "Weekly" }}
              value={form.calendar_window}
              onChange={v => setForm({ ...form, calendar_window: v })}
            />
          </div>
        </div>
        <div className="col-auto">
          <label className="form-label small mb-1">Rollover</label>
          <select className="form-select form-select-sm" value={form.rollover_options} onChange={set("rollover_options")}>
            {ROLLOVER_OPTS.map(o => <option key={o} value={o}>{ROLLOVER_LABELS[o]}</option>)}
          </select>
        </div>
      </div>
      <div className="d-flex gap-2">
        <button
          className="btn btn-sm btn-primary px-3"
          disabled={isPending || !form.name.trim() || (form.rule_source_type === "tag" ? !form.tag_id : !form.detected_category)}
          onClick={onSave}
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button className="btn btn-sm btn-outline-secondary px-3" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function BudgetStatusBlock({ cache }: { cache: BudgetRuleCacheEntry[] }) {
  const periods = useMemo(() => cache.slice(1), [cache]);
  const [windowStart, setWindowStart] = useState(() => Math.max(0, cache.length - 1 - WINDOW_SIZE));
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  if (!periods.length) return <div className="text-muted small py-2">No period data yet.</div>;

  const maxWindowStart = Math.max(0, periods.length - WINDOW_SIZE);
  const safeWindowStart = Math.min(windowStart, maxWindowStart);
  const visible = periods.slice(safeWindowStart, safeWindowStart + WINDOW_SIZE);
  const maxVal = Math.max(
    ...visible.map((p) => Math.max(p.effective_budget ?? 0, p.associated_spend)),
    1
  );
  const canUp = safeWindowStart > 0;
  const canDown = safeWindowStart + WINDOW_SIZE < periods.length;
  const newestPeriod = periods[periods.length - 1];
  const summaryDiff = newestPeriod ? budgetDiff(newestPeriod) : null;
  const summaryEnd = newestPeriod ? toShortDate(newestPeriod.end_date) : null;

  return (
    <div className="mb-2">
      <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
        {summaryDiff != null && summaryEnd != null && newestPeriod?.effective_budget != null && (
          <p className="text-muted mb-0 flex-grow-1" style={{ fontSize: "0.95rem" }}>
            {summaryDiff >= 0
              ? `You have $${summaryDiff.toFixed(2)} left to spend before ${summaryEnd}`
              : `You are $${Math.abs(summaryDiff).toFixed(2)} over budget until ${summaryEnd}`}
          </p>
        )}
        <div className="d-flex">
          <button
            type="button"
            className="btn btn-outline-secondary py-0 px-1"
            style={{ fontSize: "0.7rem", lineHeight: 1, minWidth: 24 }}
            disabled={!canDown}
            onClick={() => setWindowStart((s) => Math.min(periods.length - WINDOW_SIZE, s + WINDOW_SIZE))}
            aria-label="Newer periods"
          >
            ▲
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary py-0 px-1 ms-1"
            style={{ fontSize: "0.7rem", lineHeight: 1, minWidth: 24 }}
            disabled={!canUp}
            onClick={() => setWindowStart((s) => Math.max(0, s - WINDOW_SIZE))}
            aria-label="Older periods"
          >
            ▼
          </button>
        </div>
      </div>
      <style>{`.budget-window-enter { animation: budgetWindowFade 0.2s ease; } @keyframes budgetWindowFade { from { opacity: 0; } to { opacity: 1; } }`}</style>
      <div key={safeWindowStart} className="border rounded bg-light px-2 py-2 budget-window-enter" style={{ maxHeight: 220, overflowY: "auto" }}>
        {[...visible].reverse().map((e, revI) => {
          const i = visible.length - 1 - revI;
          const colorKey = statusColor(e);
          const budget = e.effective_budget ?? 0;
          const spendPct = maxVal > 0 ? (e.associated_spend / maxVal) * 100 : 0;
          const budgetPct = maxVal > 0 && budget > 0 ? (budget / maxVal) * 100 : 0;
          const tip = statusTooltip(e);
          const showTip = hoveredRow === i;
          return (
            <div key={`${e.end_date}-${i}`} className="d-flex align-items-center gap-2 mb-2 small">
              <span className="text-muted text-nowrap" style={{ width: 44, fontSize: "0.75rem" }}>
                {toShortDate(e.end_date)}
              </span>
              <div
                className="flex-grow-1 position-relative rounded bg-secondary bg-opacity-25"
                style={{ height: 14, cursor: "help" }}
                onMouseEnter={() => setHoveredRow(i)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                {showTip && (
                  <span
                    className="position-absolute start-50 translate-middle-x rounded px-2 py-1 bg-dark text-white text-nowrap"
                    style={{
                      ...(revI === 0 ? { top: "100%", marginTop: 4 } : { bottom: "100%", marginBottom: 4 }),
                      fontSize: "0.7rem",
                      zIndex: 10,
                    }}
                  >
                    {tip}
                  </span>
                )}
                <div
                  className={`position-absolute top-0 bottom-0 start-0 rounded opacity-75 ${colorKey === "success" ? "bg-success" : colorKey === "danger" ? "bg-danger" : "bg-warning"}`}
                  style={{ width: `${spendPct}%` }}
                />
                {budget > 0 && (
                  <div
                    className="position-absolute top-0 bottom-0 bg-dark opacity-75"
                    style={{ left: `${budgetPct}%`, width: 2, marginLeft: -1 }}
                  />
                )}
              </div>
              <span className={`${colorKey === "success" ? "text-success" : colorKey === "danger" ? "text-danger" : "text-warning"} text-nowrap`} style={{ minWidth: 72, fontSize: "0.75rem", textAlign: "right" }}>
                {e.effective_budget != null ? statusBadge(e) : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CacheTable({ cache, ruleType }: { cache: BudgetRuleCacheEntry[]; ruleType: BudgetRuleType }) {
  if (!cache.length) return <div className="text-muted small py-2">No period data yet.</div>;
  return (
    <div className="table-responsive">
      <table className="table table-sm table-striped mb-0 small">
        <thead>
          <tr>
            <th>Period</th>
            <th className="text-end">Base</th>
            <th className="text-end">Effective</th>
            <th className="text-end">Spend</th>
            {ruleType === "percent_of_income" && <th className="text-end">Income</th>}
            <th className="text-end">Balance</th>
          </tr>
        </thead>
        <tbody>
          {[...cache].reverse().map((e) => (
            <tr key={e.end_date}>
              <td className="text-nowrap">{e.start_date} – {e.end_date}</td>
              <td className="text-end">{e.base_budget == null ? "—" : `$${e.base_budget.toFixed(2)}`}</td>
              <td className="text-end">{e.effective_budget == null ? "—" : `$${e.effective_budget.toFixed(2)}`}</td>
              <td className="text-end">${e.associated_spend.toFixed(2)}</td>
              {ruleType === "percent_of_income" && (
                <td className="text-end">${e.associated_income.toFixed(2)}</td>
              )}
              <td className={`text-end ${e.balance == null ? "text-muted" : e.balance >= 0 ? "text-success" : "text-danger"}`}>
                {e.balance == null ? "—" : `${e.balance >= 0 ? "+" : "-"}$${Math.abs(e.balance).toFixed(2)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BudgetRulesTool({ token }: Props) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"default" | "creating" | "deleting">("default");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState<FormState>(BLANK);
  const [editForm, setEditForm] = useState<FormState>(BLANK);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [createUseEarliestStart, setCreateUseEarliestStart] = useState(false);
  const [editUseEarliestStart, setEditUseEarliestStart] = useState(false);

  const rulesQuery = useQuery({
    queryKey: ["budget_rules"],
    enabled: !!token,
    queryFn: async (): Promise<BudgetRule[]> => {
      const res = await fetch("/api/budget_rules", { headers: buildAuthHeaders(token) });
      if (!res.ok) throw new Error(`Failed to load budget rules (${res.status})`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });

  const tagsQuery = useQuery({
    queryKey: ["tags"],
    enabled: !!token,
    queryFn: async (): Promise<Tag[]> => {
      const res = await fetch("/api/tags", { headers: buildAuthHeaders(token) });
      if (!res.ok) throw new Error(`Failed to load tags (${res.status})`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });

  const tags = tagsQuery.data ?? EMPTY_TAGS;
  const tagsById = useMemo(() => new Map(tags.map(t => [t.id, t])), [tags]);
  const spendingTags = useMemo(() => tags.filter(t => t.type.startsWith("spending")), [tags]);
  const txDataUpdatedAt = queryClient.getQueryState(["transactions"])?.dataUpdatedAt ?? 0;
  const detectedCategoryOptions = useMemo(() => {
    void txDataUpdatedAt;
    const txRows = queryClient
      .getQueriesData<TransactionBaseRow[]>({ queryKey: ["transactions"] })
      .flatMap(([, rows]) => (Array.isArray(rows) ? rows : []));
    const optionByValue = new Map<string, string>();
    for (const txn of txRows) {
      const primary = normalizeDetectedCategoryValue(txn.personal_finance_category?.primary);
      const detailed = normalizeDetectedCategoryValue(txn.personal_finance_category?.detailed);
      const value = detailed || primary;
      if (!value) continue;
      const label = formatTxnDetectedCategory({
        primary: primary || undefined,
        detailed: detailed || undefined
      }) || formatCategoryLabel(value);
      if (!optionByValue.has(value)) optionByValue.set(value, label);
    }
    return [...optionByValue.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [queryClient, txDataUpdatedAt]);
  const detectedCategoryLabelByValue = useMemo(
    () => new Map(detectedCategoryOptions.map((opt) => [opt.value, opt.label])),
    [detectedCategoryOptions]
  );

  const getEarliestStartDate = async (sourceType: BudgetRuleSourceType, sourceValue: string) => {
    if (sourceType === "tag" && !Number.isInteger(Number(sourceValue))) return null;
    const normalizedSourceValue = sourceType === "detected_category" ? normalizeDetectedCategoryValue(sourceValue) : sourceValue;
    if (!normalizedSourceValue) return null;

    const txRows = queryClient
      .getQueriesData<TransactionBaseRow[]>({ queryKey: ["transactions"] })
      .flatMap(([, rows]) => (Array.isArray(rows) ? rows : []));
    if (!txRows.length) return null;
    const metaRows = queryClient.getQueryData<TransactionMetaRow[]>(["transaction_meta"]) ?? [];
    if (sourceType === "tag" && !metaRows.length) return null;

    const metaByTxnId = new Map(metaRows.map((row) => [String(row.transaction_id ?? ""), row]));
    let earliestMs: number | null = null;

    for (const txn of txRows) {
      const txnId = String(txn.transaction_id ?? "");
      if (!txnId) continue;
      if (sourceType === "tag") {
        const meta = metaByTxnId.get(txnId);
        if (!meta) continue;
        const tagId = Number(sourceValue);
        if (meta.bucket_1_tag_id !== tagId && meta.bucket_2_tag_id !== tagId) continue;
      } else {
        const categoryValue = normalizeDetectedCategoryValue(
          txn.personal_finance_category?.detailed ?? txn.personal_finance_category?.primary
        );
        if (!categoryValue || categoryValue !== normalizedSourceValue) continue;
      }

      const dateRaw = txn.datetime ?? txn.authorized_datetime;
      if (!dateRaw) continue;
      const ms = new Date(dateRaw).valueOf();
      if (Number.isNaN(ms)) continue;
      if (earliestMs == null || ms < earliestMs) earliestMs = ms;
    }

    return earliestMs == null ? null : new Date(earliestMs).toISOString().slice(0, 10);
  };

  const createMutation = useMutation({
    mutationFn: async (body: object) => {
      const res = await fetch("/api/budget_rules", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) },
        body: JSON.stringify(body)
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || `Failed to create rule (${res.status})`); }
    },
    onSuccess: async () => {
      setMode("default");
      setCreateForm(BLANK);
      setCreateError(null);
      setCreateUseEarliestStart(false);
      await queryClient.invalidateQueries({ queryKey: ["budget_rules"] });
    },
    onError: (e: Error) => setCreateError(e.message)
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: object }) => {
      const res = await fetch(`/api/budget_rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) },
        body: JSON.stringify(body)
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || `Failed to update rule (${res.status})`); }
    },
    onSuccess: async () => {
      setEditingId(null);
      setEditError(null);
      await queryClient.invalidateQueries({ queryKey: ["budget_rules"] });
    },
    onError: (e: Error) => setEditError(e.message)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/budget_rules/${id}`, { method: "DELETE", headers: buildAuthHeaders(token) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || `Failed to delete rule (${res.status})`); }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budget_rules"] })
  });

  const refreshMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/budget_rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) },
        body: JSON.stringify({})
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || `Failed to refresh (${res.status})`); }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budget_rules"] })
  });

  const rules = rulesQuery.data ?? [];

  return (
    <div className="card">
      <div className="card-body">
        <h6 className="card-title mb-1">Budget Rules</h6>
        <p className="text-muted small mb-3">Define spending targets per tag or detected category, tracked as rolling periods</p>

        {mode === "creating" ? (
          <RuleForm
            form={createForm}
            setForm={setCreateForm}
            spendingTags={spendingTags}
            detectedCategoryOptions={detectedCategoryOptions}
            sourceLocked={false}
            useEarliestStart={createUseEarliestStart}
            setUseEarliestStart={setCreateUseEarliestStart}
            getEarliestStartDate={getEarliestStartDate}
            checkboxId="create-use-earliest-start-date"
            onSave={() => { setCreateError(null); createMutation.mutate(createFormToBody(createForm)); }}
            onCancel={() => { setMode("default"); setCreateForm(BLANK); setCreateError(null); setCreateUseEarliestStart(false); }}
            isPending={createMutation.isPending}
            error={createError}
          />
        ) : (
          <div className="d-flex gap-2 mb-3">
            <button
              className="btn btn-sm btn-outline-primary px-3"
              style={{ minWidth: 130 }}
              onClick={() => { setMode("creating"); setCreateForm(BLANK); setCreateError(null); setCreateUseEarliestStart(false); }}
            >
              New rule
            </button>
            {rules.length > 0 && (
              <button
                className={`btn btn-sm px-3 ${mode === "deleting" ? "btn-danger" : "btn-outline-secondary"}`}
                style={{ minWidth: 130 }}
                onClick={() => setMode(m => m === "deleting" ? "default" : "deleting")}
              >
                Delete rules
              </button>
            )}
          </div>
        )}

        {(rulesQuery.error || deleteMutation.error) && (
          <div className="alert alert-danger py-1 small">
            {(rulesQuery.error as Error | null)?.message || (deleteMutation.error as Error | null)?.message}
          </div>
        )}

        {rulesQuery.isLoading ? (
          <LoadingSpinner message="Loading budget rules..." />
        ) : rules.length === 0 && mode !== "creating" ? (
          <div className="text-muted small">No budget rules yet.</div>
        ) : (
          <div className="d-flex flex-column gap-2">
            {rules.map(rule => {
              const tag = rule.tag_id != null ? tagsById.get(rule.tag_id) : undefined;
              const detectedCategoryLabel = rule.detected_category
                ? (detectedCategoryLabelByValue.get(rule.detected_category) ?? formatCategoryLabel(rule.detected_category))
                : null;
              const isExpanded = expandedId === rule.id;
              const isEditing = editingId === rule.id;
              return (
                <div key={rule.id} className="border rounded">
                  {isEditing ? (
                    <div className="p-3">
                      <RuleForm
                        form={editForm}
                        setForm={setEditForm}
                        spendingTags={spendingTags}
                        detectedCategoryOptions={detectedCategoryOptions}
                        sourceLocked
                        useEarliestStart={editUseEarliestStart}
                        setUseEarliestStart={setEditUseEarliestStart}
                        getEarliestStartDate={getEarliestStartDate}
                        checkboxId={`edit-use-earliest-start-date-${rule.id}`}
                        onSave={() => { setEditError(null); updateMutation.mutate({ id: rule.id, body: updateFormToBody(editForm) }); }}
                        onCancel={() => { setEditingId(null); setEditError(null); setEditUseEarliestStart(false); }}
                        isPending={updateMutation.isPending}
                        error={editError}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="d-flex align-items-center gap-2 p-2 px-3 flex-wrap">
                        <span className="fw-semibold small">{rule.name}</span>
                        {rule.rule_source_type === "tag" && tag && (
                          <span
                            className="badge"
                            style={{
                              backgroundColor: getDisplayTagColor(tag.type, tag.color),
                              color: getTextColorForBackground(getDisplayTagColor(tag.type, tag.color)),
                              border: "1px solid rgba(0,0,0,0.12)"
                            }}
                          >
                            {tag.name}
                          </span>
                        )}
                        {rule.rule_source_type === "detected_category" && detectedCategoryLabel && (
                          <span className="badge bg-info-subtle text-dark border">
                            {detectedCategoryLabel}
                          </span>
                        )}
                        <span className="badge bg-light text-dark border">{SOURCE_LABELS[rule.rule_source_type]}</span>
                        <span className="badge bg-light text-dark border">
                          {rule.type === "flat_rate"
                            ? `$${rule.flat_amount?.toLocaleString() ?? "—"}`
                            : `${rule.percent ?? "—"}%`}
                        </span>
                        <span className="badge bg-light text-dark border">
                          {rule.calendar_window === "month" ? "Monthly" : "Weekly"}
                        </span>
                        <span className="badge bg-light text-dark border">Rollover: {ROLLOVER_LABELS[rule.rollover_options]}</span>
                        <div className="ms-auto d-flex gap-1">
                          <button
                            className="btn btn-sm btn-outline-secondary py-0"
                            onClick={() => setExpandedId(isExpanded ? null : rule.id)}
                            aria-label={isExpanded ? "Collapse period table" : "Expand period table"}
                          >
                            {isExpanded ? "▲" : "▼"} Periods
                          </button>
                          {mode !== "deleting" && (
                            <>
                              <button
                                className="btn btn-sm btn-outline-secondary py-0"
                                onClick={() => refreshMutation.mutate(rule.id)}
                                disabled={refreshMutation.isPending}
                                aria-label="Refresh rule"
                                title="Refresh"
                              >
                                ↻
                              </button>
                              <button
                                className="btn btn-sm btn-outline-secondary py-0"
                                onClick={() => { setEditingId(rule.id); setEditForm(ruleToForm(rule)); setEditError(null); setEditUseEarliestStart(false); }}
                              >
                                Edit
                              </button>
                            </>
                          )}
                          {mode === "deleting" && (
                            <button
                              className="btn btn-sm btn-outline-danger py-0"
                              disabled={deleteMutation.isPending}
                              onClick={() => deleteMutation.mutate(rule.id)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="px-3 pb-2">
                        <BudgetStatusBlock cache={(rule.cache as BudgetRuleCacheEntry[] | null) ?? []} />
                      </div>
                      {isExpanded && (
                        <div className="border-top px-3 py-2">
                          <CacheTable
                            cache={(rule.cache as BudgetRuleCacheEntry[] | null) ?? []}
                            ruleType={rule.type}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

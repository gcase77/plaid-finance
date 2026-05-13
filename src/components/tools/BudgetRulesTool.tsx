import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TRANSACTIONS_QUERY_KEY } from "../../hooks/useTransactionsData";
import { buildAuthHeaders } from "../../lib/auth";
import {
  formatCategoryLabel,
  formatTxnDetectedCategory,
  getDisplayTagColor,
  getTextColorForBackground,
  normalizeDetectedCategoryValue
} from "../../utils/transactionUtils";
import LoadingSpinner from "../shared/LoadingSpinner";
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

const blank = (): FormState => ({
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
});

const ROLLOVER_LABELS: Record<RolloverOption, string> = { none: "None", surplus: "Surplus", deficit: "Deficit", both: "Both" };
const WINDOWS: Record<CalendarWindow, string> = { month: "Monthly", week: "Weekly" };
const TYPES: Record<BudgetRuleType, string> = { flat_rate: "Fixed amount", percent_of_income: "% of income" };
const EMPTY_TAGS: Tag[] = [];

function ruleToForm(rule: BudgetRule): FormState {
  return {
    name: rule.name,
    rule_source_type: rule.rule_source_type,
    tag_id: rule.tag_id == null ? "" : String(rule.tag_id),
    detected_category: rule.detected_category ?? "",
    start_date: rule.start_date.slice(0, 10),
    type: rule.type,
    flat_amount: rule.flat_amount == null ? "" : String(rule.flat_amount),
    percent: rule.percent == null ? "" : String(rule.percent),
    calendar_window: rule.calendar_window,
    rollover_options: rule.rollover_options
  };
}

function createBody(f: FormState) {
  return {
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
  };
}

function updateBody(f: FormState) {
  return {
    name: f.name.trim(),
    start_date: f.start_date,
    type: f.type,
    flat_amount: f.type === "flat_rate" ? Number(f.flat_amount) : null,
    percent: f.type === "percent_of_income" ? Number(f.percent) : null,
    calendar_window: f.calendar_window,
    rollover_options: f.rollover_options
  };
}

function money(value: number | null | undefined) {
  return value == null ? "--" : value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function TagBadge({ tag }: { tag: Tag }) {
  const color = getDisplayTagColor(tag.type, tag.color);
  return <span className="badge" style={{ backgroundColor: color, color: getTextColorForBackground(color), border: "1px solid rgba(0,0,0,.12)" }}>{tag.name}</span>;
}

function RuleForm({
  form,
  setForm,
  tags,
  detectedCategories,
  sourceLocked,
  error,
  pending,
  onUseEarliest,
  onSave,
  onCancel
}: {
  form: FormState;
  setForm: (next: FormState) => void;
  tags: Tag[];
  detectedCategories: Array<{ value: string; label: string }>;
  sourceLocked?: boolean;
  error: string | null;
  pending: boolean;
  onUseEarliest: () => Promise<void>;
  onSave: () => void;
  onCancel: () => void;
}) {
  const sourceValue = form.rule_source_type === "tag" ? form.tag_id : form.detected_category;
  const sourceOk = form.rule_source_type === "tag" ? !!form.tag_id : !!form.detected_category;
  const saveDisabled = pending || !form.name.trim() || !sourceOk;
  const set = (key: keyof FormState, value: string) => setForm({ ...form, [key]: value } as FormState);

  return (
    <div className="surface-card p-3 stack">
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      <div className="filter-grid">
        <div>
          <label className="form-label small fw-semibold">Name</label>
          <input className="form-control" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Rule name" />
        </div>
        <div>
          <label className="form-label small fw-semibold">Start date</label>
          <div className="cluster">
            <input type="date" className="form-control" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={!sourceValue} onClick={() => void onUseEarliest()}>Earliest</button>
          </div>
        </div>
      </div>
      <div className="filter-grid">
        <div>
          <label className="form-label small fw-semibold">Based on</label>
          <select className="form-select" value={form.rule_source_type} disabled={sourceLocked} onChange={(e) => setForm({ ...form, rule_source_type: e.target.value as BudgetRuleSourceType, tag_id: "", detected_category: "" })}>
            <option value="tag">Tag</option>
            <option value="detected_category">Detected category</option>
          </select>
        </div>
        <div>
          <label className="form-label small fw-semibold">{form.rule_source_type === "tag" ? "Tag" : "Detected category"}</label>
          {form.rule_source_type === "tag" ? (
            <select className="form-select" value={form.tag_id} disabled={sourceLocked} onChange={(e) => set("tag_id", e.target.value)}>
              <option value="">Choose a tag...</option>
              {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
            </select>
          ) : (
            <select className="form-select" value={form.detected_category} disabled={sourceLocked} onChange={(e) => set("detected_category", e.target.value)}>
              <option value="">Choose a category...</option>
              {detectedCategories.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          )}
        </div>
      </div>
      <div className="filter-grid">
        <div>
          <label className="form-label small fw-semibold">Budget type</label>
          <select className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as BudgetRuleType, flat_amount: "", percent: "" })}>
            <option value="flat_rate">{TYPES.flat_rate}</option>
            <option value="percent_of_income">{TYPES.percent_of_income}</option>
          </select>
        </div>
        <div>
          <label className="form-label small fw-semibold">{form.type === "flat_rate" ? "Amount" : "Percent"}</label>
          <input className="form-control" type="number" min="0" max={form.type === "percent_of_income" ? 100 : undefined} value={form.type === "flat_rate" ? form.flat_amount : form.percent}
            onChange={(e) => set(form.type === "flat_rate" ? "flat_amount" : "percent", e.target.value)} placeholder="0" />
        </div>
      </div>
      <div className="filter-grid">
        <div>
          <label className="form-label small fw-semibold">Window</label>
          <select className="form-select" value={form.calendar_window} onChange={(e) => set("calendar_window", e.target.value)}>
            <option value="month">Monthly</option>
            <option value="week">Weekly</option>
          </select>
        </div>
        <div>
          <label className="form-label small fw-semibold">Rollover</label>
          <select className="form-select" value={form.rollover_options} onChange={(e) => set("rollover_options", e.target.value)}>
            {(Object.keys(ROLLOVER_LABELS) as RolloverOption[]).map((key) => <option key={key} value={key}>{ROLLOVER_LABELS[key]}</option>)}
          </select>
        </div>
      </div>
      <div className="cluster justify-content-end">
        <button className="btn btn-outline-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" disabled={saveDisabled} onClick={onSave}>{pending ? "Saving..." : "Save rule"}</button>
      </div>
    </div>
  );
}

function BudgetStatus({ cache }: { cache: BudgetRuleCacheEntry[] }) {
  const current = cache.at(-1);
  if (!current) return <div className="small text-muted">No period data yet.</div>;
  const remaining = (current.effective_budget ?? 0) - current.associated_spend;
  const spentPct = current.effective_budget ? Math.min(100, (current.associated_spend / current.effective_budget) * 100) : 0;
  return (
    <div className="metric-card">
      <div className="split mb-2">
        <span className="small text-muted">{current.start_date} to {current.end_date}</span>
        <span className={`chip ${remaining < 0 ? "text-danger" : "text-success"}`}>{remaining < 0 ? `${money(Math.abs(remaining))} over` : `${money(remaining)} left`}</span>
      </div>
      <div className="progress" style={{ height: 10 }}>
        <div className={`progress-bar ${remaining < 0 ? "bg-danger" : "bg-success"}`} style={{ width: `${spentPct}%` }} />
      </div>
      <div className="cluster small mt-2">
        <span className="chip">Budget {money(current.effective_budget)}</span>
        <span className="chip">Spent {money(current.associated_spend)}</span>
        <span className="chip">Carry {money(current.balance)}</span>
      </div>
    </div>
  );
}

function CacheTable({ cache, ruleType }: { cache: BudgetRuleCacheEntry[]; ruleType: BudgetRuleType }) {
  if (!cache.length) return null;
  return (
    <div className="table-responsive">
      <table className="data-table small">
        <thead>
          <tr>
            <th>Period</th>
            <th className="text-end">Base</th>
            <th className="text-end">Effective</th>
            {ruleType === "percent_of_income" && <th className="text-end">Income</th>}
            <th className="text-end">Spend</th>
            <th className="text-end">Balance</th>
          </tr>
        </thead>
        <tbody>
          {[...cache].reverse().map((entry) => (
            <tr key={`${entry.start_date}-${entry.end_date}`}>
              <td>{entry.start_date} to {entry.end_date}</td>
              <td className="text-end">{money(entry.base_budget)}</td>
              <td className="text-end">{money(entry.effective_budget)}</td>
              {ruleType === "percent_of_income" && <td className="text-end">{money(entry.associated_income)}</td>}
              <td className="text-end">{money(entry.associated_spend)}</td>
              <td className="text-end">{money(entry.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function amountLabel(rule: BudgetRule) {
  const win = rule.calendar_window === "month" ? "monthly" : "weekly";
  return rule.type === "flat_rate" ? `${money(rule.flat_amount)} ${win}` : `${rule.percent ?? "--"}% of income ${win}`;
}

export default function BudgetRulesTool({ token }: Props) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(blank);
  const [editForm, setEditForm] = useState<FormState>(blank);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

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
  const tagsById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);
  const selectableTags = useMemo(() => tags.filter((tag) => tag.type === "meta" || tag.type.startsWith("spending")).sort((a, b) => a.name.localeCompare(b.name)), [tags]);
  const txDataUpdatedAt = queryClient.getQueryState(TRANSACTIONS_QUERY_KEY)?.dataUpdatedAt ?? 0;
  const detectedCategories = useMemo(() => {
    void txDataUpdatedAt;
    const rows = queryClient.getQueryData<TransactionBaseRow[]>(TRANSACTIONS_QUERY_KEY) ?? [];
    const map = new Map<string, string>();
    rows.forEach((txn) => {
      const primary = normalizeDetectedCategoryValue(txn.personal_finance_category?.primary);
      const detailed = normalizeDetectedCategoryValue(txn.personal_finance_category?.detailed);
      const value = detailed || primary;
      if (value && !map.has(value)) map.set(value, formatTxnDetectedCategory({ primary, detailed }) || formatCategoryLabel(value));
    });
    return [...map.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [queryClient, txDataUpdatedAt]);
  const detectedLabel = useMemo(() => new Map(detectedCategories.map((opt) => [opt.value, opt.label])), [detectedCategories]);

  const getEarliest = async (form: FormState) => {
    const source = form.rule_source_type === "tag" ? form.tag_id : normalizeDetectedCategoryValue(form.detected_category);
    if (!source) return null;
    const rows = queryClient.getQueryData<TransactionBaseRow[]>(TRANSACTIONS_QUERY_KEY) ?? [];
    const metaRows = queryClient.getQueryData<TransactionMetaRow[]>(["transaction_meta"]) ?? [];
    const metaByTxn = new Map(metaRows.map((row) => [String(row.transaction_id ?? ""), row]));
    let best: number | null = null;
    for (const txn of rows) {
      const id = String(txn.transaction_id ?? "");
      const meta = metaByTxn.get(id);
      if (meta?.account_transfer_group) continue;
      const matchesTag = form.rule_source_type === "tag" && meta && (meta.bucket_1_tag_id === Number(source) || meta.bucket_2_tag_id === Number(source) || meta.meta_tag_ids?.includes(Number(source)));
      const matchesCategory = form.rule_source_type === "detected_category" && normalizeDetectedCategoryValue(txn.personal_finance_category?.detailed ?? txn.personal_finance_category?.primary) === source;
      if (!matchesTag && !matchesCategory) continue;
      const raw = txn.datetime ?? txn.authorized_datetime;
      const ms = raw ? new Date(raw).valueOf() : NaN;
      if (!Number.isNaN(ms) && (best == null || ms < best)) best = ms;
    }
    return best == null ? null : new Date(best).toISOString().slice(0, 10);
  };

  const createMutation = useMutation({
    mutationFn: async (body: object) => {
      const res = await fetch("/api/budget_rules", { method: "POST", headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Failed to create rule (${res.status})`);
    },
    onSuccess: async () => {
      setCreating(false);
      setCreateForm(blank());
      setCreateError(null);
      await queryClient.invalidateQueries({ queryKey: ["budget_rules"] });
    },
    onError: (e: Error) => setCreateError(e.message)
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: object }) => {
      const res = await fetch(`/api/budget_rules/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Failed to update rule (${res.status})`);
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
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Failed to delete rule (${res.status})`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budget_rules"] })
  });

  const refreshMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/budget_rules/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) }, body: "{}" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Failed to refresh rule (${res.status})`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budget_rules"] })
  });

  const rules = rulesQuery.data ?? [];
  const listError = (rulesQuery.error as Error | null)?.message || (deleteMutation.error as Error | null)?.message || (refreshMutation.error as Error | null)?.message;

  return (
    <section className="surface-card p-3 stack">
      <div className="split">
        <div>
          <h2 className="h5 mb-1">Budget rules</h2>
          <p className="text-muted small mb-0">Set targets by tag or detected category, then track rollover and period spend.</p>
        </div>
        <div className="cluster">
          <button className="btn btn-primary" onClick={() => { setCreating(true); setCreateForm(blank()); }}>New rule</button>
          {rules.length > 0 && <button className={`btn ${deleteMode ? "btn-danger" : "btn-outline-secondary"}`} onClick={() => setDeleteMode(!deleteMode)}>{deleteMode ? "Done deleting" : "Delete rules"}</button>}
        </div>
      </div>

      {creating && (
        <RuleForm
          form={createForm}
          setForm={setCreateForm}
          tags={selectableTags}
          detectedCategories={detectedCategories}
          error={createError}
          pending={createMutation.isPending}
          onUseEarliest={async () => { const d = await getEarliest(createForm); if (d) setCreateForm({ ...createForm, start_date: d }); }}
          onSave={() => { setCreateError(null); createMutation.mutate(createBody(createForm)); }}
          onCancel={() => { setCreating(false); setCreateError(null); }}
        />
      )}

      {listError && <div className="alert alert-danger py-2 small">{listError}</div>}
      {rulesQuery.isLoading ? <LoadingSpinner message="Loading budget rules..." /> : rules.length === 0 && !creating ? (
        <div className="metric-card text-muted">No budget rules yet.</div>
      ) : (
        <div className="stack">
          {rules.map((rule) => {
            const tag = rule.tag_id == null ? null : tagsById.get(rule.tag_id);
            const cache = (rule.cache as BudgetRuleCacheEntry[] | null) ?? [];
            const expanded = expandedId === rule.id;
            const editing = editingId === rule.id;
            return (
              <article key={rule.id} className="metric-card stack">
                {editing ? (
                  <RuleForm
                    form={editForm}
                    setForm={setEditForm}
                    tags={selectableTags}
                    detectedCategories={detectedCategories}
                    sourceLocked
                    error={editError}
                    pending={updateMutation.isPending}
                    onUseEarliest={async () => { const d = await getEarliest(editForm); if (d) setEditForm({ ...editForm, start_date: d }); }}
                    onSave={() => { setEditError(null); updateMutation.mutate({ id: rule.id, body: updateBody(editForm) }); }}
                    onCancel={() => { setEditingId(null); setEditError(null); }}
                  />
                ) : (
                  <>
                    <div className="split">
                      <div className="cluster">
                        <b>{rule.name}</b>
                        {tag && <TagBadge tag={tag} />}
                        {rule.rule_source_type === "detected_category" && rule.detected_category && <span className="chip">{detectedLabel.get(rule.detected_category) ?? formatCategoryLabel(rule.detected_category)}</span>}
                        <span className="chip">{amountLabel(rule)}</span>
                        <span className="chip">{WINDOWS[rule.calendar_window]}</span>
                        <span className="chip">Rollover: {ROLLOVER_LABELS[rule.rollover_options]}</span>
                      </div>
                      <div className="cluster">
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setExpandedId(expanded ? null : rule.id)}>{expanded ? "Hide periods" : "Periods"}</button>
                        {!deleteMode && <button className="btn btn-sm btn-outline-secondary" disabled={refreshMutation.isPending} onClick={() => refreshMutation.mutate(rule.id)}>Refresh</button>}
                        {!deleteMode && <button className="btn btn-sm btn-outline-secondary" onClick={() => { setEditingId(rule.id); setEditForm(ruleToForm(rule)); }}>Edit</button>}
                        {deleteMode && <button className="btn btn-sm btn-outline-danger" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(rule.id)}>Delete</button>}
                      </div>
                    </div>
                    <BudgetStatus cache={cache} />
                    {expanded && <CacheTable cache={cache} ruleType={rule.type} />}
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

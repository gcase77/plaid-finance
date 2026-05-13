import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buildAuthHeaders } from "../../lib/auth";
import { TRANSACTIONS_QUERY_KEY } from "../../hooks/useTransactionsData";
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
import { Alert, InfoTip, Segmented } from "../shared/ui";

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
  name: "", rule_source_type: "tag", tag_id: "", detected_category: "",
  start_date: new Date().toISOString().slice(0, 10),
  type: "flat_rate", flat_amount: "", percent: "",
  calendar_window: "month", rollover_options: "none"
};

const ruleToForm = (r: BudgetRule): FormState => ({
  name: r.name, rule_source_type: r.rule_source_type,
  tag_id: r.tag_id != null ? String(r.tag_id) : "", detected_category: r.detected_category ?? "",
  start_date: r.start_date.slice(0, 10), type: r.type,
  flat_amount: r.flat_amount != null ? String(r.flat_amount) : "",
  percent: r.percent != null ? String(r.percent) : "",
  calendar_window: r.calendar_window, rollover_options: r.rollover_options
});

const createBody = (f: FormState) => ({
  name: f.name.trim(), rule_source_type: f.rule_source_type,
  tag_id: f.rule_source_type === "tag" ? Number(f.tag_id) : null,
  detected_category: f.rule_source_type === "detected_category" ? normalizeDetectedCategoryValue(f.detected_category) : null,
  start_date: f.start_date, type: f.type,
  flat_amount: f.type === "flat_rate" ? Number(f.flat_amount) : null,
  percent: f.type === "percent_of_income" ? Number(f.percent) : null,
  calendar_window: f.calendar_window, rollover_options: f.rollover_options
});

const updateBody = (f: FormState) => ({
  name: f.name.trim(), start_date: f.start_date, type: f.type,
  flat_amount: f.type === "flat_rate" ? Number(f.flat_amount) : null,
  percent: f.type === "percent_of_income" ? Number(f.percent) : null,
  calendar_window: f.calendar_window, rollover_options: f.rollover_options
});

const ROLLOVER: { value: RolloverOption; label: string }[] = [
  { value: "none", label: "None" }, { value: "surplus", label: "Surplus" }, { value: "deficit", label: "Deficit" }, { value: "both", label: "Both" }
];

const EMPTY_TAGS: Tag[] = [];
const BUDGET_INTRO = "Set spending targets by tag or detected category. Track per week or month, fixed amount or a percent of last period's income. Optionally roll over surplus/deficit.";
const BASED_ON_TIP = "Track a spending tag (recommended) or a detected category from your transactions.";
const START_DATE_TIP = "When this budget begins. Rollover starts from this period.";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WINDOW_SIZE = 3;
const ON_BUDGET_EPS = 0.01;

function shortDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!m || m < 1 || m > 12) return iso;
  const cur = new Date().getFullYear();
  return `${MONTH_SHORT[m - 1]} ${d}${y && y !== cur ? ` '${String(y).slice(-2)}` : ""}`;
}
function money(n: number) { return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

function budgetDiff(e: BudgetRuleCacheEntry) { return (e.effective_budget ?? 0) - e.associated_spend; }
function statusKey(e: BudgetRuleCacheEntry): "success" | "danger" | "warning" {
  const d = budgetDiff(e);
  return Math.abs(d) < ON_BUDGET_EPS ? "warning" : d >= 0 ? "success" : "danger";
}

function TagBadge({ tag }: { tag: Tag }) {
  const color = getDisplayTagColor(tag.type, tag.color);
  return <span className="tag-badge" style={{ background: color, color: getTextColorForBackground(color) }}>{tag.name}</span>;
}

function RuleForm({
  form, setForm, selectableTags, detectedOptions, sourceLocked, useEarliest, setUseEarliest, getEarliest, onSave, onCancel, pending, error
}: {
  form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>>;
  selectableTags: Tag[]; detectedOptions: Array<{ value: string; label: string }>; sourceLocked: boolean;
  useEarliest: boolean; setUseEarliest: (v: boolean) => void;
  getEarliest: (st: BudgetRuleSourceType, val: string) => Promise<string | null>;
  onSave: () => void; onCancel: () => void; pending: boolean; error: string | null;
}) {
  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (key === "start_date" && useEarliest) setUseEarliest(false);
    setForm((p) => ({ ...p, [key]: e.target.value }));
  };
  const setSourceValue = async (v: string) => {
    setForm((p) => form.rule_source_type === "tag" ? { ...p, tag_id: v } : { ...p, detected_category: v });
    if (!useEarliest || !v) return;
    const d = await getEarliest(form.rule_source_type, v);
    if (d) setForm((p) => ({ ...p, start_date: d }));
  };
  const setEarliest = async (c: boolean) => {
    setUseEarliest(c);
    const v = form.rule_source_type === "tag" ? form.tag_id : form.detected_category;
    if (!c || !v) return;
    const d = await getEarliest(form.rule_source_type, v);
    if (d) setForm((p) => ({ ...p, start_date: d }));
  };
  const sourceOk = form.rule_source_type === "tag" ? !!form.tag_id : !!form.detected_category;
  const saveDisabled = pending || !form.name.trim() || !sourceOk;

  return (
    <div className="card card-tight" style={{ background: "var(--surface-alt)" }}>
      {error && <div className="mb-3"><Alert tone="danger">{error}</Alert></div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 12 }}>
        <div className="field">
          <label>Name</label>
          <input className="input input-sm" value={form.name} onChange={set("name")} placeholder="Rule name" autoFocus />
        </div>
        <div className="field">
          <label>Based on <InfoTip text={BASED_ON_TIP} /></label>
          <select className="select input-sm" value={form.rule_source_type} disabled={sourceLocked} onChange={(e) => { setUseEarliest(false); setForm((p) => ({ ...p, rule_source_type: e.target.value as BudgetRuleSourceType, tag_id: "", detected_category: "" })); }}>
            <option value="tag">Tag</option>
            <option value="detected_category">Detected category</option>
          </select>
        </div>
        <div className="field">
          <label>{form.rule_source_type === "tag" ? "Tag" : "Detected category"}</label>
          {form.rule_source_type === "tag" ? (
            <select className="select input-sm" disabled={sourceLocked} value={form.tag_id} onChange={(e) => void setSourceValue(e.target.value)}>
              <option value="">Select tag…</option>
              {selectableTags.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.type === "meta" ? "Meta" : "Spending"})</option>)}
            </select>
          ) : (
            <select className="select input-sm" disabled={sourceLocked} value={form.detected_category} onChange={(e) => void setSourceValue(e.target.value)}>
              <option value="">Select category…</option>
              {detectedOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
        </div>
        <div className="field">
          <label>Start date <InfoTip text={START_DATE_TIP} /></label>
          <input type="date" className="input input-sm" value={form.start_date} onChange={set("start_date")} />
          <label className="check" style={{ marginTop: 4, fontSize: "0.78rem" }}>
            <input type="checkbox" checked={useEarliest} onChange={(e) => void setEarliest(e.target.checked)} />
            Use earliest matching transaction
          </label>
        </div>
      </div>

      <div className="row-flex flex-wrap gap-4 mb-3" style={{ alignItems: "flex-end" }}>
        <div className="field">
          <label>Type</label>
          <Segmented value={form.type} onChange={(v) => setForm({ ...form, type: v, flat_amount: "", percent: "" })} options={[{ value: "flat_rate", label: "Flat" }, { value: "percent_of_income", label: "% of income" }]} />
        </div>
        {form.type === "flat_rate" ? (
          <div className="field" style={{ maxWidth: 120 }}>
            <label>Amount ($)</label>
            <input type="number" min="0" className="input input-sm" value={form.flat_amount} onChange={set("flat_amount")} placeholder="0.00" />
          </div>
        ) : (
          <div className="field" style={{ maxWidth: 110 }}>
            <label>Percent (%)</label>
            <input type="number" min="0" max="100" className="input input-sm" value={form.percent} onChange={set("percent")} placeholder="0" />
          </div>
        )}
        <div className="field">
          <label>Window</label>
          <Segmented value={form.calendar_window} onChange={(v) => setForm({ ...form, calendar_window: v })} options={[{ value: "month", label: "Monthly" }, { value: "week", label: "Weekly" }]} />
        </div>
        <div className="field" style={{ maxWidth: 160 }}>
          <label>Rollover</label>
          <select className="select input-sm" value={form.rollover_options} onChange={set("rollover_options")}>
            {ROLLOVER.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="row-flex gap-2">
        <button className="btn primary btn-sm" disabled={saveDisabled} onClick={onSave}>{pending ? "Saving…" : "Save"}</button>
        <button className="btn ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
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

function ruleAmountLabel(r: Pick<BudgetRule, "type" | "flat_amount" | "percent" | "calendar_window">) {
  const w = r.calendar_window === "month" ? "monthly" : "weekly";
  return r.type === "flat_rate" ? `${r.flat_amount == null ? "—" : money(r.flat_amount)} ${w}` : `${r.percent ?? "—"}% of income ${w}`;
}

function CacheTable({ cache, ruleType }: { cache: BudgetRuleCacheEntry[]; ruleType: BudgetRuleType }) {
  if (!cache.length) return <div className="muted small">No period data yet.</div>;
  const showIncome = ruleType === "percent_of_income";
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Period</th>
            <th className="text-end">Base</th>
            <th className="text-end">Effective</th>
            {showIncome && <th className="text-end">Income</th>}
            <th className="text-end">Spend</th>
            <th className="text-end">Rollover</th>
          </tr>
        </thead>
        <tbody>
          {[...cache].reverse().map((e) => (
            <tr key={e.end_date}>
              <td className="text-nowrap xs">{e.start_date} – {e.end_date}</td>
              <td className="text-end">{e.base_budget == null ? "—" : money(e.base_budget)}</td>
              <td className="text-end">{e.effective_budget == null ? "—" : money(e.effective_budget)}</td>
              {showIncome && <td className="text-end">{money(e.associated_income)}</td>}
              <td className="text-end">{money(e.associated_spend)}</td>
              <td className={`text-end ${e.balance == null ? "muted" : e.balance >= 0 ? "text-success" : "text-danger"}`}>
                {e.balance == null ? "—" : `${e.balance >= 0 ? "+" : "-"}${money(Math.abs(e.balance))}`}
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
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState<FormState>(BLANK);
  const [editForm, setEditForm] = useState<FormState>(BLANK);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [createEarliest, setCreateEarliest] = useState(false);
  const [editEarliest, setEditEarliest] = useState(false);

  const rulesQuery = useQuery({
    queryKey: ["budget_rules"], enabled: !!token,
    queryFn: async (): Promise<BudgetRule[]> => {
      const res = await fetch("/api/budget_rules", { headers: buildAuthHeaders(token) });
      if (!res.ok) throw new Error(`Failed to load budget rules (${res.status})`);
      return (await res.json()) || [];
    }
  });

  const tagsQuery = useQuery({
    queryKey: ["tags"], enabled: !!token,
    queryFn: async (): Promise<Tag[]> => {
      const res = await fetch("/api/tags", { headers: buildAuthHeaders(token) });
      if (!res.ok) throw new Error(`Failed to load tags (${res.status})`);
      return (await res.json()) || [];
    }
  });

  const tags = tagsQuery.data ?? EMPTY_TAGS;
  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const selectableTags = useMemo(
    () => tags.filter((t) => t.type === "meta" || t.type.startsWith("spending")).sort((a, b) => (a.type === "meta" ? 0 : 1) - (b.type === "meta" ? 0 : 1) || a.name.localeCompare(b.name)),
    [tags]
  );
  const txUpdated = queryClient.getQueryState(TRANSACTIONS_QUERY_KEY)?.dataUpdatedAt ?? 0;
  const detectedOptions = useMemo(() => {
    void txUpdated;
    const rows = queryClient.getQueryData<TransactionBaseRow[]>(TRANSACTIONS_QUERY_KEY) ?? [];
    const m = new Map<string, string>();
    for (const t of rows) {
      const primary = normalizeDetectedCategoryValue(t.personal_finance_category?.primary);
      const detailed = normalizeDetectedCategoryValue(t.personal_finance_category?.detailed);
      const value = detailed || primary;
      if (!value) continue;
      const label = formatTxnDetectedCategory({ primary: primary || undefined, detailed: detailed || undefined }) || formatCategoryLabel(value);
      if (!m.has(value)) m.set(value, label);
    }
    return [...m.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [queryClient, txUpdated]);
  const detectedByValue = useMemo(() => new Map(detectedOptions.map((o) => [o.value, o.label])), [detectedOptions]);

  const getEarliest = async (st: BudgetRuleSourceType, val: string): Promise<string | null> => {
    if (st === "tag" && !Number.isInteger(Number(val))) return null;
    const norm = st === "detected_category" ? normalizeDetectedCategoryValue(val) : val;
    if (!norm) return null;
    const rows = queryClient.getQueryData<TransactionBaseRow[]>(TRANSACTIONS_QUERY_KEY) ?? [];
    if (!rows.length) return null;
    const meta = queryClient.getQueryData<TransactionMetaRow[]>(["transaction_meta"]) ?? [];
    if (st === "tag" && !meta.length) return null;
    const metaById = new Map(meta.map((r) => [String(r.transaction_id ?? ""), r]));
    let earliest: number | null = null;
    for (const t of rows) {
      const id = String(t.transaction_id ?? "");
      if (!id) continue;
      const m = metaById.get(id);
      if (m?.account_transfer_group != null) continue;
      if (st === "tag") {
        if (!m) continue;
        const tagId = Number(val);
        if (m.bucket_1_tag_id !== tagId && m.bucket_2_tag_id !== tagId && !(m.meta_tag_ids ?? []).includes(tagId)) continue;
      } else {
        const cat = normalizeDetectedCategoryValue(t.personal_finance_category?.detailed ?? t.personal_finance_category?.primary);
        if (cat !== norm) continue;
      }
      const raw = t.datetime ?? t.authorized_datetime;
      if (!raw) continue;
      const ms = new Date(raw).valueOf();
      if (!Number.isNaN(ms) && (earliest == null || ms < earliest)) earliest = ms;
    }
    return earliest == null ? null : new Date(earliest).toISOString().slice(0, 10);
  };

  const createMut = useMutation({
    mutationFn: async (body: object) => {
      const res = await fetch("/api/budget_rules", { method: "POST", headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || `Failed to create rule (${res.status})`); }
    },
    onSuccess: async () => { setCreating(false); setCreateForm(BLANK); setCreateErr(null); setCreateEarliest(false); await queryClient.invalidateQueries({ queryKey: ["budget_rules"] }); },
    onError: (e: Error) => setCreateErr(e.message)
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: object }) => {
      const res = await fetch(`/api/budget_rules/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || `Failed to update rule (${res.status})`); }
    },
    onSuccess: async () => { setEditingId(null); setEditErr(null); await queryClient.invalidateQueries({ queryKey: ["budget_rules"] }); },
    onError: (e: Error) => setEditErr(e.message)
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/budget_rules/${id}`, { method: "DELETE", headers: buildAuthHeaders(token) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || `Failed to delete rule (${res.status})`); }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budget_rules"] })
  });

  const refreshMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/budget_rules/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) }, body: JSON.stringify({}) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || `Failed to refresh (${res.status})`); }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budget_rules"] })
  });

  const rules = rulesQuery.data ?? [];
  const errorMsg = (rulesQuery.error as Error | null)?.message || (deleteMut.error as Error | null)?.message;

  return (
    <>
      <p className="muted small mb-4">{BUDGET_INTRO}</p>

      {creating ? (
        <div className="mb-4">
          <RuleForm
            form={createForm} setForm={setCreateForm}
            selectableTags={selectableTags} detectedOptions={detectedOptions}
            sourceLocked={false}
            useEarliest={createEarliest} setUseEarliest={setCreateEarliest}
            getEarliest={getEarliest}
            onSave={() => { setCreateErr(null); createMut.mutate(createBody(createForm)); }}
            onCancel={() => { setCreating(false); setCreateForm(BLANK); setCreateErr(null); setCreateEarliest(false); }}
            pending={createMut.isPending} error={createErr}
          />
        </div>
      ) : (
        <div className="row-flex gap-2 mb-4">
          <button className="btn primary" onClick={() => { setCreating(true); setCreateForm(BLANK); setCreateErr(null); }}>+ New rule</button>
          {rules.length > 0 && (
            <button className={`btn ${deleting ? "danger" : "ghost"}`} onClick={() => setDeleting((d) => !d)}>{deleting ? "Done deleting" : "Delete rules"}</button>
          )}
        </div>
      )}

      {errorMsg && <div className="mb-3"><Alert tone="danger">{errorMsg}</Alert></div>}

      {rulesQuery.isLoading ? <LoadingSpinner message="Loading budget rules..." />
        : rules.length === 0 && !creating ? <div className="card"><p className="muted">No budget rules yet. Click <strong>New rule</strong> to add one.</p></div>
        : (
          <div className="col-flex">
            {rules.map((rule) => {
              const tag = rule.tag_id != null ? tagsById.get(rule.tag_id) : undefined;
              const catLabel = rule.detected_category ? (detectedByValue.get(rule.detected_category) ?? formatCategoryLabel(rule.detected_category)) : null;
              const expanded = expandedId === rule.id;
              const editing = editingId === rule.id;
              return (
                <div key={rule.id} className="card" style={{ padding: 0 }}>
                  {editing ? (
                    <div style={{ padding: "var(--s4)" }}>
                      <RuleForm
                        form={editForm} setForm={setEditForm}
                        selectableTags={selectableTags} detectedOptions={detectedOptions}
                        sourceLocked
                        useEarliest={editEarliest} setUseEarliest={setEditEarliest}
                        getEarliest={getEarliest}
                        onSave={() => { setEditErr(null); updateMut.mutate({ id: rule.id, body: updateBody(editForm) }); }}
                        onCancel={() => { setEditingId(null); setEditErr(null); setEditEarliest(false); }}
                        pending={updateMut.isPending} error={editErr}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="between flex-wrap gap-2" style={{ padding: "var(--s3) var(--s4)" }}>
                        <div className="row-flex flex-wrap gap-2">
                          <span className="fw-semi">{rule.name}</span>
                          {tag && <TagBadge tag={tag} />}
                          {catLabel && <span className="chip chip-soft">{catLabel}</span>}
                          <span className="chip">{ruleAmountLabel(rule)}</span>
                          <span className="chip">Rollover: {ROLLOVER.find((r) => r.value === rule.rollover_options)?.label}</span>
                        </div>
                        <div className="row-flex gap-2">
                          <button className="btn ghost btn-sm" onClick={() => setExpandedId(expanded ? null : rule.id)}>{expanded ? "Hide" : "Show"} periods</button>
                          {!deleting && (
                            <>
                              <button className="btn ghost btn-icon btn-sm" disabled={refreshMut.isPending} onClick={() => refreshMut.mutate(rule.id)} title="Refresh">↻</button>
                              <button className="btn ghost btn-sm" onClick={() => { setEditingId(rule.id); setEditForm(ruleToForm(rule)); setEditErr(null); setEditEarliest(false); }}>Edit</button>
                            </>
                          )}
                          {deleting && (
                            <button className="btn danger-ghost btn-sm" disabled={deleteMut.isPending} onClick={() => deleteMut.mutate(rule.id)}>Delete</button>
                          )}
                        </div>
                      </div>
                      <div style={{ padding: "0 var(--s4) var(--s3)" }}>
                        <BudgetBars cache={(rule.cache as BudgetRuleCacheEntry[] | null) ?? []} />
                      </div>
                      {expanded && (
                        <div style={{ padding: "var(--s3) var(--s4)", borderTop: "1px solid var(--line)" }}>
                          <CacheTable cache={(rule.cache as BudgetRuleCacheEntry[] | null) ?? []} ruleType={rule.type} />
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )
      }
    </>
  );
}

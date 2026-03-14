import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buildAuthHeaders } from "../../lib/auth";
import type {
  BudgetRule,
  BudgetRuleCacheEntry,
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
  tag_id: string;
  start_date: string;
  type: BudgetRuleType;
  flat_amount: string;
  percent: string;
  calendar_window: CalendarWindow;
  rollover_options: RolloverOption;
};

const BLANK: FormState = {
  name: "",
  tag_id: "",
  start_date: new Date().toISOString().slice(0, 10),
  type: "flat_rate",
  flat_amount: "",
  percent: "",
  calendar_window: "month",
  rollover_options: "none"
};

const ruleToForm = (r: BudgetRule): FormState => ({
  name: r.name,
  tag_id: String(r.tag_id),
  start_date: r.start_date.slice(0, 10),
  type: r.type,
  flat_amount: r.flat_amount != null ? String(r.flat_amount) : "",
  percent: r.percent != null ? String(r.percent) : "",
  calendar_window: r.calendar_window,
  rollover_options: r.rollover_options
});

const formToBody = (f: FormState) => ({
  name: f.name.trim(),
  tag_id: Number(f.tag_id),
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

function RuleForm({ form, setForm, spendingTags, useEarliestStart, setUseEarliestStart, getEarliestStartDate, checkboxId, onSave, onCancel, isPending, error }: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  spendingTags: Tag[];
  useEarliestStart: boolean;
  setUseEarliestStart: (value: boolean) => void;
  getEarliestStartDate: (tagId: number) => Promise<string | null>;
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

  const handleTagChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextTagId = e.target.value;
    setForm((prev) => ({ ...prev, tag_id: nextTagId }));
    if (!useEarliestStart || !nextTagId) return;
    const earliest = await getEarliestStartDate(Number(nextTagId));
    if (!earliest) return;
    setForm((prev) => ({ ...prev, tag_id: nextTagId, start_date: earliest }));
  };

  const handleUseEarliestChange = async (checked: boolean) => {
    setUseEarliestStart(checked);
    if (!checked || !form.tag_id) return;
    const earliest = await getEarliestStartDate(Number(form.tag_id));
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
          <label className="form-label small mb-1">Tag</label>
          <select className="form-select form-select-sm" value={form.tag_id} onChange={(e) => void handleTagChange(e)}>
            <option value="">Select tag…</option>
            {spendingTags.length > 0 && (
              spendingTags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)
            )}
          </select>
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
              Use earliest tagged transaction
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
          disabled={isPending || !form.name.trim() || !form.tag_id}
          onClick={onSave}
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button className="btn btn-sm btn-outline-secondary px-3" onClick={onCancel}>Cancel</button>
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
          {cache.map((e, i) => (
            <tr key={i}>
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

  const getEarliestStartDate = async (tagId: number) => {
    if (!Number.isInteger(tagId)) return null;

    const txRows = queryClient
      .getQueriesData<TransactionBaseRow[]>({ queryKey: ["transactions"] })
      .flatMap(([, rows]) => (Array.isArray(rows) ? rows : []));
    const metaRows = queryClient.getQueryData<TransactionMetaRow[]>(["transaction_meta"]) ?? [];
    if (!txRows.length || !metaRows.length) return null;

    const metaByTxnId = new Map(metaRows.map((row) => [String(row.transaction_id ?? ""), row]));
    let earliestMs: number | null = null;

    for (const txn of txRows) {
      const txnId = String(txn.transaction_id ?? "");
      if (!txnId) continue;
      const meta = metaByTxnId.get(txnId);
      if (!meta) continue;
      if (meta.bucket_1_tag_id !== tagId && meta.bucket_2_tag_id !== tagId) continue;

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

  const rules = rulesQuery.data ?? [];

  return (
    <div className="card">
      <div className="card-body">
        <h6 className="card-title mb-1">Budget Rules</h6>
        <p className="text-muted small mb-3">Define spending targets per tag, tracked as rolling periods</p>

        {mode === "creating" ? (
          <RuleForm
            form={createForm}
            setForm={setCreateForm}
            spendingTags={spendingTags}
            useEarliestStart={createUseEarliestStart}
            setUseEarliestStart={setCreateUseEarliestStart}
            getEarliestStartDate={getEarliestStartDate}
            checkboxId="create-use-earliest-start-date"
            onSave={() => { setCreateError(null); createMutation.mutate(formToBody(createForm)); }}
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
              const tag = tagsById.get(rule.tag_id);
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
                        useEarliestStart={editUseEarliestStart}
                        setUseEarliestStart={setEditUseEarliestStart}
                        getEarliestStartDate={getEarliestStartDate}
                        checkboxId={`edit-use-earliest-start-date-${rule.id}`}
                        onSave={() => { setEditError(null); updateMutation.mutate({ id: rule.id, body: formToBody(editForm) }); }}
                        onCancel={() => { setEditingId(null); setEditError(null); setEditUseEarliestStart(false); }}
                        isPending={updateMutation.isPending}
                        error={editError}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="d-flex align-items-center gap-2 p-2 px-3 flex-wrap">
                        <span className="fw-semibold small">{rule.name}</span>
                        {tag && <span className="badge bg-secondary">{tag.name}</span>}
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
                          >
                            {isExpanded ? "▲" : "▼"} Periods
                          </button>
                          {mode !== "deleting" && (
                            <button
                              className="btn btn-sm btn-outline-secondary py-0"
                              onClick={() => { setEditingId(rule.id); setEditForm(ruleToForm(rule)); setEditError(null); setEditUseEarliestStart(false); }}
                            >
                              Edit
                            </button>
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

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buildAuthHeaders } from "../../lib/auth";
import type { BudgetRule, BudgetRuleCacheEntry, BudgetRuleType, CalendarWindow, RolloverOption, Tag } from "../types";
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

function RuleForm({ form, setForm, spendingTags, incomeTags, onSave, onCancel, isPending, error }: {
  form: FormState;
  setForm: (f: FormState) => void;
  spendingTags: Tag[];
  incomeTags: Tag[];
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
  error: string | null;
}) {
  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value });

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
          <select className="form-select form-select-sm" value={form.tag_id} onChange={set("tag_id")}>
            <option value="">Select tag…</option>
            {incomeTags.length > 0 && (
              <optgroup label="Income">
                {incomeTags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </optgroup>
            )}
            {spendingTags.length > 0 && (
              <optgroup label="Spending">
                {spendingTags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </optgroup>
            )}
          </select>
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label small mb-1">Start Date</label>
          <input type="date" className="form-control form-control-sm" value={form.start_date} onChange={set("start_date")} />
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
            <th className="text-end">Spending</th>
            {ruleType === "percent_of_income" && <th className="text-end">Income</th>}
            <th className="text-end">Rollover</th>
          </tr>
        </thead>
        <tbody>
          {cache.map((e, i) => (
            <tr key={i}>
              <td className="text-nowrap">{e.start_date} – {e.end_date}</td>
              <td className="text-end">${e.associated_spending.toFixed(2)}</td>
              {ruleType === "percent_of_income" && (
                <td className="text-end">{e.associated_income != null ? `$${e.associated_income.toFixed(2)}` : "—"}</td>
              )}
              <td className={`text-end ${e.rollover >= 0 ? "text-success" : "text-danger"}`}>
                {e.rollover >= 0 ? "+" : ""}${Math.abs(e.rollover).toFixed(2)}
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

  const tags = tagsQuery.data ?? [];
  const tagsById = useMemo(() => new Map(tags.map(t => [t.id, t])), [tags]);
  const spendingTags = useMemo(() => tags.filter(t => t.type.startsWith("spending")), [tags]);
  const incomeTags = useMemo(() => tags.filter(t => t.type.startsWith("income")), [tags]);

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
            incomeTags={incomeTags}
            onSave={() => { setCreateError(null); createMutation.mutate(formToBody(createForm)); }}
            onCancel={() => { setMode("default"); setCreateForm(BLANK); setCreateError(null); }}
            isPending={createMutation.isPending}
            error={createError}
          />
        ) : (
          <div className="d-flex gap-2 mb-3">
            <button
              className="btn btn-sm btn-outline-primary px-3"
              style={{ minWidth: 130 }}
              onClick={() => { setMode("creating"); setCreateForm(BLANK); setCreateError(null); }}
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
                        incomeTags={incomeTags}
                        onSave={() => { setEditError(null); updateMutation.mutate({ id: rule.id, body: formToBody(editForm) }); }}
                        onCancel={() => { setEditingId(null); setEditError(null); }}
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
                              onClick={() => { setEditingId(rule.id); setEditForm(ruleToForm(rule)); setEditError(null); }}
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

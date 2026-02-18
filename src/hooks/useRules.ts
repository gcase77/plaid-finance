import { useState, useCallback } from "react";
import type { BudgetRule, BudgetRuleStatus, BudgetRuleType, CalendarWindow, RolloverOption } from "../components/types";
import { buildAuthHeaders, type RuntimeAuthMode } from "../lib/auth";

const parseError = async (res: Response, fallback: string): Promise<string> => {
  try {
    const text = await res.text();
    try { return JSON.parse(text).error || fallback; } catch { return fallback; }
  } catch { return fallback; }
};

export type CreateRuleArgs = {
  tag_id: number;
  name: string;
  type: BudgetRuleType;
  flat_amount?: number;
  percent?: number;
  calendar_window: CalendarWindow;
  rollover_options: RolloverOption;
  start_date?: string;
  use_earliest_transaction?: boolean;
};

type UseRulesReturn = {
  rules: BudgetRule[];
  statuses: BudgetRuleStatus[];
  loading: boolean;
  error: string | null;
  loadRules: () => Promise<void>;
  createRule: (args: CreateRuleArgs) => Promise<BudgetRule>;
  deleteRule: (id: number) => Promise<void>;
};

export function useRules(token: string | null, runtimeAuthMode: RuntimeAuthMode): UseRulesReturn {
  const apiFetch = (url: string, options?: RequestInit) =>
    fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...buildAuthHeaders(runtimeAuthMode, token), ...options?.headers }
    });

  const [rules, setRules] = useState<BudgetRule[]>([]);
  const [statuses, setStatuses] = useState<BudgetRuleStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/budget-rules");
      if (!res.ok) throw new Error(await parseError(res, "Failed to load rules"));
      const data = await res.json();
      setRules(data.rules ?? []);
      setStatuses(data.statuses ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, runtimeAuthMode]);

  const createRule = useCallback(async (args: CreateRuleArgs): Promise<BudgetRule> => {
    const res = await apiFetch("/api/budget-rules", { method: "POST", body: JSON.stringify(args) });
    if (!res.ok) throw new Error(await parseError(res, "Failed to create rule"));
    const rule = await res.json();
    await loadRules();
    return rule;
  }, [token, runtimeAuthMode, loadRules]);

  const deleteRule = useCallback(async (id: number): Promise<void> => {
    const res = await apiFetch(`/api/budget-rules/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await parseError(res, "Failed to delete rule"));
    setRules((prev) => prev.filter((r) => r.id !== id));
    setStatuses((prev) => prev.filter((s) => s.rule_id !== id));
  }, [token, runtimeAuthMode]);

  return { rules, statuses, loading, error, loadRules, createRule, deleteRule };
}

import { useState, useMemo, useEffect, useCallback } from "react";
import type { Txn } from "../components/types";
import { formatCategoryLabel, formatCategorySubLabel } from "../utils/transactionUtils";
import { applyFilterTree, cloneWithNewIds, emptyGroup, type GroupNode } from "../utils/filterTree";

const STORAGE_KEY = "txn_filter_builder_v1";

export type SavedFilter = { name: string; tree: GroupNode };

type CategoryOptionGroup = {
  primary: string;
  primaryLabel: string;
  options: Array<{ value: string; label: string }>;
};

type FilterOptions = {
  bankOptions: Array<[string, string]>;
  accountOptions: Array<[string, string]>;
  categoryOptionsByPrimary: CategoryOptionGroup[];
};

export type UseTransactionFiltersReturn = {
  /** The root of the editable filter tree. */
  root: GroupNode;
  setRoot: (next: GroupNode) => void;
  clear: () => void;
  savedFilters: SavedFilter[];
  saveFilter: (name: string) => void;
  loadFilter: (name: string) => void;
  deleteFilter: (name: string) => void;
  derived: {
    filteredTransactions: Txn[];
    options: FilterOptions;
  };
};

const loadSaved = (): SavedFilter[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function useTransactionFilters(transactions: Txn[]): UseTransactionFiltersReturn {
  const [root, setRoot] = useState<GroupNode>(() => emptyGroup("and"));
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(loadSaved);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedFilters));
    } catch {
      // Ignore storage write failures (e.g. private mode / quota).
    }
  }, [savedFilters]);

  const clear = useCallback(() => setRoot(emptyGroup("and")), []);

  const saveFilter = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const tree = cloneWithNewIds(root) as GroupNode;
    setSavedFilters((prev) => {
      const without = prev.filter((f) => f.name !== trimmed);
      return [...without, { name: trimmed, tree }];
    });
  }, [root]);

  const loadFilter = useCallback((name: string) => {
    setSavedFilters((prev) => {
      const found = prev.find((f) => f.name === name);
      if (found) setRoot(cloneWithNewIds(found.tree) as GroupNode);
      return prev;
    });
  }, []);

  const deleteFilter = useCallback((name: string) => {
    setSavedFilters((prev) => prev.filter((f) => f.name !== name));
  }, []);

  const filteredTransactions = useMemo(() => applyFilterTree(root, transactions), [root, transactions]);

  const bankOptions = useMemo(() => {
    const m = new Map<string, string>();
    transactions.forEach((t) => {
      const id = String(t.item_id || "");
      const label = t.institution_name || id;
      if (id && label) m.set(id, label);
    });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [transactions]);

  const accountOptions = useMemo(() => {
    const m = new Map<string, string>();
    transactions.forEach((t) => {
      const id = String(t.account_id || "");
      const label = t.account_name || t.account_official_name || id;
      if (id && label) m.set(id, label);
    });
    return [...m.entries()];
  }, [transactions]);

  const categoryOptionsByPrimary = useMemo(() => {
    const groups = new Map<string, Set<string>>();
    transactions.forEach((t) => {
      const primary = String(t.personal_finance_category?.primary || t.personal_finance_category?.detailed || "").trim();
      const value = String(t.personal_finance_category?.detailed || t.personal_finance_category?.primary || "").trim();
      if (!primary || !value) return;
      if (!groups.has(primary)) groups.set(primary, new Set<string>());
      groups.get(primary)?.add(value);
    });
    return [...groups.entries()]
      .map(([primary, valueSet]) => ({
        primary,
        primaryLabel: formatCategoryLabel(primary),
        options: [...valueSet].sort().map((value) => ({ value, label: formatCategorySubLabel(primary, value) }))
      }))
      .sort((a, b) => a.primaryLabel.localeCompare(b.primaryLabel));
  }, [transactions]);

  return {
    root,
    setRoot,
    clear,
    savedFilters,
    saveFilter,
    loadFilter,
    deleteFilter,
    derived: {
      filteredTransactions,
      options: { bankOptions, accountOptions, categoryOptionsByPrimary }
    }
  };
}

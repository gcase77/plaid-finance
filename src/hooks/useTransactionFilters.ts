import { useState, useMemo } from "react";
import type { TextMode, TagStateFilter, Txn } from "../components/types";
import { buildDatePreset } from "../utils/datePresets";
import { formatCategoryLabel, formatCategorySubLabel, getTxnDateOnly } from "../utils/transactionUtils";

type CategoryOptionGroup = {
  primary: string;
  primaryLabel: string;
  options: Array<{ value: string; label: string }>;
};

export type TransactionFilterState = {
  nameMode: TextMode;
  nameFilter: string;
  merchantMode: TextMode;
  merchantFilter: string;
  selectedBanks: string[];
  selectedAccounts: string[];
  selectedCategories: string[];
  amountMin: string;
  amountMax: string;
  dateStart: string;
  dateEnd: string;
  tagStateFilter: TagStateFilter;
  selectedTagIds: number[];
  filterOperator: "and" | "or";
};

export type TransactionFilterActions = {
  setNameMode: (v: TextMode) => void;
  setNameFilter: (v: string) => void;
  setMerchantMode: (v: TextMode) => void;
  setMerchantFilter: (v: string) => void;
  setSelectedBanks: (v: string[]) => void;
  setSelectedAccounts: (v: string[]) => void;
  setSelectedCategories: (v: string[]) => void;
  setAmountMin: (v: string) => void;
  setAmountMax: (v: string) => void;
  setDateStart: (v: string) => void;
  setDateEnd: (v: string) => void;
  setTagStateFilter: (v: TagStateFilter) => void;
  setSelectedTagIds: (v: number[]) => void;
  setFilterOperator: (v: "and" | "or") => void;
  clearAllFilters: () => void;
  applyDatePreset: (preset: string) => void;
};

type TransactionFilterDerived = {
  filteredTransactions: Txn[];
  options: {
    bankOptions: Array<[string, string]>;
    accountOptions: Array<[string, string]>;
    categoryOptionsByPrimary: CategoryOptionGroup[];
  };
};

export type UseTransactionFiltersReturn = {
  state: TransactionFilterState;
  actions: TransactionFilterActions;
  derived: TransactionFilterDerived;
};

export function useTransactionFilters(transactions: Txn[]): UseTransactionFiltersReturn {
  const [nameMode, setNameMode] = useState<TextMode>("contains");
  const [nameFilter, setNameFilter] = useState("");
  const [merchantMode, setMerchantMode] = useState<TextMode>("contains");
  const [merchantFilter, setMerchantFilter] = useState("");
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [amountMin, setAmountMin] = useState<string>("");
  const [amountMax, setAmountMax] = useState<string>("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [tagStateFilter, setTagStateFilter] = useState<TagStateFilter>("all");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [filterOperator, setFilterOperator] = useState<"and" | "or">("and");

  const filteredTransactions = useMemo(() => {
    const minVal = amountMin.trim() ? Number(amountMin) : null;
    const maxVal = amountMax.trim() ? Number(amountMax) : null;
    const predicates: Array<(t: Txn) => boolean> = [];

    if (nameFilter.trim()) {
      const q = nameFilter.toLowerCase().trim();
      predicates.push((t) => nameMode === "not" ? !(t.name || "").toLowerCase().includes(q) : (t.name || "").toLowerCase().includes(q));
    }
    if (merchantMode === "null") {
      predicates.push((t) => !t.merchant_name);
    } else if (merchantFilter.trim()) {
      const q = merchantFilter.toLowerCase().trim();
      predicates.push((t) => merchantMode === "not" ? !(t.merchant_name || "").toLowerCase().includes(q) : (t.merchant_name || "").toLowerCase().includes(q));
    }
    if (selectedBanks.length) predicates.push((t) => selectedBanks.includes(String(t.item_id || "")));
    if (selectedAccounts.length) predicates.push((t) => selectedAccounts.includes(String(t.account_id || "")));
    if (selectedCategories.length) predicates.push((t) => {
      const cat = t.personal_finance_category?.detailed || t.personal_finance_category?.primary || "";
      return selectedCategories.includes(cat);
    });
    if (minVal !== null && Number.isFinite(minVal)) {
      predicates.push((t) => {
        const amt = Number(t.amount || 0);
        // Inclusive bounds: UI labels use "≥"/"≤".
        return amt >= minVal;
      });
    }
    if (maxVal !== null && Number.isFinite(maxVal)) {
      predicates.push((t) => {
        const amt = Number(t.amount || 0);
        return amt <= maxVal;
      });
    }
    if (dateStart || dateEnd) {
      predicates.push((t) => {
        const rawDate = getTxnDateOnly(t);
        if (!rawDate) return false;
        const d = new Date(`${rawDate}T00:00:00`);
        if (Number.isNaN(d.valueOf())) return false;
        if (dateStart && d < new Date(`${dateStart}T00:00:00`)) return false;
        if (dateEnd && d > new Date(`${dateEnd}T23:59:59`)) return false;
        return true;
      });
    }
    if (tagStateFilter !== "all") {
      predicates.push((t) => {
        const hasAnyTag = t.account_transfer_group != null
          || t.bucket_1_tag_id != null
          || t.bucket_2_tag_id != null
          || (t.meta_tag_ids?.length ?? 0) > 0;
        if (tagStateFilter === "untagged") return !hasAnyTag;
        if (tagStateFilter === "tagged") return hasAnyTag;
        return true;
      });
    }
    if (selectedTagIds.length) {
      predicates.push((t) =>
        selectedTagIds.includes(t.bucket_1_tag_id ?? -1)
        || selectedTagIds.includes(t.bucket_2_tag_id ?? -1)
        || (t.meta_tag_ids?.some((id) => selectedTagIds.includes(id)) ?? false)
      );
    }

    if (!predicates.length) return transactions;
    return transactions.filter((t) =>
      filterOperator === "or" ? predicates.some((p) => p(t)) : predicates.every((p) => p(t))
    );
  }, [transactions, filterOperator, nameFilter, nameMode, merchantFilter, merchantMode, selectedBanks, selectedAccounts, selectedCategories, amountMin, amountMax, dateStart, dateEnd, tagStateFilter, selectedTagIds]);

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
        options: [...valueSet]
          .sort()
          .map((value) => ({ value, label: formatCategorySubLabel(primary, value) }))
      }))
      .sort((a, b) => a.primaryLabel.localeCompare(b.primaryLabel));
  }, [transactions]);

  const clearAllFilters = () => {
    setNameMode("contains");
    setNameFilter("");
    setMerchantMode("contains");
    setMerchantFilter("");
    setSelectedBanks([]);
    setSelectedAccounts([]);
    setSelectedCategories([]);
    setAmountMin("");
    setAmountMax("");
    setDateStart("");
    setDateEnd("");
    setTagStateFilter("all");
    setSelectedTagIds([]);
  };

  const applyDatePreset = (preset: string) => {
    const d = buildDatePreset(preset);
    setDateStart(d.start);
    setDateEnd(d.end);
  };

  return {
    state: {
      nameMode,
      nameFilter,
      merchantMode,
      merchantFilter,
      selectedBanks,
      selectedAccounts,
      selectedCategories,
      amountMin,
      amountMax,
      dateStart,
      dateEnd,
      tagStateFilter,
      selectedTagIds,
      filterOperator
    },
    actions: {
      setNameMode,
      setNameFilter,
      setMerchantMode,
      setMerchantFilter,
      setSelectedBanks,
      setSelectedAccounts,
      setSelectedCategories,
      setAmountMin,
      setAmountMax,
      setDateStart,
      setDateEnd,
      setTagStateFilter,
      setSelectedTagIds,
      setFilterOperator,
      clearAllFilters,
      applyDatePreset
    },
    derived: {
      filteredTransactions,
      options: {
        bankOptions,
        accountOptions,
        categoryOptionsByPrimary
      }
    }
  };
}

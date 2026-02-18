import { useState, useMemo } from "react";
import type { TextMode, AmountMode, TagStateFilter, Txn } from "../components/types";
import { getTxnDateOnly } from "../utils/transactionUtils";

type UseTransactionFiltersReturn = {
  nameMode: TextMode;
  setNameMode: (v: TextMode) => void;
  nameFilter: string;
  setNameFilter: (v: string) => void;
  merchantMode: TextMode;
  setMerchantMode: (v: TextMode) => void;
  merchantFilter: string;
  setMerchantFilter: (v: string) => void;
  selectedBanks: string[];
  setSelectedBanks: (v: string[]) => void;
  selectedAccounts: string[];
  setSelectedAccounts: (v: string[]) => void;
  selectedCategories: string[];
  setSelectedCategories: (v: string[]) => void;
  amountMode: AmountMode;
  setAmountMode: (v: AmountMode) => void;
  amountFilter: string;
  setAmountFilter: (v: string) => void;
  dateStart: string;
  setDateStart: (v: string) => void;
  dateEnd: string;
  setDateEnd: (v: string) => void;
  tagStateFilter: TagStateFilter;
  setTagStateFilter: (v: TagStateFilter) => void;
  selectedTagIds: number[];
  setSelectedTagIds: (v: number[]) => void;
  filterOperator: "and" | "or";
  setFilterOperator: (v: "and" | "or") => void;
  filteredTransactions: Txn[];
  bankOptions: Array<[string, string]>;
  accountOptions: Array<[string, string]>;
  categoryOptions: string[];
  clearAllFilters: () => void;
};

export function useTransactionFilters(transactions: Txn[]): UseTransactionFiltersReturn {
  const [nameMode, setNameMode] = useState<TextMode>("contains");
  const [nameFilter, setNameFilter] = useState("");
  const [merchantMode, setMerchantMode] = useState<TextMode>("contains");
  const [merchantFilter, setMerchantFilter] = useState("");
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [amountMode, setAmountMode] = useState<AmountMode>("");
  const [amountFilter, setAmountFilter] = useState<string>("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [tagStateFilter, setTagStateFilter] = useState<TagStateFilter>("all");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [filterOperator, setFilterOperator] = useState<"and" | "or">("and");

  const filteredTransactions = useMemo(() => {
    const minAmount = amountFilter.trim() ? Number(amountFilter) : null;
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
    if (amountMode && minAmount !== null && Number.isFinite(minAmount)) {
      predicates.push((t) => {
        const amt = Number(t.amount || 0);
        return amountMode === "gt" ? amt > minAmount : amt < minAmount;
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
        const hasBucket = t.bucket_1_tag_id != null;
        if (tagStateFilter === "untagged") return !hasBucket;
        if (tagStateFilter === "tagged") return hasBucket;
        return true;
      });
    }
    if (selectedTagIds.length) {
      predicates.push((t) =>
        selectedTagIds.includes(t.bucket_1_tag_id ?? -1)
        || selectedTagIds.includes(t.bucket_2_tag_id ?? -1)
        || selectedTagIds.includes(t.meta_tag_id ?? -1)
      );
    }

    if (!predicates.length) return transactions;
    return transactions.filter((t) =>
      filterOperator === "or" ? predicates.some((p) => p(t)) : predicates.every((p) => p(t))
    );
  }, [transactions, filterOperator, nameFilter, nameMode, merchantFilter, merchantMode, selectedBanks, selectedAccounts, selectedCategories, amountFilter, amountMode, dateStart, dateEnd, tagStateFilter, selectedTagIds]);

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

  const categoryOptions = useMemo(() => {
    const s = new Set<string>();
    transactions.forEach((t) => {
      const cat = t.personal_finance_category?.detailed || t.personal_finance_category?.primary;
      if (cat) s.add(cat);
    });
    return [...s].sort();
  }, [transactions]);

  const clearAllFilters = () => {
    setNameMode("contains");
    setNameFilter("");
    setMerchantMode("contains");
    setMerchantFilter("");
    setSelectedBanks([]);
    setSelectedAccounts([]);
    setSelectedCategories([]);
    setAmountMode("");
    setAmountFilter("");
    setDateStart("");
    setDateEnd("");
    setTagStateFilter("all");
    setSelectedTagIds([]);
  };

  return {
    nameMode,
    setNameMode,
    nameFilter,
    setNameFilter,
    merchantMode,
    setMerchantMode,
    merchantFilter,
    setMerchantFilter,
    selectedBanks,
    setSelectedBanks,
    selectedAccounts,
    setSelectedAccounts,
    selectedCategories,
    setSelectedCategories,
    amountMode,
    setAmountMode,
    amountFilter,
    setAmountFilter,
    dateStart,
    setDateStart,
    dateEnd,
    setDateEnd,
    tagStateFilter,
    setTagStateFilter,
    selectedTagIds,
    setSelectedTagIds,
    filterOperator,
    setFilterOperator,
    filteredTransactions,
    bankOptions,
    accountOptions,
    categoryOptions,
    clearAllFilters
  };
}

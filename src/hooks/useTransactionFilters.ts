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

  const filteredTransactions = useMemo(() => {
    const minAmount = amountFilter.trim() ? Number(amountFilter) : null;
    return transactions.filter((t) => {
      const name = (t.name || "").toLowerCase();
      const merchant = (t.merchant_name || "").toLowerCase();
      const cat = t.personal_finance_category?.detailed || t.personal_finance_category?.primary || "";
      if (nameFilter.trim()) {
        const q = nameFilter.toLowerCase().trim();
        if (nameMode === "not" && name.includes(q)) return false;
        if (nameMode !== "not" && !name.includes(q)) return false;
      }
      if (merchantMode === "null") {
        if (t.merchant_name) return false;
      } else if (merchantFilter.trim()) {
        const q = merchantFilter.toLowerCase().trim();
        if (merchantMode === "not" && merchant.includes(q)) return false;
        if (merchantMode !== "not" && !merchant.includes(q)) return false;
      }
      if (selectedBanks.length && !selectedBanks.includes(String(t.item_id || ""))) return false;
      if (selectedAccounts.length && !selectedAccounts.includes(String(t.account_id || ""))) return false;
      if (selectedCategories.length && !selectedCategories.includes(cat)) return false;
      if (amountMode && minAmount !== null && Number.isFinite(minAmount)) {
        const amt = Number(t.amount || 0);
        if (amountMode === "gt" && !(amt > minAmount)) return false;
        if (amountMode === "lt" && !(amt < minAmount)) return false;
      }
      const rawDate = getTxnDateOnly(t);
      if (dateStart || dateEnd) {
        if (!rawDate) return false;
        const d = new Date(`${rawDate}T00:00:00`);
        if (Number.isNaN(d.valueOf())) return false;
        if (dateStart && d < new Date(`${dateStart}T00:00:00`)) return false;
        if (dateEnd && d > new Date(`${dateEnd}T23:59:59`)) return false;
      }
      if (tagStateFilter !== "all") {
        const isTransfer = !!t.account_transfer_group;
        const hasBucket = t.bucket_1_tag_id != null;
        const hasMeta = t.meta_tag_id != null;
        if (tagStateFilter === "transfer" && !isTransfer) return false;
        if (tagStateFilter === "untagged" && (isTransfer || hasBucket)) return false;
        if (tagStateFilter === "tagged" && !hasBucket) return false;
        if (tagStateFilter === "meta_only" && (hasBucket || isTransfer || !hasMeta)) return false;
      }
      if (selectedTagIds.length) {
        const match = selectedTagIds.includes(t.bucket_1_tag_id ?? -1)
          || selectedTagIds.includes(t.bucket_2_tag_id ?? -1)
          || selectedTagIds.includes(t.meta_tag_id ?? -1);
        if (!match) return false;
      }
      return true;
    });
  }, [transactions, nameFilter, nameMode, merchantFilter, merchantMode, selectedBanks, selectedAccounts, selectedCategories, amountFilter, amountMode, dateStart, dateEnd, tagStateFilter, selectedTagIds]);

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
    filteredTransactions,
    bankOptions,
    accountOptions,
    categoryOptions,
    clearAllFilters
  };
}

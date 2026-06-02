import { useState, useMemo } from "react";
import type { MissingTagFilter, TagStateFilter, TextMode, Txn } from "../components/types";
import { buildDatePreset } from "../utils/datePresets";
import { formatCategoryLabel, formatCategorySubLabel } from "../utils/transactionUtils";
import {
  applyFilterTree,
  conditionNode,
  emptyGroup,
  isConditionActive,
  newNodeId,
  type Condition,
  type FilterNode,
  type FilterOp,
  type GroupNode
} from "../utils/filterTree";

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
  missingTagFilter: MissingTagFilter;
  selectedTagIds: number[];
  filterOperator: "and" | "or";
  savedGroups: GroupNode[];
  groupsOperator: FilterOp;
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
  setMissingTagFilter: (v: MissingTagFilter) => void;
  setSelectedTagIds: (v: number[]) => void;
  setFilterOperator: (v: "and" | "or") => void;
  setGroupsOperator: (v: FilterOp) => void;
  addCurrentAsGroup: () => void;
  removeGroup: (id: string) => void;
  clearGroups: () => void;
  clearAllFilters: () => void;
  applyDatePreset: (preset: string) => void;
};

type TransactionFilterDerived = {
  filteredTransactions: Txn[];
  /** Live group built from the current panel selections (the "draft" group). */
  draftGroup: GroupNode;
  /** The full tree actually applied: saved groups + the live draft group, combined by `groupsOperator`. */
  rootNode: GroupNode;
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
  const [missingTagFilter, setMissingTagFilter] = useState<MissingTagFilter>("all");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [filterOperator, setFilterOperator] = useState<"and" | "or">("and");
  const [savedGroups, setSavedGroups] = useState<GroupNode[]>([]);
  const [groupsOperator, setGroupsOperator] = useState<FilterOp>("or");

  // The active conditions described by the current panel selections.
  const draftConditions = useMemo<Condition[]>(() => {
    const all: Condition[] = [
      { kind: "name", mode: nameMode === "null" ? "contains" : nameMode, value: nameFilter },
      { kind: "merchant", mode: merchantMode, value: merchantFilter },
      { kind: "bank", ids: selectedBanks },
      { kind: "account", ids: selectedAccounts },
      { kind: "category", values: selectedCategories },
      { kind: "amount", min: amountMin, max: amountMax },
      { kind: "date", start: dateStart, end: dateEnd },
      { kind: "tagState", value: tagStateFilter },
      { kind: "missingTag", value: missingTagFilter },
      { kind: "tags", ids: selectedTagIds }
    ];
    return all.filter(isConditionActive);
  }, [nameMode, nameFilter, merchantMode, merchantFilter, selectedBanks, selectedAccounts, selectedCategories, amountMin, amountMax, dateStart, dateEnd, tagStateFilter, missingTagFilter, selectedTagIds]);

  // The live "draft" group: the current panel selections joined by `filterOperator`.
  const draftGroup = useMemo<GroupNode>(() => ({
    id: "draft",
    type: "group",
    op: filterOperator,
    negate: false,
    children: draftConditions.map(conditionNode)
  }), [filterOperator, draftConditions]);

  // The full tree: saved groups plus the live draft, combined by `groupsOperator`.
  const rootNode = useMemo<GroupNode>(() => {
    const children: FilterNode[] = [...savedGroups];
    if (draftGroup.children.length) children.push(draftGroup);
    return { id: "root", type: "group", op: groupsOperator, negate: false, children };
  }, [savedGroups, draftGroup, groupsOperator]);

  const filteredTransactions = useMemo(
    () => (rootNode.children.length ? applyFilterTree(rootNode, transactions) : transactions),
    [rootNode, transactions]
  );

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

  const resetDraft = () => {
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
    setMissingTagFilter("all");
    setSelectedTagIds([]);
  };

  const clearAllFilters = () => {
    resetDraft();
    setSavedGroups([]);
  };

  // Snapshot the current panel selections into a reusable group, then reset the panel.
  const addCurrentAsGroup = () => {
    if (!draftConditions.length) return;
    const group: GroupNode = {
      ...emptyGroup(filterOperator),
      id: newNodeId(),
      children: draftConditions.map(conditionNode)
    };
    setSavedGroups((prev) => [...prev, group]);
    resetDraft();
  };

  const removeGroup = (id: string) => setSavedGroups((prev) => prev.filter((g) => g.id !== id));
  const clearGroups = () => setSavedGroups([]);

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
      missingTagFilter,
      selectedTagIds,
      filterOperator,
      savedGroups,
      groupsOperator
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
      setMissingTagFilter,
      setSelectedTagIds,
      setFilterOperator,
      setGroupsOperator,
      addCurrentAsGroup,
      removeGroup,
      clearGroups,
      clearAllFilters,
      applyDatePreset
    },
    derived: {
      filteredTransactions,
      draftGroup,
      rootNode,
      options: {
        bankOptions,
        accountOptions,
        categoryOptionsByPrimary
      }
    }
  };
}

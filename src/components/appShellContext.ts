import type { Account, Item } from "./types";
import type { UseTransactionFiltersReturn } from "../hooks/useTransactionFilters";

export type AppShellContextValue = {
  userEmail: string;
  signOut: () => Promise<void>;
  linkBank: (daysRequested?: number) => Promise<void>;
  loadingItems: boolean;
  items: Item[];
  accountsByItem: Record<string, Account[]>;
  syncTransactions: () => Promise<void>;
  syncStatus: string;
  filters: UseTransactionFiltersReturn;
  loadingTxns: boolean;
};

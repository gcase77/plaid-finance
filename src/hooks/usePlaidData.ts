import { useState } from "react";
import type { Item, Account, Txn } from "../components/types";
import { buildAuthHeaders } from "../lib/auth";

type UsePlaidDataReturn = {
  items: Item[];
  accountsByItem: Record<string, Account[]>;
  transactions: Txn[];
  syncStatus: string;
  loadingItems: boolean;
  loadingTxns: boolean;
  loadItems: (userId?: string | null, token?: string | null) => Promise<void>;
  loadTransactions: (userId?: string | null, token?: string | null) => Promise<void>;
  syncTransactions: () => Promise<void>;
  linkBank: (daysRequested?: number) => Promise<void>;
};

export function usePlaidData(userId: string | null, token: string | null): UsePlaidDataReturn {
  const [items, setItems] = useState<Item[]>([]);
  const [accountsByItem, setAccountsByItem] = useState<Record<string, Account[]>>({});
  const [transactions, setTransactions] = useState<Txn[]>([]);
  const [syncStatus, setSyncStatus] = useState("No sync yet");
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingTxns, setLoadingTxns] = useState(false);

  const fetchWithAuth = async (url: string, options: RequestInit = {}, tokenOverride?: string | null) => {
    const resolvedToken = tokenOverride || token;
    return fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), ...buildAuthHeaders(resolvedToken) }
    });
  };

  const loadTransactions = async (uid?: string | null, tk?: string | null) => {
    if (!(uid || userId)) return;
    setLoadingTxns(true);
    try {
      const res = await fetchWithAuth("/api/transactions", {}, tk);
      const data = res.ok ? await res.json() : [];
      setTransactions(Array.isArray(data) ? data : []);
    } finally {
      setLoadingTxns(false);
    }
  };

  const loadItems = async (uid?: string | null, tk?: string | null) => {
    if (!(uid || userId)) return;
    setLoadingItems(true);
    try {
      const itemsRes = await fetchWithAuth("/api/items", {}, tk);
      const nextItems = itemsRes.ok ? ((await itemsRes.json()) as Item[]) : [];
      setItems(nextItems);
      const byItem: Record<string, Account[]> = {};
      await Promise.all(
        nextItems.map(async (item) => {
          const r = await fetchWithAuth(`/api/accounts/${item.id}`, {}, tk);
          byItem[item.id] = r.ok ? ((await r.json()) as Account[]) : [];
        })
      );
      setAccountsByItem(byItem);
      await loadTransactions(uid, tk);
    } finally {
      setLoadingItems(false);
    }
  };

  const syncTransactions = async () => {
    if (!userId) return;
    setLoadingTxns(true);
    try {
      const result = await fetchWithAuth("/api/transactions/sync", { method: "POST" }).then((r) => r.json());
      if (!result?.error) setSyncStatus(`${result.modified || 0} modified, ${result.added || 0} added, ${result.removed || 0} removed`);
      await loadTransactions();
    } finally {
      setLoadingTxns(false);
    }
  };

  const linkBank = async (daysRequested = 730) => {
    if (!userId) return;
    const sanitizedDaysRequested = Math.min(730, Math.max(1, Number.isFinite(daysRequested) ? Math.floor(daysRequested) : 730));
    const linkTokenRes = await fetchWithAuth("/api/link-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daysRequested: sanitizedDaysRequested })
    });
    const data = await linkTokenRes.json();
    if (!data?.link_token || !window.Plaid) return;
    window.Plaid.create({
      token: data.link_token,
      onSuccess: async (publicToken: string) => {
        await fetchWithAuth("/api/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicToken })
        });
        await loadItems();
      }
    }).open();
  };

  return {
    items,
    accountsByItem,
    transactions,
    syncStatus,
    loadingItems,
    loadingTxns,
    loadItems,
    loadTransactions,
    syncTransactions,
    linkBank
  };
}

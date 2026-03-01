import { useState } from "react";
import type { Item, Account } from "../components/types";
import { buildAuthHeaders } from "../lib/auth";

type UsePlaidDataReturn = {
  items: Item[];
  accountsByItem: Record<string, Account[]>;
  loadingItems: boolean;
  loadItems: (userId?: string | null, token?: string | null) => Promise<void>;
  linkBank: (daysRequested?: number) => Promise<void>;
};

export function usePlaidData(userId: string | null, token: string | null): UsePlaidDataReturn {
  const [items, setItems] = useState<Item[]>([]);
  const [accountsByItem, setAccountsByItem] = useState<Record<string, Account[]>>({});
  const [loadingItems, setLoadingItems] = useState(false);

  const fetchWithAuth = async (url: string, options: RequestInit = {}, tokenOverride?: string | null) => {
    const resolvedToken = tokenOverride || token;
    return fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), ...buildAuthHeaders(resolvedToken) }
    });
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
    } finally {
      setLoadingItems(false);
    }
  };

  const linkBank = async (daysRequested = 730) => {
    if (!userId) return;
    const sanitizedDaysRequested = Math.min(730, Math.max(1, Number.isFinite(daysRequested) ? Math.floor(daysRequested) : 730));
    const linkTokenRes = await fetchWithAuth("/api/link/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daysRequested: sanitizedDaysRequested })
    });
    const data = await linkTokenRes.json();
    if (!data?.link_token || !window.Plaid) return;
    window.Plaid.create({
      token: data.link_token,
      onSuccess: async (publicToken: string) => {
        await fetchWithAuth("/api/link/exchange", {
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
    loadingItems,
    loadItems,
    linkBank
  };
}

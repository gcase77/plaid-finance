import { useEffect, useState } from "react";
import type { Item, Account } from "../components/types";
import { dataProvider } from "../providers/dataProvider";

const PLAID_LINK_TOKEN_KEY = "plaid_link_token";

export type DeleteItemResult =
  | { ok: true; plaidRemoved: boolean; plaidError?: string }
  | { ok: false; error: string };
export type RefreshAccountsResult =
  | { ok: true; updatedAccounts: number }
  | { ok: false; error: string };

type UsePlaidDataReturn = {
  items: Item[];
  accountsByItem: Record<string, Account[]>;
  loadingItems: boolean;
  loadItems: (userId?: string | null, token?: string | null) => Promise<void>;
  linkBank: (daysRequested?: number) => Promise<void>;
  deleteItem: (itemId: string) => Promise<DeleteItemResult>;
  refreshItemAccounts: (itemId: string) => Promise<RefreshAccountsResult>;
};

export function usePlaidData(userId: string | null, token: string | null): UsePlaidDataReturn {
  const [items, setItems] = useState<Item[]>([]);
  const [accountsByItem, setAccountsByItem] = useState<Record<string, Account[]>>({});
  const [loadingItems, setLoadingItems] = useState(false);
  const loadItems = async (uid?: string | null, tk?: string | null) => {
    void tk;
    if (!(uid || userId)) return;
    setLoadingItems(true);
    try {
      const itemsResult = await dataProvider.getList<Item>({ resource: "items" });
      const nextItems = Array.isArray(itemsResult.data) ? itemsResult.data : [];
      setItems(nextItems);
      const byItem: Record<string, Account[]> = {};
      await Promise.all(
        nextItems.map(async (item) => {
          const result = await dataProvider.getList<Account>({ resource: "accounts", meta: { itemId: item.id } });
          byItem[item.id] = Array.isArray(result.data) ? result.data : [];
        })
      );
      setAccountsByItem(byItem);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    if (!userId || !token || !window.Plaid) return;
    if (!new URLSearchParams(window.location.search).get("oauth_state_id")) return;
    const linkToken = sessionStorage.getItem(PLAID_LINK_TOKEN_KEY);
    if (!linkToken) return;
    const handler = window.Plaid.create({
      token: linkToken,
      receivedRedirectUri: window.location.href,
      onSuccess: async (publicToken: string) => {
        await dataProvider.custom?.({
          url: "/api/link/exchange",
          method: "post",
          payload: { publicToken }
        });
        sessionStorage.removeItem(PLAID_LINK_TOKEN_KEY);
        await loadItems(userId, token);
        window.history.replaceState({}, "", window.location.pathname);
      },
      onExit: () => {
        sessionStorage.removeItem(PLAID_LINK_TOKEN_KEY);
        window.history.replaceState({}, "", window.location.pathname);
      }
    });
    handler.open();
    return () => handler.exit?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- OAuth return after session restore; omit loadItems/dataProvider
  }, [userId, token]);

  const linkBank = async (daysRequested = 730) => {
    if (!userId) return;
    const sanitizedDaysRequested = Math.min(730, Math.max(1, Number.isFinite(daysRequested) ? Math.floor(daysRequested) : 730));
    const linkTokenResult = await dataProvider.custom?.({
      url: "/api/link/token",
      method: "post",
      payload: { daysRequested: sanitizedDaysRequested }
    });
    const data = linkTokenResult?.data as { link_token?: string } | undefined;
    if (!data?.link_token || !window.Plaid) return;
    sessionStorage.setItem(PLAID_LINK_TOKEN_KEY, data.link_token);
    window.Plaid.create({
      token: data.link_token,
      onSuccess: async (publicToken: string) => {
        await dataProvider.custom?.({
          url: "/api/link/exchange",
          method: "post",
          payload: { publicToken }
        });
        sessionStorage.removeItem(PLAID_LINK_TOKEN_KEY);
        await loadItems();
      },
      onExit: () => sessionStorage.removeItem(PLAID_LINK_TOKEN_KEY)
    }).open();
  };

  const deleteItem = async (itemId: string): Promise<DeleteItemResult> => {
    if (!token) return { ok: false, error: "Not signed in" };
    try {
      const result = await dataProvider.deleteOne?.({ resource: "items", id: itemId });
      const data = (result?.data ?? {}) as { plaid_removed?: boolean; plaid_error?: string };
      await loadItems();
      return { ok: true, plaidRemoved: data.plaid_removed !== false, plaidError: data.plaid_error };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Delete failed" };
    }
  };

  const refreshItemAccounts = async (itemId: string): Promise<RefreshAccountsResult> => {
    try {
      const result = await dataProvider.custom?.({
        url: `/api/${encodeURIComponent(itemId)}/accounts/refresh`,
        method: "post"
      });
      const data = (result?.data ?? {}) as { updated_accounts?: number };
      await loadItems();
      return { ok: true, updatedAccounts: typeof data.updated_accounts === "number" ? data.updated_accounts : 0 };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Refresh failed" };
    }
  };

  return {
    items,
    accountsByItem,
    loadingItems,
    loadItems,
    linkBank,
    deleteItem,
    refreshItemAccounts
  };
}

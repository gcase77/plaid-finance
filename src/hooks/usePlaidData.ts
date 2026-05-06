import { useEffect, useState } from "react";
import type { Item, Account } from "../components/types";
import { useRefineDataProvider } from "../providers/refineContext";

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
  const dataProvider = useRefineDataProvider();

  const loadItems = async (uid?: string | null, tk?: string | null) => {
    if (!(uid || userId)) return;
    setLoadingItems(true);
    try {
      void tk;
      const nextItems = await dataProvider.getList<Item>({ resource: "items" }).catch(() => []);
      setItems(nextItems);
      const byItem: Record<string, Account[]> = {};
      await Promise.all(
        nextItems.map(async (item) => {
          byItem[item.id] = await dataProvider.getList<Account>({ resource: `${encodeURIComponent(item.id)}/accounts` }).catch(() => []);
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
        await dataProvider.custom({ url: "link/exchange", method: "POST", variables: { publicToken } });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- OAuth return after session restore; omit loadItems/fetchWithAuth
  }, [userId, token]);

  const linkBank = async (daysRequested = 730) => {
    if (!userId) return;
    const sanitizedDaysRequested = Math.min(730, Math.max(1, Number.isFinite(daysRequested) ? Math.floor(daysRequested) : 730));
    const data = await dataProvider.custom<{ link_token?: string }>({
      url: "link/token",
      method: "POST",
      variables: { daysRequested: sanitizedDaysRequested }
    });
    if (!data?.link_token || !window.Plaid) return;
    sessionStorage.setItem(PLAID_LINK_TOKEN_KEY, data.link_token);
    window.Plaid.create({
      token: data.link_token,
      onSuccess: async (publicToken: string) => {
        await dataProvider.custom({ url: "link/exchange", method: "POST", variables: { publicToken } });
        sessionStorage.removeItem(PLAID_LINK_TOKEN_KEY);
        await loadItems();
      },
      onExit: () => sessionStorage.removeItem(PLAID_LINK_TOKEN_KEY)
    }).open();
  };

  const deleteItem = async (itemId: string): Promise<DeleteItemResult> => {
    if (!token) return { ok: false, error: "Not signed in" };
    let data: { error?: string; plaid_removed?: boolean; plaid_error?: string };
    try {
      data = await dataProvider.custom({ url: `items/${encodeURIComponent(itemId)}/delete_all`, method: "POST" });
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Delete failed" };
    }
    await loadItems();
    return { ok: true, plaidRemoved: data.plaid_removed !== false, plaidError: data.plaid_error };
  };

  const refreshItemAccounts = async (itemId: string): Promise<RefreshAccountsResult> => {
    let data: { error?: string; updated_accounts?: number };
    try {
      data = await dataProvider.custom({ url: `${encodeURIComponent(itemId)}/accounts/refresh`, method: "POST" });
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Refresh failed" };
    }
    await loadItems();
    return { ok: true, updatedAccounts: typeof data.updated_accounts === "number" ? data.updated_accounts : 0 };
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

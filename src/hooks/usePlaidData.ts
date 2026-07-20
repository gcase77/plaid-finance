import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Item, Account } from "../components/types";
import { buildAuthHeaders } from "../lib/auth";
import { ENTITLEMENTS_QUERY_KEY, isPaymentRequiredPayload, type PaymentRequiredReason } from "../lib/entitlements";

const PLAID_LINK_TOKEN_KEY = "plaid_link_token";

export type DeleteItemResult =
  | { ok: true; plaidRemoved: boolean; plaidError?: string }
  | { ok: false; error: string };
export type RefreshAccountsResult =
  | { ok: true; updatedAccounts: number }
  | { ok: false; error: string };
export type LinkBankResult =
  | { ok: true }
  | { ok: false; paymentRequired: true; reason: PaymentRequiredReason }
  | { ok: false; paymentRequired?: false; error: string };

type UsePlaidDataReturn = {
  items: Item[];
  accountsByItem: Record<string, Account[]>;
  loadingItems: boolean;
  loadItems: (userId?: string | null, token?: string | null) => Promise<void>;
  linkBank: (daysRequested?: number) => Promise<LinkBankResult>;
  deleteItem: (itemId: string) => Promise<DeleteItemResult>;
  refreshItemAccounts: (itemId: string) => Promise<RefreshAccountsResult>;
};

export function usePlaidData(userId: string | null, token: string | null): UsePlaidDataReturn {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<Item[]>([]);
  const [accountsByItem, setAccountsByItem] = useState<Record<string, Account[]>>({});
  const [loadingItems, setLoadingItems] = useState(false);

  const invalidateEntitlements = () =>
    queryClient.invalidateQueries({ queryKey: ENTITLEMENTS_QUERY_KEY });

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
          const r = await fetchWithAuth(`/api/${item.id}/accounts`, {}, tk);
          byItem[item.id] = r.ok ? ((await r.json()) as Account[]) : [];
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
        const exchangeRes = await fetchWithAuth("/api/link/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicToken })
        });
        sessionStorage.removeItem(PLAID_LINK_TOKEN_KEY);
        if (exchangeRes.ok) {
          await loadItems(userId, token);
          await invalidateEntitlements();
        }
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

  const linkBank = async (daysRequested = 730): Promise<LinkBankResult> => {
    if (!userId) return { ok: false, error: "Not signed in" };
    const sanitizedDaysRequested = Math.min(730, Math.max(1, Number.isFinite(daysRequested) ? Math.floor(daysRequested) : 730));
    const linkTokenRes = await fetchWithAuth("/api/link/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daysRequested: sanitizedDaysRequested })
    });
    const data = await linkTokenRes.json().catch(() => ({}));
    if (linkTokenRes.status === 403 && isPaymentRequiredPayload(data)) {
      return { ok: false, paymentRequired: true, reason: data.reason === "sync" ? "sync" : "add_bank" };
    }
    if (!linkTokenRes.ok) {
      return { ok: false, error: (data as { error?: string })?.error || `Link token failed (${linkTokenRes.status})` };
    }
    if (!(data as { link_token?: string })?.link_token || !window.Plaid) {
      return { ok: false, error: "Plaid Link is unavailable" };
    }
    sessionStorage.setItem(PLAID_LINK_TOKEN_KEY, (data as { link_token: string }).link_token);
    window.Plaid.create({
      token: (data as { link_token: string }).link_token,
      onSuccess: async (publicToken: string) => {
        const exchangeRes = await fetchWithAuth("/api/link/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicToken })
        });
        sessionStorage.removeItem(PLAID_LINK_TOKEN_KEY);
        if (exchangeRes.ok) {
          await loadItems();
          await invalidateEntitlements();
        }
      },
      onExit: () => sessionStorage.removeItem(PLAID_LINK_TOKEN_KEY)
    }).open();
    return { ok: true };
  };

  const deleteItem = async (itemId: string): Promise<DeleteItemResult> => {
    if (!token) return { ok: false, error: "Not signed in" };
    const res = await fetchWithAuth(`/api/items/${encodeURIComponent(itemId)}/delete_all`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      plaid_removed?: boolean;
      plaid_error?: string;
    };
    if (!res.ok) return { ok: false, error: data?.error || `Delete failed (${res.status})` };
    await loadItems();
    await invalidateEntitlements();
    return { ok: true, plaidRemoved: data.plaid_removed !== false, plaidError: data.plaid_error };
  };

  const refreshItemAccounts = async (itemId: string): Promise<RefreshAccountsResult> => {
    const res = await fetchWithAuth(`/api/${encodeURIComponent(itemId)}/accounts/refresh`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { error?: string; updated_accounts?: number };
    if (!res.ok) return { ok: false as const, error: data.error || `Refresh failed (${res.status})` };
    await loadItems();
    return { ok: true as const, updatedAccounts: typeof data.updated_accounts === "number" ? data.updated_accounts : 0 };
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

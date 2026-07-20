import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TransactionBaseRow, TransactionMerged, TransactionMetaRow } from "../components/types";
import { buildAuthHeaders } from "../lib/auth";
import { ENTITLEMENTS_QUERY_KEY, isPaymentRequiredPayload, type PaymentRequiredReason } from "../lib/entitlements";

export type SyncTransactionsResult =
  | { ok: true; added?: number; modified?: number; removed?: number }
  | { ok: false; paymentRequired: true; reason: PaymentRequiredReason }
  | { ok: false; paymentRequired?: false; error: string };

type UseTransactionsDataReturn = {
  transactions: TransactionMerged[];
  loadingTxns: boolean;
  syncStatus: string;
  errorMessage: string | null;
  syncTransactions: () => Promise<SyncTransactionsResult>;
  invalidateTransactionMeta: () => Promise<void>;
};

/** Must match reads in BudgetRulesTool (detected categories from txn rows). */
export const TRANSACTIONS_QUERY_KEY = ["transactions", { includeRemoved: false }] as const;
const TRANSACTION_META_QUERY_KEY = ["transaction_meta"] as const;

const fetchTransactions = async (token: string | null, includeRemoved = false): Promise<TransactionBaseRow[]> => {
  const query = includeRemoved ? "?includeRemoved=true" : "";
  const res = await fetch(`/api/transactions${query}`, { headers: buildAuthHeaders(token) });
  if (!res.ok) throw new Error(`Failed to load transactions (${res.status})`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
};

const fetchTransactionMeta = async (token: string | null): Promise<TransactionMetaRow[]> => {
  const res = await fetch("/api/transaction_meta", { headers: buildAuthHeaders(token) });
  if (!res.ok) throw new Error(`Failed to load transaction meta (${res.status})`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
};

const syncTransactionsRequest = async (token: string | null): Promise<SyncTransactionsResult> => {
  const res = await fetch("/api/transactions/sync", {
    method: "POST",
    headers: buildAuthHeaders(token)
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 403 && isPaymentRequiredPayload(data)) {
    return { ok: false, paymentRequired: true, reason: data.reason === "add_bank" ? "add_bank" : "sync" };
  }
  if (!res.ok) return { ok: false, error: (data as { error?: string })?.error || `Sync failed (${res.status})` };
  return {
    ok: true,
    added: (data as { added?: number }).added,
    modified: (data as { modified?: number }).modified,
    removed: (data as { removed?: number }).removed
  };
};

export function useTransactionsData(token: string | null): UseTransactionsDataReturn {
  const queryClient = useQueryClient();
  const [syncStatus, setSyncStatus] = useState("No recent sync");

  const txQuery = useQuery({
    queryKey: TRANSACTIONS_QUERY_KEY,
    queryFn: () => fetchTransactions(token, false),
    enabled: !!token
  });

  const metaQuery = useQuery({
    queryKey: TRANSACTION_META_QUERY_KEY,
    queryFn: () => fetchTransactionMeta(token),
    enabled: !!token
  });

  const syncMutation = useMutation({
    mutationFn: () => syncTransactionsRequest(token),
    onSuccess: async (result) => {
      if (!result.ok) return;
      setSyncStatus(`${result.modified || 0} modified, ${result.added || 0} added, ${result.removed || 0} removed`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ENTITLEMENTS_QUERY_KEY })
      ]);
    }
  });

  const transactions = useMemo(() => {
    if (!txQuery.data || !metaQuery.data) return [];
    const metaById = new Map(metaQuery.data.map((row) => [String(row.transaction_id || ""), row]));
    return txQuery.data.map((row) => {
      const id = String(row.transaction_id || "");
      const meta = metaById.get(id);
      return {
        ...row,
        account_transfer_group: meta?.account_transfer_group ?? null,
        netting_group: meta?.netting_group ?? null,
        bucket_1_tag_id: meta?.bucket_1_tag_id ?? null,
        bucket_2_tag_id: meta?.bucket_2_tag_id ?? null,
        meta_tag_ids: meta?.meta_tag_ids ?? []
      };
    });
  }, [txQuery.data, metaQuery.data]);

  const lastSyncError = syncMutation.data && !syncMutation.data.ok && !syncMutation.data.paymentRequired
    ? syncMutation.data.error
    : null;

  const errorMessage = (txQuery.error as Error | null)?.message
    || (metaQuery.error as Error | null)?.message
    || lastSyncError
    || null;

  return {
    transactions,
    loadingTxns: txQuery.isLoading || metaQuery.isLoading || syncMutation.isPending,
    syncStatus,
    errorMessage,
    syncTransactions: async () => syncMutation.mutateAsync(),
    invalidateTransactionMeta: async () => { await queryClient.invalidateQueries({ queryKey: TRANSACTION_META_QUERY_KEY }); }
  };
}

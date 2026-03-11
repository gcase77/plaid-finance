import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TransactionBaseRow, TransactionMerged, TransactionMetaRow } from "../components/types";
import { buildAuthHeaders } from "../lib/auth";

type UseTransactionsDataReturn = {
  transactions: TransactionMerged[];
  loadingTxns: boolean;
  syncStatus: string;
  errorMessage: string | null;
  syncTransactions: () => Promise<void>;
  invalidateTransactions: () => Promise<void>;
  invalidateTransactionMeta: () => Promise<void>;
  invalidateAllTransactionData: () => Promise<void>;
};

const getTransactionsQueryKey = (userId: string | null) =>
  ["transactions", userId, { includeRemoved: false }] as const;
const getTransactionMetaQueryKey = (userId: string | null) =>
  ["transaction_meta", userId] as const;

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

const syncTransactionsRequest = async (token: string | null): Promise<{ added?: number; modified?: number; removed?: number; error?: string }> => {
  const res = await fetch("/api/transactions/sync", {
    method: "POST",
    headers: buildAuthHeaders(token)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Sync failed (${res.status})`);
  return data;
};

export function useTransactionsData(token: string | null, userId: string | null): UseTransactionsDataReturn {
  const queryClient = useQueryClient();
  const [syncStatus, setSyncStatus] = useState("No sync yet");
  const transactionsQueryKey = getTransactionsQueryKey(userId);
  const transactionMetaQueryKey = getTransactionMetaQueryKey(userId);

  const txQuery = useQuery({
    queryKey: transactionsQueryKey,
    queryFn: () => fetchTransactions(token, false),
    enabled: !!token && !!userId
  });

  const metaQuery = useQuery({
    queryKey: transactionMetaQueryKey,
    queryFn: () => fetchTransactionMeta(token),
    enabled: !!token && !!userId
  });

  const syncMutation = useMutation({
    mutationFn: () => syncTransactionsRequest(token),
    onSuccess: async (result) => {
      setSyncStatus(`${result.modified || 0} modified, ${result.added || 0} added, ${result.removed || 0} removed`);
      await queryClient.invalidateQueries({ queryKey: transactionsQueryKey });
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
        bucket_1_tag_id: meta?.bucket_1_tag_id ?? null,
        bucket_2_tag_id: meta?.bucket_2_tag_id ?? null,
        meta_tag_id: meta?.meta_tag_id ?? null
      };
    });
  }, [txQuery.data, metaQuery.data]);

  const errorMessage = (txQuery.error as Error | null)?.message
    || (metaQuery.error as Error | null)?.message
    || (syncMutation.error as Error | null)?.message
    || null;

  return {
    transactions,
    loadingTxns: txQuery.isLoading || metaQuery.isLoading || syncMutation.isPending,
    syncStatus,
    errorMessage,
    syncTransactions: async () => { await syncMutation.mutateAsync(); },
    invalidateTransactions: async () => { await queryClient.invalidateQueries({ queryKey: transactionsQueryKey }); },
    invalidateTransactionMeta: async () => { await queryClient.invalidateQueries({ queryKey: transactionMetaQueryKey }); },
    invalidateAllTransactionData: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: transactionsQueryKey }),
        queryClient.invalidateQueries({ queryKey: transactionMetaQueryKey })
      ]);
    }
  };
}

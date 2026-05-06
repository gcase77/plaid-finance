import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TransactionBaseRow, TransactionMerged, TransactionMetaRow } from "../components/types";
import { dataProvider } from "../providers/dataProvider";

type UseTransactionsDataReturn = {
  transactions: TransactionMerged[];
  loadingTxns: boolean;
  syncStatus: string;
  errorMessage: string | null;
  syncTransactions: () => Promise<void>;
  invalidateTransactionMeta: () => Promise<void>;
};

/** Must match reads in BudgetRulesTool (detected categories from txn rows). */
export const TRANSACTIONS_QUERY_KEY = ["transactions", { includeRemoved: false }] as const;
const TRANSACTION_META_QUERY_KEY = ["transaction_meta"] as const;

const fetchTransactions = async (includeRemoved = false): Promise<TransactionBaseRow[]> => {
  const result = await dataProvider.getList<TransactionBaseRow>({
    resource: "transactions",
    meta: { query: includeRemoved ? { includeRemoved: true } : undefined }
  });
  return Array.isArray(result.data) ? result.data : [];
};

const fetchTransactionMeta = async (): Promise<TransactionMetaRow[]> => {
  const result = await dataProvider.getList<TransactionMetaRow>({ resource: "transaction_meta" });
  return Array.isArray(result.data) ? result.data : [];
};

const syncTransactionsRequest = async (): Promise<{ added?: number; modified?: number; removed?: number; error?: string }> => {
  const result = await dataProvider.custom?.({
    url: "/api/transactions/sync",
    method: "post"
  });
  return (result?.data ?? {}) as { added?: number; modified?: number; removed?: number; error?: string };
};

export function useTransactionsData(token: string | null): UseTransactionsDataReturn {
  const queryClient = useQueryClient();
  const [syncStatus, setSyncStatus] = useState("No recent sync");

  const txQuery = useQuery({
    queryKey: TRANSACTIONS_QUERY_KEY,
    queryFn: () => fetchTransactions(false),
    enabled: !!token
  });

  const metaQuery = useQuery({
    queryKey: TRANSACTION_META_QUERY_KEY,
    queryFn: () => fetchTransactionMeta(),
    enabled: !!token
  });

  const syncMutation = useMutation({
    mutationFn: () => syncTransactionsRequest(),
    onSuccess: async (result) => {
      setSyncStatus(`${result.modified || 0} modified, ${result.added || 0} added, ${result.removed || 0} removed`);
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
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
        meta_tag_ids: meta?.meta_tag_ids ?? []
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
    invalidateTransactionMeta: async () => { await queryClient.invalidateQueries({ queryKey: TRANSACTION_META_QUERY_KEY }); }
  };
}

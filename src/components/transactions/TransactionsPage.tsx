import { useList } from "@refinedev/core";
import { useTransactionFilters } from "../../hooks/useTransactionFilters";
import { useTransactionsData } from "../../hooks/useTransactionsData";
import type { Tag } from "../types";
import { useAuthSession } from "../../providers/AuthSessionProvider";
import TransactionsPanel from "./TransactionsPanel";

export default function TransactionsPage() {
  const { token } = useAuthSession();
  const transactionData = useTransactionsData(token);
  const filters = useTransactionFilters(transactionData.transactions);
  const tagsQuery = useList<Tag>({
    resource: "tags",
    queryOptions: { enabled: !!token }
  });

  return (
    <TransactionsPanel
      syncTransactions={transactionData.syncTransactions}
      syncStatus={transactionData.errorMessage || transactionData.syncStatus}
      filters={filters}
      loadingTxns={transactionData.loadingTxns || tagsQuery.isLoading}
      tags={tagsQuery.data?.data ?? []}
      tagsLoading={tagsQuery.isLoading}
      tagsError={(tagsQuery.error as Error | null) ?? null}
      invalidateTransactionMeta={transactionData.invalidateTransactionMeta}
    />
  );
}

import { useQuery } from "@tanstack/react-query";
import { useTransactionFilters } from "../../hooks/useTransactionFilters";
import { useTransactionsData } from "../../hooks/useTransactionsData";
import type { Tag } from "../types";
import { useAppAuth } from "../../providers/authContext";
import { useRefineDataProvider } from "../../providers/refineContext";
import TransactionsPanel from "./TransactionsPanel";

export default function TransactionsPage() {
  const { token } = useAppAuth();
  const dataProvider = useRefineDataProvider();
  const transactionData = useTransactionsData(token);
  const filters = useTransactionFilters(transactionData.transactions);
  const tagsQuery = useQuery({
    queryKey: ["tags"],
    enabled: !!token,
    queryFn: async (): Promise<Tag[]> => {
      return dataProvider.getList<Tag>({ resource: "tags" });
    }
  });


  return (
    <TransactionsPanel
      syncTransactions={transactionData.syncTransactions}
      syncStatus={transactionData.errorMessage || transactionData.syncStatus}
      filters={filters}
      loadingTxns={transactionData.loadingTxns || tagsQuery.isLoading}
      tags={tagsQuery.data ?? []}
      token={token}
      invalidateTransactionMeta={transactionData.invalidateTransactionMeta}
    />
  );
}

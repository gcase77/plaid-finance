import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useTransactionFilters } from "../../hooks/useTransactionFilters";
import { useTransactionsData } from "../../hooks/useTransactionsData";
import { supabase } from "../../lib/supabase";
import TransactionsPanel from "./TransactionsPanel";

export default function TransactionsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const token = session?.access_token ?? null;
  const transactionData = useTransactionsData(token);
  const filters = useTransactionFilters(transactionData.transactions);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  return (
    <TransactionsPanel
      syncTransactions={transactionData.syncTransactions}
      syncStatus={transactionData.errorMessage || transactionData.syncStatus}
      filters={filters}
      loadingTxns={transactionData.loadingTxns}
    />
  );
}

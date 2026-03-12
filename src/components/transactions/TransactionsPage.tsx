import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { useTransactionFilters } from "../../hooks/useTransactionFilters";
import { useTransactionsData } from "../../hooks/useTransactionsData";
import type { Tag } from "../types";
import { buildAuthHeaders } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import TransactionsPanel from "./TransactionsPanel";

export default function TransactionsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const token = session?.access_token ?? null;
  const transactionData = useTransactionsData(token);
  const filters = useTransactionFilters(transactionData.transactions);
  const tagsQuery = useQuery({
    queryKey: ["tags"],
    enabled: !!token,
    queryFn: async (): Promise<Tag[]> => {
      const res = await fetch("/api/tags", { headers: buildAuthHeaders(token) });
      if (!res.ok) throw new Error(`Failed to load tags (${res.status})`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  return (
    <TransactionsPanel
      syncTransactions={transactionData.syncTransactions}
      syncStatus={transactionData.errorMessage || transactionData.syncStatus}
      filters={filters}
      loadingTxns={transactionData.loadingTxns || tagsQuery.isLoading}
      tags={tagsQuery.data ?? []}
    />
  );
}

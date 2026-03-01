import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { usePlaidData } from "../hooks/usePlaidData";
import { useTransactionFilters } from "../hooks/useTransactionFilters";
import { supabase } from "../lib/supabase";
import MainTab from "./MainTab";
import TransactionsPanel from "./TransactionsPanel";
import type { TabKey } from "./types";

export default function AppShell() {
  const [session, setSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("main");
  const userId = session?.user?.id ?? null;
  const token = session?.access_token ?? null;
  const userEmail = session?.user?.email ?? "";
  const plaidData = usePlaidData(userId, token);
  const filters = useTransactionFilters(plaidData.transactions);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  useEffect(() => {
    if (!userId || !token) return;
    void plaidData.loadItems(userId, token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, token]);

  useEffect(() => {
    const onHash = () => {
      const next = (window.location.hash.replace("#", "") || "main") as TabKey;
      setActiveTab(next === "transactions" ? next : "main");
    };
    window.addEventListener("hashchange", onHash);
    onHash();
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
        <div className="container-fluid">
          <span className="navbar-brand">G Case Financial Insights</span>
          <ul className="navbar-nav">
            <li className="nav-item"><a className={`nav-link ${activeTab === "main" ? "active" : ""}`} href="#main">Main</a></li>
            <li className="nav-item"><a className={`nav-link ${activeTab === "transactions" ? "active" : ""}`} href="#transactions">Transactions</a></li>
          </ul>
        </div>
      </nav>

      <div className="container mt-4">
        {activeTab === "main" && (
          <MainTab
            userEmail={userEmail}
            signOut={() => supabase.auth.signOut()}
            linkBank={plaidData.linkBank}
            loadingItems={plaidData.loadingItems}
            items={plaidData.items}
            accountsByItem={plaidData.accountsByItem}
          />
        )}

        {activeTab === "transactions" && (
          <TransactionsPanel
            syncTransactions={plaidData.syncTransactions}
            syncStatus={plaidData.syncStatus}
            filters={filters}
            loadingTxns={plaidData.loadingTxns}
          />
        )}
      </div>
    </div>
  );
}

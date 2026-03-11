import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { usePlaidData } from "../hooks/usePlaidData";
import { useTransactionFilters } from "../hooks/useTransactionFilters";
import { useTransactionsData } from "../hooks/useTransactionsData";
import { useAuth } from "../contexts/useAuth";
import type { AppShellContextValue } from "./appShellContext";

export default function AppShell() {
  const { user, token, signOut } = useAuth();
  const userId = user?.id ?? null;
  const userEmail = user?.email ?? "";
  const plaidData = usePlaidData(userId, token);
  const transactionData = useTransactionsData(token, userId);
  const filters = useTransactionFilters(transactionData.transactions);

  useEffect(() => {
    if (!userId || !token) return;
    void plaidData.loadItems(userId, token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, token]);

  const context: AppShellContextValue = {
    userEmail,
    signOut,
    linkBank: plaidData.linkBank,
    loadingItems: plaidData.loadingItems,
    items: plaidData.items,
    accountsByItem: plaidData.accountsByItem,
    syncTransactions: transactionData.syncTransactions,
    syncStatus: transactionData.errorMessage || transactionData.syncStatus,
    filters,
    loadingTxns: transactionData.loadingTxns
  };

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
        <div className="container-fluid">
          <span className="navbar-brand">G Case Financial Insights</span>
          <ul className="navbar-nav">
            <li className="nav-item">
              <NavLink className="nav-link" to="/home">
                Home
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink className="nav-link" to="/transactions">
                Transactions
              </NavLink>
            </li>
          </ul>
        </div>
      </nav>

      <div className="container mt-4">
        <Outlet context={context} />
      </div>
    </div>
  );
}

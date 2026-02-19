import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { usePlaidData } from "../hooks/usePlaidData";
import { useTransactionFilters } from "../hooks/useTransactionFilters";
import { buildDatePreset } from "../utils/datePresets";
import MainTab from "./MainTab";
import TransactionsPanel from "./TransactionsPanel";
import type { TabKey } from "./types";

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<TabKey>("main");
  const auth = useAuth();
  const plaidData = usePlaidData(auth.userId, auth.token, auth.runtimeAuthMode);
  const filters = useTransactionFilters(plaidData.transactions);

  useEffect(() => {
    auth.onAuthStateChange(async (userId, email, token) => {
      await plaidData.ensureUserExists(userId, email, token);
      await plaidData.loadItems(userId, token);
    });
  }, []);

  useEffect(() => {
    const onHash = () => {
      const next = (window.location.hash.replace("#", "") || "main") as TabKey;
      if (!auth.isAuthed && next === "transactions") {
        setActiveTab("main");
        window.location.hash = "main";
        auth.onAuthStateChange(() => Promise.resolve());
        return;
      }
      setActiveTab(next === "transactions" ? next : "main");
    };
    window.addEventListener("hashchange", onHash);
    onHash();
    return () => window.removeEventListener("hashchange", onHash);
  }, [auth.isAuthed]);

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
        <div className="container-fluid">
          <span className="navbar-brand">G Case Financial Insights</span>
          <ul className="navbar-nav">
            <li className="nav-item"><a className={`nav-link ${activeTab === "main" ? "active" : ""}`} href="#main">Main</a></li>
            <li className="nav-item"><a className={`nav-link ${activeTab === "transactions" ? "active" : ""} ${!auth.isAuthed ? "disabled" : ""}`} href="#transactions">Transactions</a></li>
          </ul>
        </div>
      </nav>

      <div className="container mt-4">
        {activeTab === "main" && (
          <MainTab
            runtimeAuthMode={auth.runtimeAuthMode}
            isAuthed={auth.isAuthed}
            authMode={auth.authMode}
            setAuthMode={auth.setAuthMode}
            signInEmail={auth.signInEmail}
            setSignInEmail={auth.setSignInEmail}
            signInPassword={auth.signInPassword}
            setSignInPassword={auth.setSignInPassword}
            signUpEmail={auth.signUpEmail}
            setSignUpEmail={auth.setSignUpEmail}
            signUpPassword={auth.signUpPassword}
            setSignUpPassword={auth.setSignUpPassword}
            busyAuth={auth.busyAuth}
            signIn={auth.signIn}
            signUp={auth.signUp}
            authError={auth.authError}
            authStatus={auth.authStatus}
            userEmail={auth.userEmail}
            signOut={auth.signOut}
            linkBank={plaidData.linkBank}
            loadingItems={plaidData.loadingItems}
            items={plaidData.items}
            accountsByItem={plaidData.accountsByItem}
            deleteItem={plaidData.deleteItem}
            devUsers={auth.devUsers}
            selectedDevUserId={auth.selectedDevUserId}
            setSelectedDevUserId={auth.setSelectedDevUserId}
            createDevUser={auth.createDevUser}
          />
        )}

        {activeTab === "transactions" && (
          <TransactionsPanel
            syncTransactions={plaidData.syncTransactions}
            syncStatus={plaidData.syncStatus}
            clearAllFilters={filters.clearAllFilters}
            applyDatePreset={(preset) => {
              const d = buildDatePreset(preset);
              filters.setDateStart(d.start);
              filters.setDateEnd(d.end);
            }}
            nameMode={filters.nameMode}
            setNameMode={filters.setNameMode}
            nameFilter={filters.nameFilter}
            setNameFilter={filters.setNameFilter}
            merchantMode={filters.merchantMode}
            setMerchantMode={filters.setMerchantMode}
            merchantFilter={filters.merchantFilter}
            setMerchantFilter={filters.setMerchantFilter}
            amountMode={filters.amountMode}
            setAmountMode={filters.setAmountMode}
            amountFilter={filters.amountFilter}
            setAmountFilter={filters.setAmountFilter}
            dateStart={filters.dateStart}
            setDateStart={filters.setDateStart}
            dateEnd={filters.dateEnd}
            setDateEnd={filters.setDateEnd}
            selectedBanks={filters.selectedBanks}
            setSelectedBanks={filters.setSelectedBanks}
            bankOptions={filters.bankOptions}
            selectedAccounts={filters.selectedAccounts}
            setSelectedAccounts={filters.setSelectedAccounts}
            accountOptions={filters.accountOptions}
            selectedCategories={filters.selectedCategories}
            setSelectedCategories={filters.setSelectedCategories}
            categoryOptions={filters.categoryOptions}
            loadingTxns={plaidData.loadingTxns}
            filteredTransactions={filters.filteredTransactions}
          />
        )}
      </div>
    </div>
  );
}

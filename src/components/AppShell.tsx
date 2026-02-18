import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { usePlaidData } from "../hooks/usePlaidData";
import { useTransactionFilters } from "../hooks/useTransactionFilters";
import { useTags } from "../hooks/useTags";
import { useRules } from "../hooks/useRules";
import { useVisualizations } from "../hooks/useVisualizations";
import { buildDatePreset } from "../utils/datePresets";
import MainTab from "./MainTab";
import TransactionsPanel from "./TransactionsPanel";
import VisualizePanel from "./VisualizePanel";
import type { TabKey } from "./types";

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<TabKey>("main");
  const auth = useAuth();
  const plaidData = usePlaidData(auth.userId, auth.token, auth.runtimeAuthMode);
  const filters = useTransactionFilters(plaidData.transactions);
  const tagsData = useTags(auth.token, auth.runtimeAuthMode, plaidData.loadTransactions);
  const rulesData = useRules(auth.token, auth.runtimeAuthMode);
  const visualizations = useVisualizations(auth.token, auth.runtimeAuthMode, auth.isAuthed);

  useEffect(() => {
    auth.onAuthStateChange(async (userId, email, token) => {
      await plaidData.ensureUserExists(userId, email, token);
      await plaidData.loadItems(userId, token);
    });
  }, []);

  useEffect(() => {
    const onHash = () => {
      const next = (window.location.hash.replace("#", "") || "main") as TabKey;
      if (!auth.isAuthed && (next === "transactions" || next === "visualize")) {
        setActiveTab("main");
        window.location.hash = "main";
        auth.onAuthStateChange(() => Promise.resolve());
        return;
      }
      setActiveTab(next === "transactions" || next === "visualize" ? next : "main");
    };
    window.addEventListener("hashchange", onHash);
    onHash();
    return () => window.removeEventListener("hashchange", onHash);
  }, [auth.isAuthed]);

  useEffect(() => {
    if (activeTab === "visualize" && auth.isAuthed) void visualizations.refreshVisualizations();
  }, [activeTab, auth.isAuthed, visualizations.visualizeDateStart, visualizations.visualizeDateEnd]);

  useEffect(() => {
    if (activeTab === "transactions" && auth.isAuthed) {
      void tagsData.loadTags();
      void rulesData.loadRules();
    }
  }, [activeTab, auth.isAuthed]);

  const handleSignOut = async () => {
    await auth.signOut();
    visualizations.clearVisualizations();
  };

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
        <div className="container-fluid">
          <span className="navbar-brand">G Case Financial Insights</span>
          <ul className="navbar-nav">
            <li className="nav-item"><a className={`nav-link ${activeTab === "main" ? "active" : ""}`} href="#main">Main</a></li>
            <li className="nav-item"><a className={`nav-link ${activeTab === "transactions" ? "active" : ""} ${!auth.isAuthed ? "disabled" : ""}`} href="#transactions">Transactions</a></li>
            <li className="nav-item"><a className={`nav-link ${activeTab === "visualize" ? "active" : ""} ${!auth.isAuthed ? "disabled" : ""}`} href="#visualize">Visualize</a></li>
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
            signOut={handleSignOut}
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
            previewTransferPairs={plaidData.previewTransferPairs}
            applyTransferPairs={plaidData.applyTransferPairs}
            getRecognizedTransfers={plaidData.getRecognizedTransfers}
            unmarkTransferGroups={plaidData.unmarkTransferGroups}
            loadTransactions={plaidData.loadTransactions}
            tags={tagsData.tags}
            tagsLoading={tagsData.loading}
            createTag={tagsData.createTag}
            renameTag={tagsData.renameTag}
            deleteTag={tagsData.deleteTag}
            applyTags={tagsData.applyTags}
            tagStateFilter={filters.tagStateFilter}
            setTagStateFilter={filters.setTagStateFilter}
            selectedTagIds={filters.selectedTagIds}
            setSelectedTagIds={filters.setSelectedTagIds}
            filterOperator={filters.filterOperator}
            setFilterOperator={filters.setFilterOperator}
            rules={rulesData.rules}
            ruleStatuses={rulesData.statuses}
            rulesLoading={rulesData.loading}
            rulesError={rulesData.error}
            createRule={rulesData.createRule}
            deleteRule={rulesData.deleteRule}
            loadRules={rulesData.loadRules}
          />
        )}

        {activeTab === "visualize" && (
          <VisualizePanel
            refreshVisualizations={() => void visualizations.refreshVisualizations()}
            applyVisualizeDatePreset={(preset) => {
              const d = buildDatePreset(preset);
              visualizations.setVisualizeDateStart(d.start);
              visualizations.setVisualizeDateEnd(d.end);
            }}
            visualizeDateStart={visualizations.visualizeDateStart}
            setVisualizeDateStart={visualizations.setVisualizeDateStart}
            visualizeDateEnd={visualizations.visualizeDateEnd}
            setVisualizeDateEnd={visualizations.setVisualizeDateEnd}
            loadingCharts={visualizations.loadingCharts}
            visualizeStatus={visualizations.visualizeStatus}
            incomeCanvasRef={visualizations.incomeCanvasRef}
            spendingCanvasRef={visualizations.spendingCanvasRef}
            sankeyRef={visualizations.sankeyRef}
            detailTitle={visualizations.detailTitle}
            detailRows={visualizations.detailRows}
          />
        )}
      </div>
    </div>
  );
}

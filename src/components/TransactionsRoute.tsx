import { useOutletContext } from "react-router-dom";
import TransactionsPanel from "./TransactionsPanel";
import type { AppShellContextValue } from "./appShellContext";

export default function TransactionsRoute() {
  const context = useOutletContext<AppShellContextValue>();

  return (
    <TransactionsPanel
      syncTransactions={context.syncTransactions}
      syncStatus={context.syncStatus}
      filters={context.filters}
      loadingTxns={context.loadingTxns}
    />
  );
}

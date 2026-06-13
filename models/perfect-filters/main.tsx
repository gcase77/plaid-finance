import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./theme.css";
import TransactionTable from "./TransactionTable";
import dummy from "./dummy-data.json";
import type { Tag, Txn } from "./types";

const { tags, transactions } = dummy as { tags: Tag[]; transactions: Txn[] };

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div style={{ padding: "var(--s5)", maxWidth: 1200, margin: "0 auto" }}>
      <h1 className="mb-3">Perfect filters lab</h1>
      <p className="muted small mb-4">Static copy of the app transaction table + JSON dummy data.</p>
      <TransactionTable transactions={transactions} tags={tags} />
    </div>
  </StrictMode>
);

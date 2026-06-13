import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./theme.css";
import App from "./App";
import dummy from "./dummy-data.json";
import type { Tag, Txn } from "./types";

const { tags, transactions } = dummy as { tags: Tag[]; transactions: Txn[] };

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App transactions={transactions} tags={tags} />
  </StrictMode>
);

import { lazy, Suspense, useState } from "react";
import TransactionTable from "./TransactionTable";
import type { Tag, Txn } from "./types";

const RqbTransactionTab = lazy(() => import("./RqbTransactionTab"));

export default function App({ transactions, tags }: { transactions: Txn[]; tags: Tag[] }) {
  const [tab, setTab] = useState<"ast" | "rqb">("ast");
  return (
    <div style={{ padding: "var(--s5)", maxWidth: 1200, margin: "0 auto" }}>
      <h1 className="mb-3">Perfect filters lab</h1>
      <p className="muted small mb-3">Static transaction table + JSON dummy data. Compare two filter UIs.</p>
      <div className="lab-tabs row-flex gap-2 mb-4 flex-wrap">
        <button type="button" className={`btn btn-sm ${tab === "ast" ? "primary" : "ghost"}`} onClick={() => setTab("ast")}>Custom AST builder</button>
        <button type="button" className={`btn btn-sm ${tab === "rqb" ? "primary" : "ghost"}`} onClick={() => setTab("rqb")}>react-querybuilder</button>
      </div>
      {tab === "ast" ? <TransactionTable transactions={transactions} tags={tags} /> : (
        <Suspense fallback={<p className="muted small">Loading react-querybuilder…</p>}>
          <RqbTransactionTab transactions={transactions} tags={tags} />
        </Suspense>
      )}
    </div>
  );
}

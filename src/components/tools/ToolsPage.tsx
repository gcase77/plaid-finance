import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { useTransactionsData } from "../../hooks/useTransactionsData";
import TransferGroupTool from "./TransferGroupTool";
import TagsTool from "./TagsTool";
import BudgetRulesTool from "./BudgetRulesTool";

type ToolKey = "tags" | "budget-rules" | "account-transfers";

const TOOLS: { key: ToolKey; label: string }[] = [
  { key: "tags", label: "Tags" },
  { key: "budget-rules", label: "Budget Rules" },
  { key: "account-transfers", label: "Find Transfers" }
];

export default function ToolsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [active, setActive] = useState<ToolKey>("tags");
  const token = session?.access_token ?? null;
  const { transactions, invalidateTransactionMeta } = useTransactionsData(token);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  return (
    <div className="d-flex gap-3 align-items-start">
      <div className="card" style={{ minWidth: 180, flexShrink: 0 }}>
        <div className="card-body p-2">
          <p className="text-muted small fw-semibold px-2 mb-1 mt-1">Tools</p>
          <ul className="nav flex-column">
            {TOOLS.map(t => (
              <li key={t.key} className="nav-item">
                <button
                  className={`nav-link text-start w-100 btn btn-link ${active === t.key ? "fw-semibold text-primary" : "text-secondary"}`}
                  onClick={() => setActive(t.key)}>
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex-fill">
        {active === "tags" && (
          <TagsTool
            transactions={transactions}
            token={token}
            invalidateTransactionMeta={invalidateTransactionMeta}
          />
        )}
        {active === "budget-rules" && (
          <BudgetRulesTool token={token} />
        )}
        {active === "account-transfers" && (
          <TransferGroupTool
            transactions={transactions}
            token={token}
            invalidateTransactionMeta={invalidateTransactionMeta}
          />
        )}
      </div>
    </div>
  );
}

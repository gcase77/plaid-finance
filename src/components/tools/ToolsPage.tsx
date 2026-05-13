import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { useTransactionsData } from "../../hooks/useTransactionsData";
import BudgetRulesTool from "./BudgetRulesTool";
import TransferGroupTool from "./TransferGroupTool";
import VisualizeTrendsTool from "./VisualizeTrendsTool";

type ToolKey = "budget-rules" | "account-transfers" | "visualize-trends";

const tools: Array<{ key: ToolKey; label: string; blurb: string }> = [
  { key: "budget-rules", label: "Budget Rules", blurb: "Targets and rollover tracking." },
  { key: "account-transfers", label: "Find Transfers", blurb: "Match money moved between accounts." },
  { key: "visualize-trends", label: "Visualize Trends", blurb: "Pie, flow, and timeline views." }
];

export default function ToolsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [active, setActive] = useState<ToolKey>("budget-rules");
  const token = session?.access_token ?? null;
  const { transactions, invalidateTransactionMeta } = useTransactionsData(token);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <span className="page-kicker">Analysis and cleanup</span>
          <h1>Tools</h1>
        </div>
      </div>
      <section className="surface-card p-3">
        <div className="grid-cards">
          {tools.map((tool) => (
            <button key={tool.key} type="button" className={`metric-card text-start border-0 ${active === tool.key ? "bg-white" : ""}`} onClick={() => setActive(tool.key)}>
              <b className={active === tool.key ? "text-primary" : ""}>{tool.label}</b>
              <span className="small text-muted">{tool.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      {active === "budget-rules" && <BudgetRulesTool token={token} />}
      {active === "account-transfers" && (
        <TransferGroupTool transactions={transactions} token={token} invalidateTransactionMeta={invalidateTransactionMeta} />
      )}
      {active === "visualize-trends" && <VisualizeTrendsTool transactions={transactions} token={token} />}
    </div>
  );
}

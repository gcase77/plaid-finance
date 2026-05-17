import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { useTransactionsData } from "../../hooks/useTransactionsData";
import TransferGroupTool from "./TransferGroupTool";
import BudgetRulesTool from "./BudgetRulesTool";
import VisualizeTrendsTool from "./VisualizeTrendsTool";

type ToolKey = "budget-rules" | "account-transfers" | "visualize-trends";
const TOOLS: { key: ToolKey; label: string; desc: string }[] = [
  { key: "budget-rules", label: "Budget Rules", desc: "Set spending targets and track them per period." },
  { key: "account-transfers", label: "Find Transfers", desc: "Pair transfers between your own accounts so they don't skew totals." },
  { key: "visualize-trends", label: "Visualize Trends", desc: "Pie, flow-of-funds and timeline views of your money." }
];
const TOOLS_ACTIVE_KEY = "funds-up-tools-active";

function loadStoredToolKey(): ToolKey {
  try {
    const v = localStorage.getItem(TOOLS_ACTIVE_KEY);
    if (v && TOOLS.some((t) => t.key === v)) return v as ToolKey;
  } catch { /* private mode / quota */ }
  return "budget-rules";
}

export default function ToolsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [active, setActive] = useState<ToolKey>(loadStoredToolKey);
  const token = session?.access_token ?? null;
  const { transactions, invalidateTransactionMeta } = useTransactionsData(token);

  useEffect(() => { supabase.auth.getSession().then(({ data }) => setSession(data.session)); }, []);

  const tool = TOOLS.find((t) => t.key === active)!;

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{tool.label}</h1>
          <p className="desc">{tool.desc}</p>
        </div>
        <div className="page-actions nav nav-tabs" style={{ margin: 0, borderBottom: 0 }}>
          {TOOLS.map((t) => (
            <button key={t.key} className={active === t.key ? "active" : ""} onClick={() => { setActive(t.key); try { localStorage.setItem(TOOLS_ACTIVE_KEY, t.key); } catch { /* ignore */ } }}>{t.label}</button>
          ))}
        </div>
      </header>

      {active === "budget-rules" && <BudgetRulesTool token={token} />}
      {active === "account-transfers" && <TransferGroupTool transactions={transactions} token={token} invalidateTransactionMeta={invalidateTransactionMeta} />}
      {active === "visualize-trends" && <VisualizeTrendsTool transactions={transactions} token={token} />}
    </>
  );
}

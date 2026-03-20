import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { useTransactionsData } from "../../hooks/useTransactionsData";
import TransferGroupTool from "./TransferGroupTool";
import BudgetRulesTool from "./BudgetRulesTool";
import VisualizeTrendsTool from "./VisualizeTrendsTool";

type ToolKey = "budget-rules" | "account-transfers" | "visualize-trends";

const TOOLS: { key: ToolKey; label: string }[] = [
  { key: "budget-rules", label: "Budget Rules" },
  { key: "account-transfers", label: "Find Transfers" },
  { key: "visualize-trends", label: "Visualize Trends" }
];

export default function ToolsPage() {
  const NARROW_QUERY = "(max-width: 576px)";
  const narrowInit =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(NARROW_QUERY).matches
      : false;
  const [isNarrow, setIsNarrow] = useState<boolean>(narrowInit);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => !narrowInit);
  const [session, setSession] = useState<Session | null>(null);
  const [active, setActive] = useState<ToolKey>("budget-rules");
  const token = session?.access_token ?? null;
  const { transactions, invalidateTransactionMeta } = useTransactionsData(token);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(NARROW_QUERY);
    const handler = () => setIsNarrow(mq.matches);
    handler();
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, []);

  useEffect(() => {
    setSidebarOpen(!isNarrow);
  }, [isNarrow]);

  return (
    <div className="d-flex gap-2 align-items-start" style={{ marginLeft: "-1rem" }}>
      <div
        className="card"
        style={{
          width: sidebarOpen ? 132 : 36,
          minWidth: sidebarOpen ? 132 : 36,
          flexShrink: 0,
          transition: "width 160ms ease",
        }}>
        <div
          className="card-body p-2"
          style={{
            padding: sidebarOpen ? undefined : "0.25rem 0.25rem",
            overflow: "hidden",
          }}>
          <button
            type="button"
            className="btn btn-link text-decoration-none text-muted fw-bold w-100 d-flex align-items-center justify-content-center"
            onClick={() => setSidebarOpen(o => !o)}
            aria-expanded={sidebarOpen}
            style={{ padding: sidebarOpen ? "0.125rem 0.25rem" : "0.125rem 0" }}>
            {sidebarOpen ? (
              <span className="fs-5">Tools</span>
            ) : (
              <span
                style={{
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                  fontSize: "0.9rem",
                }}>
                Tools
              </span>
            )}
          </button>

          {sidebarOpen && (
            <ul className="nav flex-column">
              {TOOLS.map(t => (
                <li key={t.key} className="nav-item">
                  <button
                    className={`nav-link text-start w-100 btn btn-link ${
                      active === t.key ? "fw-semibold text-primary" : "text-secondary"
                    }`}
                    onClick={() => {
                      setActive(t.key);
                      if (isNarrow) setSidebarOpen(false);
                    }}>
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex-fill">
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
        {active === "visualize-trends" && (
          <VisualizeTrendsTool transactions={transactions} token={token} />
        )}
      </div>
    </div>
  );
}

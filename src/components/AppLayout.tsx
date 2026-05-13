import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Link, NavLink, Outlet } from "react-router-dom";
import { supabase } from "../lib/supabase";

const NAV = [
  { to: "/", label: "Home", icon: "⌂", end: true },
  { to: "/transactions", label: "Transactions", icon: "≡" },
  { to: "/tools", label: "Tools", icon: "✦" },
  { to: "/account", label: "Account", icon: "◐" }
];

const STORAGE_KEY = "fundsup:sidebar-collapsed";

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });
  const [session, setSession] = useState<Session | null>(null);
  const email = session?.user?.email ?? "";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  const initial = useMemo(() => email.charAt(0).toUpperCase() || "?", [email]);

  return (
    <div className={`app-shell ${collapsed ? "collapsed" : ""}`}>
      <aside className="app-sidebar">
        <button className="sidebar-toggle" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand" : "Collapse"}>
          {collapsed ? "›" : "‹"}
        </button>

        <Link className="brand" to="/l" aria-label="Funds Up landing page">
          <img src="/funds-up-logo.svg" alt="Funds Up" />
        </Link>

        <nav aria-label="Primary">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} title={n.label}>
              <span className="icon" aria-hidden style={{ fontSize: "1.1rem", textAlign: "center" }}>{n.icon}</span>
              <span className="label">{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-user">
          {email && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span className="chip-soft chip" style={{ width: 28, height: 28, justifyContent: "center", fontSize: "0.85rem" }}>{initial}</span>
                <span className="email" style={{ fontSize: "0.8rem" }}>{email}</span>
              </div>
              <button className="btn ghost btn-sm btn-block" onClick={() => supabase.auth.signOut()}>Sign out</button>
            </>
          )}
        </div>
      </aside>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

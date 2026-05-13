import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Link, NavLink, Outlet } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Alert } from "./shared/ui";

const s = { strokeWidth: 2.85, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const NavSvg = ({ children, fill }: { children: ReactNode; fill?: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden {...(fill ? { fill: "currentColor" } : { fill: "none", stroke: "currentColor", ...s })}>{children}</svg>
);
const NAV = [
  {
    to: "/",
    label: "Home",
    end: true,
    icon: (
      <NavSvg>
        <path d="M3 10.5 12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20z" />
        <path d="M9 21.5V12h6v9.5" />
      </NavSvg>
    )
  },
  { to: "/transactions", label: "Transactions", icon: <NavSvg><path d="M4 7h16M4 12h16M4 17h16" /></NavSvg> },
  { to: "/tools", label: "Tools", icon: <NavSvg fill><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth={1.35} strokeLinejoin="round" /></NavSvg> }
];

const STORAGE_KEY = "fundsup:sidebar-collapsed";

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });
  const [session, setSession] = useState<Session | null>(null);
  const [signOutErr, setSignOutErr] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches
  );
  const email = session?.user?.email ?? "";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const fn = () => setNarrow(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  const layoutCollapsed = collapsed && !narrow;

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  const initial = useMemo(() => email.charAt(0).toUpperCase() || "?", [email]);

  return (
    <div className={`app-shell ${layoutCollapsed ? "collapsed" : ""}`}>
      <aside className="app-sidebar">
        <button className="sidebar-toggle" onClick={toggle} aria-label={layoutCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={layoutCollapsed ? "Expand" : "Collapse"}>
          {layoutCollapsed ? "›" : "‹"}
        </button>

        <Link className="brand" to="/l" aria-label="Funds Up landing page">
          <img src={layoutCollapsed ? "/funds-up-mark.svg" : "/funds-up-logo.svg"} alt="" />
        </Link>

        <nav aria-label="Primary">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} title={n.label}>
              <span className="icon" aria-hidden>{n.icon}</span>
              <span className="label">{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-user">
          {email && (
            <>
              <Link to="/account" className="sidebar-account-hit" title="Account settings" aria-label="Account settings">
                <span className="chip-soft chip" style={{ width: 28, height: 28, justifyContent: "center", fontSize: "0.85rem" }}>{initial}</span>
                <span className="email" style={{ fontSize: "0.8rem" }}>{email}</span>
              </Link>
              {signOutErr && <div className="mb-2"><Alert tone="danger" onClose={() => setSignOutErr(null)}>{signOutErr}</Alert></div>}
              <button
                className="btn ghost btn-sm btn-block"
                onClick={() => {
                  setSignOutErr(null);
                  void supabase.auth.signOut().then(({ error }) => {
                    if (error) setSignOutErr(error.message || "Sign out failed.");
                  }).catch(() => setSignOutErr("Sign out failed."));
                }}
              >
                Sign out
              </button>
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

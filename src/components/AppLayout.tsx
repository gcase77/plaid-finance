import { Link, NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

const links = [
  { to: "/", label: "Banks", end: true },
  { to: "/transactions", label: "Transactions" },
  { to: "/tools", label: "Tools" },
  { to: "/account", label: "Security" }
];

export default function AppLayout() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Primary navigation">
        <Link className="app-logo" to="/l" aria-label="Funds Up landing page">
          <img src="/funds-up-logo.svg" alt="Funds Up" />
        </Link>
        <nav className="app-nav">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="text-break">{session?.user.email || "Signed in"}</div>
          <button type="button" className="sidebar-button" onClick={() => void supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function RequireAuth() {
  const location = useLocation();
  const isToolsRoute = location.pathname === "/tools";
  const [claims, setClaims] = useState<object | null | undefined>(undefined);

  useEffect(() => {
    if (isToolsRoute) {
      return;
    }
    supabase.auth.getClaims()
      .then(({ data }) => setClaims(data?.claims ?? null))
      .catch(() => setClaims(null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      supabase.auth.getClaims()
        .then(({ data }) => setClaims(data?.claims ?? null))
        .catch(() => setClaims(null));
    });
    return () => subscription.unsubscribe();
  }, [isToolsRoute]);

  if (isToolsRoute) return <Outlet />;
  if (claims === undefined) return null;
  if (!claims) return <Navigate to="/auth" replace />;
  return <Outlet />;
}

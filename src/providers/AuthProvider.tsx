import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { AuthContextValue } from "./types";
import { AuthContext } from "./authContext";

export function AppAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setIsLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    token: session?.access_token ?? null,
    user: session?.user ?? null,
    userId: session?.user?.id ?? null,
    userEmail: session?.user?.email ?? "",
    isLoading,
    signOut: async () => {
      await supabase.auth.signOut();
      setSession(null);
    },
    refreshSession: async () => {
      const { data } = await supabase.auth.refreshSession();
      setSession(data.session);
      return data.session;
    }
  }), [isLoading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

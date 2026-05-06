import type { AuthProvider } from "@refinedev/core";
import { supabase } from "../lib/supabase";

export const authProvider: AuthProvider = {
  check: async () => {
    const { data } = await supabase.auth.getClaims();
    if (data?.claims) return { authenticated: true };
    return {
      authenticated: false,
      logout: true,
      redirectTo: "/auth"
    };
  },
  getIdentity: async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return null;
    return {
      id: user.id,
      name: user.email ?? user.id,
      email: user.email
    };
  },
  logout: async () => {
    await supabase.auth.signOut();
    return { success: true, redirectTo: "/auth" };
  },
  onError: async (error) => {
    const status = error?.statusCode ?? error?.status;
    if (status === 401 || status === 403) {
      return { logout: true, redirectTo: "/auth" };
    }
    return {};
  }
};

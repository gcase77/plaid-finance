import type { AuthProvider } from "react-admin";
import { supabase } from "../lib/supabase";

const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};

export const authProvider: AuthProvider = {
  async login() {
    // The existing Supabase-backed AuthPage owns form handling; react-admin
    // only needs to re-check auth after it redirects back into the Admin app.
    const session = await getSession();
    if (!session) throw new Error("Please sign in to continue.");
  },

  async logout() {
    await supabase.auth.signOut();
    return "/auth";
  },

  async checkAuth() {
    const session = await getSession();
    if (!session) throw new Error("Not authenticated");
  },

  async checkError(error) {
    const status = error?.status || error?.response?.status;
    if (status === 401 || status === 403) {
      await supabase.auth.signOut();
      throw new Error("Authentication expired");
    }
  },

  async getIdentity() {
    const session = await getSession();
    if (!session?.user) throw new Error("Not authenticated");
    return {
      id: session.user.id,
      fullName: session.user.email ?? session.user.id,
      avatar: undefined
    };
  },

  async getPermissions() {
    return [];
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  const session = await getSession();
  return session?.access_token ?? null;
};

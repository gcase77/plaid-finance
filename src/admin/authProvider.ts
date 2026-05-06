import type { AuthProvider } from "react-admin";
import { supabase } from "../lib/supabase";

const AUTH_PATHS = new Set([
  "/auth",
  "/auth/sign-up",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/login",
  "/l",
  "/l/privacy",
  "/privacy",
  "/terms"
]);

const isPublicPath = () => {
  if (typeof window === "undefined") return false;
  return AUTH_PATHS.has(window.location.pathname);
};

export const authProvider: AuthProvider = {
  login: async ({ username, email, password }) => {
    const signInEmail = String(email || username || "");
    const { error } = await supabase.auth.signInWithPassword({ email: signInEmail, password });
    if (error) throw new Error(error.message || "Unable to sign in.");
  },
  logout: async () => {
    await supabase.auth.signOut();
    return "/auth";
  },
  checkAuth: async () => {
    if (isPublicPath()) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("Not authenticated");
  },
  checkError: async (error) => {
    if (error?.status === 401 || error?.status === 403) {
      await supabase.auth.signOut();
      throw new Error("Session expired");
    }
  },
  getIdentity: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new Error("Not authenticated");
    return {
      id: data.user.id,
      fullName: data.user.email ?? data.user.id
    };
  },
  getPermissions: async () => undefined
};

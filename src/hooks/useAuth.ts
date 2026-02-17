import { useState, useEffect, FormEvent } from "react";
import type { AuthMode } from "../components/types";
import type { SupabaseClient, Session } from "../global";

type UseAuthReturn = {
  supabase: SupabaseClient | null;
  token: string | null;
  userId: string | null;
  userEmail: string;
  isAuthed: boolean;
  authStatus: string;
  authError: boolean;
  authMode: AuthMode;
  setAuthMode: (mode: AuthMode) => void;
  busyAuth: boolean;
  signInEmail: string;
  setSignInEmail: (v: string) => void;
  signInPassword: string;
  setSignInPassword: (v: string) => void;
  signUpEmail: string;
  setSignUpEmail: (v: string) => void;
  signUpPassword: string;
  setSignUpPassword: (v: string) => void;
  signIn: (e: FormEvent) => Promise<void>;
  signUp: (e: FormEvent) => Promise<void>;
  signOut: () => Promise<void>;
  onAuthStateChange: (callback: (userId: string, email: string, token: string) => Promise<void>) => void;
  clearAuth: () => void;
};

export function useAuth(): UseAuthReturn {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [authStatus, setAuthStatus] = useState("");
  const [authError, setAuthError] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("existing");
  const [busyAuth, setBusyAuth] = useState(false);
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [authCallback, setAuthCallback] = useState<((userId: string, email: string, token: string) => Promise<void>) | null>(null);

  const setStatus = (message: string, isError = false) => {
    setAuthStatus(message);
    setAuthError(isError);
  };

  const clearAuth = () => {
    setToken(null);
    setUserId(null);
    setUserEmail("");
  };

  useEffect(() => {
    const boot = async () => {
      const cfg = await fetch("/api/config").then(r => r.ok ? r.json() : {}).catch(() => ({}));
      const supabaseUrl = String(cfg.supabaseUrl || "");
      const supabaseAnonKey = String(cfg.supabaseAnonKey || "");
      const sb = window.supabase?.createClient?.(supabaseUrl, supabaseAnonKey) || null;
      if (!sb) {
        setStatus("Missing Supabase config. Check SUPABASE_URL and SUPABASE_ANON_KEY.", true);
        return;
      }
      setSupabase(sb);

      sb.auth.onAuthStateChange(async (_event: string, session: Session | null) => {
        if (!session?.user) {
          clearAuth();
          return;
        }
        const uid = session.user.id;
        const email = session.user.email || "";
        const accessToken = session.access_token || "";
        setToken(accessToken);
        setUserId(uid);
        setUserEmail(email);
        setStatus("");
        if (authCallback) await authCallback(uid, email, accessToken);
      });

      const current = await sb.auth.getSession();
      const session = current?.data?.session;
      if (session?.user) {
        const uid = session.user.id;
        const email = session.user.email || "";
        const accessToken = session.access_token || "";
        setToken(accessToken);
        setUserId(uid);
        setUserEmail(email);
        setStatus("");
        if (authCallback) await authCallback(uid, email, accessToken);
      }
    };
    void boot();
  }, [authCallback]);

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusyAuth(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: signInEmail.trim(), password: signInPassword });
      if (error) setStatus(`Sign in failed: ${error.message || "unknown error"}`, true);
      else setStatus("Signed in successfully.");
    } finally {
      setBusyAuth(false);
    }
  };

  const signUp = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusyAuth(true);
    try {
      const { error } = await supabase.auth.signUp({ email: signUpEmail.trim(), password: signUpPassword });
      if (error) setStatus(`Sign up failed: ${error.message || "unknown error"}`, true);
      else setStatus("Account created. Sign in now.");
    } finally {
      setBusyAuth(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    clearAuth();
  };

  const onAuthStateChange = (callback: (userId: string, email: string, token: string) => Promise<void>) => {
    setAuthCallback(() => callback);
  };

  return {
    supabase,
    token,
    userId,
    userEmail,
    isAuthed: !!userId,
    authStatus,
    authError,
    authMode,
    setAuthMode,
    busyAuth,
    signInEmail,
    setSignInEmail,
    signInPassword,
    setSignInPassword,
    signUpEmail,
    setSignUpEmail,
    signUpPassword,
    setSignUpPassword,
    signIn,
    signUp,
    signOut,
    onAuthStateChange,
    clearAuth
  };
}

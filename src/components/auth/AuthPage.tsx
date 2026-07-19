import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearPasswordRecoveryState, getPasswordRecoveryState, supabase } from "../../lib/supabase";
import { Alert } from "../shared/ui";

declare const APP_BASE_URL: string;

type AuthMode = "signIn" | "signUp" | "forgotPassword" | "resetPassword";

const COPY: Record<AuthMode, { title: string; submit: string; loading: string }> = {
  signIn: { title: "Sign in", submit: "Sign in", loading: "Signing in…" },
  signUp: { title: "Create account", submit: "Create account", loading: "Creating account…" },
  forgotPassword: { title: "Forgot password", submit: "Send reset link", loading: "Sending…" },
  resetPassword: { title: "Reset password", submit: "Save new password", loading: "Saving…" }
};

export default function AuthPage({ mode }: { mode: AuthMode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [canReset, setCanReset] = useState(mode !== "resetPassword");

  const isSignIn = mode === "signIn", isSignUp = mode === "signUp", isForgot = mode === "forgotPassword", isReset = mode === "resetPassword";
  const resetSuccess = isSignIn && new URLSearchParams(location.search).get("reset") === "success";

  useEffect(() => {
    setError(null); setSubmitting(false); setAcceptedLegal(false);
    setSuccess(resetSuccess ? "Password updated. Please sign in with your new password." : null);
    if (isReset) {
      const r = getPasswordRecoveryState();
      if (r.status === "ready") setCanReset(true);
      else if (r.status === "error") { setCanReset(false); setError(r.errorMessage || "Reset link is invalid or expired."); }
      else setCanReset(false);
      setPassword(""); setConfirmPassword("");
    }
  }, [isReset, location.pathname, location.search, location.hash, resetSuccess]);

  useEffect(() => {
    if (!isReset) return;
    const apply = async () => {
      const r = getPasswordRecoveryState();
      if (r.status === "ready") { setCanReset(true); setError(null); navigate("/auth/reset-password", { replace: true }); return; }
      if (r.status === "error") { setCanReset(false); setError(r.errorMessage || "Reset link is invalid or expired."); await supabase.auth.signOut(); return; }
      if (r.status === "pending") {
        const { data } = await supabase.auth.getSession();
        if (data?.session) { setCanReset(true); setError(null); navigate("/auth/reset-password", { replace: true }); return; }
      }
      setCanReset(false);
    };
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && getPasswordRecoveryState().status === "pending")) void apply();
    });
    void apply();
    return () => { data.subscription.unsubscribe(); };
  }, [isReset, location.hash, location.search, navigate]);

  const redirectBase = APP_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "");

  const handleGoogle = async () => {
    if (submitting) return;
    setError(null); setSuccess(null);
    if (isSignUp && !acceptedLegal) { setError("You must accept the Privacy Policy and Terms of Service."); return; }
    setSubmitting(true);
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${redirectBase}/`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (e) { setError(e.message || "Unable to sign in with Google."); setSubmitting(false); }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null); setSuccess(null);
    if (isReset && !canReset) { setError("This page only works from a valid password reset email link."); return; }
    if ((isSignUp || isReset) && password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (isSignUp && !acceptedLegal) { setError("You must accept the Privacy Policy and Terms of Service."); return; }

    setSubmitting(true);
    try {
      if (isSignIn) {
        const { error: e } = await supabase.auth.signInWithPassword({ email, password });
        if (e) { setError(e.message || "Unable to sign in."); return; }
        navigate("/"); return;
      }
      if (isSignUp) {
        const { error: e } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${redirectBase}/auth` } });
        if (e) { setError(e.message || "Unable to create account."); return; }
        setSuccess("Account created. You may now sign in."); setPassword(""); setConfirmPassword(""); setAcceptedLegal(false); return;
      }
      if (isForgot) {
        const { error: e } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${redirectBase}/auth/reset-password` });
        if (e) { setError(e.message || "Unable to send reset email."); return; }
        clearPasswordRecoveryState();
        setSuccess("If an account exists for this email, a reset link has been sent."); return;
      }
      const { error: e } = await supabase.auth.updateUser({ password });
      if (e) { setError(e.message || "Unable to update password."); return; }
      clearPasswordRecoveryState();
      setCanReset(false);
      navigate("/auth?reset=success");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="centered-pane">
      <div className="card auth-card">
        <div className="row-flex gap-2 mb-4" style={{ justifyContent: "center" }}>
          <Link to="/l" aria-label="Funds Up landing page"><img src="/funds-up-logo.svg" alt="Funds Up" style={{ height: 32 }} /></Link>
        </div>
        <h1>{COPY[mode].title}</h1>
        {error && <div className="mb-3"><Alert tone="danger">{error}</Alert></div>}
        {success && <div className="mb-3"><Alert tone="success">{success}</Alert></div>}
        {isReset && !canReset && !error && <div className="mb-3"><Alert tone="warning">Open the link from your reset email to set a new password.</Alert></div>}

        <form onSubmit={handleSubmit} className="col-flex">
          {!isReset && (
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
            </div>
          )}
          {!isForgot && (
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          )}
          {(isSignUp || isReset) && (
            <div className="field">
              <label htmlFor="confirmPassword">Confirm password</label>
              <input id="confirmPassword" type="password" className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
          )}
          {isSignUp && (
            <label className="check small">
              <input type="checkbox" checked={acceptedLegal} onChange={(e) => setAcceptedLegal(e.target.checked)} required />
              <span>I have read the <Link to="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link> and <Link to="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</Link>.</span>
            </label>
          )}
          <button type="submit" className="btn primary btn-block" disabled={submitting || (isReset && !canReset) || (isSignUp && !acceptedLegal)}>
            {submitting ? COPY[mode].loading : COPY[mode].submit}
          </button>
        </form>

        {(isSignIn || isSignUp) && (
          <>
            <div className="auth-divider" aria-hidden="true"><span>or</span></div>
            <button
              type="button"
              className="btn ghost btn-block"
              onClick={() => void handleGoogle()}
              disabled={submitting || (isSignUp && !acceptedLegal)}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.3 3.7-4.6 6.4-8.3 7.5l.1.1 6.3 5.3C35.2 42.4 44 36 44 24c0-1.3-.1-2.7-.4-3.5z"/>
              </svg>
              Continue with Google
            </button>
          </>
        )}

        <div className="auth-links">
          {isSignIn && <><Link to="/auth/sign-up">Create account</Link><Link to="/auth/forgot-password">Forgot password?</Link></>}
          {isSignUp && <Link to="/auth">Already have an account? Sign in</Link>}
          {(isForgot || isReset) && <Link to="/auth">Back to sign in</Link>}
        </div>
      </div>
    </div>
  );
}

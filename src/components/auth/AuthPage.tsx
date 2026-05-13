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
        const { error: e } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${APP_BASE_URL}/auth` } });
        if (e) { setError(e.message || "Unable to create account."); return; }
        setSuccess("Account created. You may now sign in."); setPassword(""); setConfirmPassword(""); setAcceptedLegal(false); return;
      }
      if (isForgot) {
        const { error: e } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${APP_BASE_URL}/auth/reset-password` });
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
              <span>I have read the <Link to="/privacy" target="_blank">Privacy Policy</Link> and <Link to="/terms" target="_blank">Terms of Service</Link>.</span>
            </label>
          )}
          <button type="submit" className="btn primary btn-block" disabled={submitting || (isReset && !canReset) || (isSignUp && !acceptedLegal)}>
            {submitting ? COPY[mode].loading : COPY[mode].submit}
          </button>
        </form>

        <div className="auth-links">
          {isSignIn && <><Link to="/auth/sign-up">Create account</Link><Link to="/auth/forgot-password">Forgot password?</Link></>}
          {isSignUp && <Link to="/auth">Already have an account? Sign in</Link>}
          {(isForgot || isReset) && <Link to="/auth">Back to sign in</Link>}
        </div>
      </div>
    </div>
  );
}

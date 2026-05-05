import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  clearPasswordRecoveryState,
  getPasswordRecoveryState,
  supabase
} from "../../lib/supabase";

declare const APP_BASE_URL: string;

type AuthMode = "signIn" | "signUp" | "forgotPassword" | "resetPassword";

type AuthPageProps = {
  mode: AuthMode;
};

export default function AuthPage({ mode }: AuthPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canResetPassword, setCanResetPassword] = useState(mode !== "resetPassword");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);

  const isSignIn = mode === "signIn";
  const isSignUp = mode === "signUp";
  const isForgot = mode === "forgotPassword";
  const isReset = mode === "resetPassword";
  const resetSuccess = isSignIn && new URLSearchParams(location.search).get("reset") === "success";

  useEffect(() => {
    setError(null);
    setIsSubmitting(false);
    setSuccess(resetSuccess ? "Password updated. Please sign in with your new password." : null);
    if (isReset) {
      const recoveryState = getPasswordRecoveryState();
      if (recoveryState.status === "ready") {
        setCanResetPassword(true);
      } else if (recoveryState.status === "error") {
        setCanResetPassword(false);
        setError(recoveryState.errorMessage || "Reset link is invalid or expired. Request a new reset email.");
      } else {
        setCanResetPassword(false);
      }
      setPassword("");
      setConfirmPassword("");
    }
  }, [isReset, location.pathname, location.search, location.hash, resetSuccess]);

  useEffect(() => {
    if (!isReset) return;
    const applyRecoveryState = async () => {
      const recoveryState = getPasswordRecoveryState();
      if (recoveryState.status === "ready") {
        setCanResetPassword(true);
        setError(null);
        navigate("/auth/reset-password", { replace: true });
        return;
      }
      if (recoveryState.status === "error") {
        setCanResetPassword(false);
        setError(recoveryState.errorMessage || "Reset link is invalid or expired. Request a new reset email.");
        await supabase.auth.signOut();
        return;
      }

      // Fallback when URL params were consumed before component mount.
      if (recoveryState.status === "pending") {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          setCanResetPassword(true);
          setError(null);
          navigate("/auth/reset-password", { replace: true });
          return;
        }
      }

      setCanResetPassword(false);
    };

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        void applyRecoveryState();
        return;
      }
      if (event === "SIGNED_IN" && getPasswordRecoveryState().status === "pending") {
        void applyRecoveryState();
      }
    });

    void applyRecoveryState();

    return () => {
      data.subscription.unsubscribe();
    };
  }, [isReset, location.hash, location.search, navigate]);

  const title = isSignIn
    ? "Sign In"
    : isSignUp
      ? "Create Account"
      : isForgot
        ? "Forgot Password"
        : "Reset Password";

  const submitText = isSignIn
    ? "Sign In"
    : isSignUp
      ? "Create Account"
      : isForgot
        ? "Send Reset Link"
        : "Save New Password";

  const loadingText = isSignIn
    ? "Signing In..."
    : isSignUp
      ? "Creating Account..."
      : isForgot
        ? "Sending..."
        : "Saving...";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setSuccess(null);

    if (isReset && !canResetPassword) {
      setError("This page only works from a valid password reset email link.");
      return;
    }

    if ((isSignUp || isReset) && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (isSignUp && !acceptedLegal) {
      setError("You must accept the Privacy Policy and Terms before creating an account.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignIn) {
        if (mfaFactorId) {
          const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: mfaFactorId, code: mfaCode });
          if (verifyError) {
            setError(verifyError.message || "Unable to verify MFA code.");
            return;
          }
          navigate("/");
          return;
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(signInError.message || "Unable to sign in.");
          return;
        }

        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalData.nextLevel === "aal2" && aalData.currentLevel !== "aal2") {
          const { data: factorsData } = await supabase.auth.mfa.listFactors();
          const factor = factorsData.totp[0];
          if (!factor) {
            setError("MFA is required, but no authenticator factor was found for this account.");
            return;
          }
          setMfaFactorId(factor.id);
          setSuccess("Enter your authenticator app code to finish signing in.");
          return;
        }

        navigate("/");
        return;
      }

      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${APP_BASE_URL}/auth` }
        });
        if (signUpError) {
          setError(signUpError.message || "Unable to create account.");
          return;
        }
        setSuccess("Account created. You may now sign in");
        setPassword("");
        setConfirmPassword("");
        return;
      }

      if (isForgot) {
        const { error: forgotError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${APP_BASE_URL}/auth/reset-password`
        });
        if (forgotError) {
          setError(forgotError.message || "Unable to send reset email.");
          return;
        }
        clearPasswordRecoveryState();
        setSuccess("If an account exists for this email, a reset link has been sent.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message || "Unable to update password.");
        return;
      }
      clearPasswordRecoveryState();
      setCanResetPassword(false);
      navigate("/auth?reset=success");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-md-6 col-lg-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title mb-3">{title}</h5>

              {error && <div className="alert alert-danger py-2">{error}</div>}
              {success && <div className="alert alert-success py-2">{success}</div>}
              {isReset && !canResetPassword && !error && (
                <div className="alert alert-warning py-2">
                  Open the link from your reset email to set a new password.
                </div>
              )}

              <form onSubmit={handleSubmit}>
                {!isReset && (
                  <div className="mb-3">
                    <label className="form-label" htmlFor="email">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      className="form-control"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                )}

                {!isForgot && (
                  <div className="mb-3">
                    <label className="form-label" htmlFor="password">
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      className="form-control"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                )}

                {(isSignUp || isReset) && (
                  <div className="mb-3">
                    <label className="form-label" htmlFor="confirmPassword">
                      Confirm Password
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      className="form-control"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                )}



                {isSignUp && (
                  <div className="form-check mb-3">
                    <input
                      id="legalConsent"
                      type="checkbox"
                      className="form-check-input"
                      checked={acceptedLegal}
                      onChange={(e) => setAcceptedLegal(e.target.checked)}
                      required
                    />
                    <label className="form-check-label small" htmlFor="legalConsent">
                      I have read and agree to the <Link to="/privacy">Privacy Policy</Link> and <Link to="/terms">Terms</Link>.
                    </label>
                  </div>
                )}

                {isSignIn && mfaFactorId && (
                  <div className="mb-3">
                    <label className="form-label" htmlFor="mfaCode">Authenticator code</label>
                    <input
                      id="mfaCode"
                      inputMode="numeric"
                      className="form-control"
                      placeholder="123456"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      required
                    />
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={isSubmitting || (isReset && !canResetPassword)}
                >
                  {isSubmitting ? loadingText : submitText}
                </button>
              </form>

              <div className="mt-3 small d-flex flex-wrap gap-2">
                {isSignIn && (
                  <>
                    <Link to="/auth/sign-up">New user? Create account</Link>
                    <Link to="/auth/forgot-password">Forgot password?</Link>
                  </>
                )}
                {isSignUp && <Link to="/auth">Already have an account? Sign in</Link>}
                {isForgot && <Link to="/auth">Back to sign in</Link>}
                {isReset && <Link to="/auth">Back to sign in</Link>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

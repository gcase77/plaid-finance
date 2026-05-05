import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type TotpFactor = {
  id: string;
  friendly_name?: string | null;
  status?: string;
};

type MfaChallengeProps = {
  onVerified: () => void;
  onSignOut?: () => void | Promise<void>;
};

export default function MfaChallenge({ onVerified, onSignOut }: MfaChallengeProps) {
  const [factor, setFactor] = useState<TotpFactor | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadFactor = async () => {
      setIsLoading(true);
      setError(null);
      const { data, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;

      if (factorsError) {
        setError(factorsError.message || "Unable to load your MFA factors.");
        setIsLoading(false);
        return;
      }

      const verifiedTotpFactor = data.totp.find((totpFactor) => totpFactor.status === "verified") ?? null;
      setFactor(verifiedTotpFactor);
      if (!verifiedTotpFactor) {
        setError("No verified authenticator app was found for this account.");
      }
      setIsLoading(false);
    };

    void loadFactor();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!factor || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challengeError) {
        setError(challengeError.message || "Unable to start MFA verification.");
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.id,
        code
      });
      if (verifyError) {
        setError(verifyError.message || "Invalid authenticator code.");
        return;
      }

      setCode("");
      onVerified();
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
              <h5 className="card-title mb-3">Two-factor authentication</h5>
              <p className="text-muted small">
                Enter the 6-digit code from your authenticator app to continue.
              </p>

              {error && <div className="alert alert-danger py-2">{error}</div>}

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label" htmlFor="mfaCode">
                    Authenticator code
                  </label>
                  <input
                    id="mfaCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="form-control"
                    value={code}
                    onChange={(event) => setCode(event.target.value.trim())}
                    required
                    disabled={isLoading || !factor}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={isLoading || !factor || isSubmitting}
                >
                  {isSubmitting ? "Verifying..." : "Verify"}
                </button>
              </form>

              {onSignOut && (
                <button type="button" className="btn btn-link w-100 mt-2" onClick={onSignOut}>
                  Sign out
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

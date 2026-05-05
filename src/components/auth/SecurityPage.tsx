import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type TotpFactor = {
  id: string;
  friendly_name?: string | null;
  status?: string;
};

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string | null;
};

const FACTOR_NAME = "Funds Up authenticator app";

export default function SecurityPage() {
  const [verifiedFactors, setVerifiedFactors] = useState<TotpFactor[]>([]);
  const [unverifiedFactors, setUnverifiedFactors] = useState<TotpFactor[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingEnrollment, setIsStartingEnrollment] = useState(false);
  const [isVerifyingEnrollment, setIsVerifyingEnrollment] = useState(false);
  const [removingFactorId, setRemovingFactorId] = useState<string | null>(null);

  const loadFactors = async () => {
    setIsLoading(true);
    setError(null);
    const { data, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) {
      setError(factorsError.message || "Unable to load MFA settings.");
      setIsLoading(false);
      return;
    }

    setVerifiedFactors(data.totp.filter((factor) => factor.status === "verified"));
    setUnverifiedFactors(data.totp.filter((factor) => factor.status !== "verified"));
    setIsLoading(false);
  };

  const removeUnverifiedFactors = async () => {
    const { data, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) return;

    await Promise.all(
      data.totp
        .filter((factor) => factor.status !== "verified")
        .map((factor) => supabase.auth.mfa.unenroll({ factorId: factor.id }))
    );
  };

  useEffect(() => {
    void loadFactors();
  }, []);

  const startEnrollment = async () => {
    if (isStartingEnrollment) return;

    setError(null);
    setSuccess(null);
    setIsStartingEnrollment(true);
    try {
      await removeUnverifiedFactors();
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: FACTOR_NAME
      });
      if (enrollError) {
        setError(enrollError.message || "Unable to start authenticator app setup.");
        return;
      }

      setEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret ?? null
      });
      setVerificationCode("");
    } finally {
      setIsStartingEnrollment(false);
    }
  };

  const verifyEnrollment = async (event: FormEvent) => {
    event.preventDefault();
    if (!enrollment || isVerifyingEnrollment) return;

    setError(null);
    setSuccess(null);
    setIsVerifyingEnrollment(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrollment.factorId
      });
      if (challengeError) {
        setError(challengeError.message || "Unable to verify authenticator app.");
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollment.factorId,
        challengeId: challenge.id,
        code: verificationCode
      });
      if (verifyError) {
        setError(verifyError.message || "Invalid authenticator code.");
        return;
      }

      setEnrollment(null);
      setVerificationCode("");
      setSuccess("Authenticator app MFA is now enabled for your account.");
      await supabase.auth.refreshSession();
      await loadFactors();
    } finally {
      setIsVerifyingEnrollment(false);
    }
  };

  const cancelEnrollment = async () => {
    if (!enrollment) return;
    setRemovingFactorId(enrollment.factorId);
    setError(null);
    setSuccess(null);
    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId });
      if (unenrollError) {
        setError(unenrollError.message || "Unable to cancel authenticator app setup.");
        return;
      }
      setEnrollment(null);
      setVerificationCode("");
      await loadFactors();
    } finally {
      setRemovingFactorId(null);
    }
  };

  const removeFactor = async (factorId: string) => {
    setRemovingFactorId(factorId);
    setError(null);
    setSuccess(null);
    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
      if (unenrollError) {
        setError(unenrollError.message || "Unable to remove authenticator app MFA.");
        return;
      }
      setSuccess("Authenticator app MFA has been removed.");
      await supabase.auth.refreshSession();
      await loadFactors();
    } finally {
      setRemovingFactorId(null);
    }
  };

  const hasVerifiedMfa = verifiedFactors.length > 0;
  const canStartEnrollment = !enrollment && !isLoading && !hasVerifiedMfa;

  return (
    <div className="row justify-content-center">
      <div className="col-12 col-lg-7">
        <div className="card">
          <div className="card-body">
            <h5 className="card-title mb-3">Security</h5>
            <p className="text-muted">
              Multi-factor authentication is optional. If you enable it, you will need an authenticator app code
              whenever you sign in.
            </p>

            {error && <div className="alert alert-danger py-2">{error}</div>}
            {success && <div className="alert alert-success py-2">{success}</div>}

            <div className="border rounded p-3 mb-3">
              <div className="d-flex justify-content-between align-items-start gap-3">
                <div>
                  <h6 className="mb-1">Authenticator app MFA</h6>
                  <p className="text-muted small mb-0">
                    Use apps such as 1Password, Google Authenticator, Microsoft Authenticator, or Authy.
                  </p>
                </div>
                <span className={`badge ${hasVerifiedMfa ? "text-bg-success" : "text-bg-secondary"}`}>
                  {hasVerifiedMfa ? "Enabled" : "Off"}
                </span>
              </div>

              {isLoading && <p className="text-muted small mb-0 mt-3">Loading MFA settings...</p>}

              {!isLoading && hasVerifiedMfa && (
                <div className="mt-3">
                  {verifiedFactors.map((factor) => (
                    <div
                      key={factor.id}
                      className="d-flex justify-content-between align-items-center gap-3 border-top pt-3 mt-3"
                    >
                      <div className="small">
                        <div className="fw-semibold">{factor.friendly_name || "Authenticator app"}</div>
                        <div className="text-muted">Factor ID: {factor.id}</div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => void removeFactor(factor.id)}
                        disabled={removingFactorId === factor.id}
                      >
                        {removingFactorId === factor.id ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {canStartEnrollment && (
                <button
                  type="button"
                  className="btn btn-primary mt-3"
                  onClick={() => void startEnrollment()}
                  disabled={isStartingEnrollment}
                >
                  {isStartingEnrollment ? "Starting setup..." : "Set up authenticator app"}
                </button>
              )}
            </div>

            {enrollment && (
              <div className="border rounded p-3">
                <h6>Scan the QR code</h6>
                <p className="text-muted small">
                  Scan this QR code with your authenticator app, then enter the 6-digit code it generates.
                </p>
                <img src={enrollment.qrCode} alt="Authenticator app setup QR code" className="img-fluid mb-3" />
                {enrollment.secret && (
                  <p className="small">
                    If you cannot scan the QR code, enter this setup key manually:{" "}
                    <code className="user-select-all">{enrollment.secret}</code>
                  </p>
                )}

                <form onSubmit={verifyEnrollment}>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="enrollmentCode">
                      Authenticator code
                    </label>
                    <input
                      id="enrollmentCode"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className="form-control"
                      value={verificationCode}
                      onChange={(event) => setVerificationCode(event.target.value.trim())}
                      required
                    />
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <button type="submit" className="btn btn-primary" disabled={isVerifyingEnrollment}>
                      {isVerifyingEnrollment ? "Enabling..." : "Enable MFA"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => void cancelEnrollment()}
                      disabled={removingFactorId === enrollment.factorId}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {!enrollment && unverifiedFactors.length > 0 && (
              <p className="text-muted small mb-0">
                You have an incomplete MFA setup. Start setup again to generate a new QR code.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

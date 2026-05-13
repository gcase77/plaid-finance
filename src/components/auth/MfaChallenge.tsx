import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Alert } from "../shared/ui";

type Factor = { id: string; friendly_name?: string | null; status?: string };

export default function MfaChallenge({ onVerified, onSignOut }: { onVerified: () => void; onSignOut?: () => void | Promise<void> }) {
  const [factor, setFactor] = useState<Factor | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      const { data, error: e } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (e) { setError(e.message || "Unable to load your MFA factors."); setLoading(false); return; }
      const f = data.totp.find((t) => t.status === "verified") ?? null;
      setFactor(f);
      if (!f) setError("No verified authenticator app was found for this account.");
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!factor || submitting) return;
    setError(null); setSubmitting(true);
    try {
      const { data: ch, error: ce } = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (ce) { setError(ce.message || "Unable to start MFA verification."); return; }
      const { error: ve } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: ch.id, code });
      if (ve) { setError(ve.message || "Invalid authenticator code."); return; }
      setCode(""); onVerified();
    } finally { setSubmitting(false); }
  };

  return (
    <div className="centered-pane">
      <div className="card auth-card">
        <h1>Two-factor authentication</h1>
        <p className="small muted mb-3">Enter the 6-digit code from your authenticator app to continue.</p>
        {error && <div className="mb-3"><Alert tone="danger">{error}</Alert></div>}
        <form onSubmit={handleSubmit} className="col-flex">
          <div className="field">
            <label htmlFor="mfaCode">Authenticator code</label>
            <input id="mfaCode" type="text" inputMode="numeric" autoComplete="one-time-code" className="input"
              value={code} onChange={(e) => setCode(e.target.value.trim())} required disabled={loading || !factor} />
          </div>
          <button type="submit" className="btn primary btn-block" disabled={loading || !factor || submitting}>
            {submitting ? "Verifying…" : "Verify"}
          </button>
        </form>
        {onSignOut && <button type="button" className="btn link mt-3" onClick={onSignOut} style={{ width: "100%", justifyContent: "center" }}>Sign out</button>}
      </div>
    </div>
  );
}

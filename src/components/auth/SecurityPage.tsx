import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { applyStoredTheme, persistTheme, readStoredTheme, APP_THEME_KEY, type AppThemeMode } from "../../lib/appTheme";
import { supabase } from "../../lib/supabase";
import { Alert } from "../shared/ui";

type Factor = { id: string; friendly_name?: string | null; status?: string };
type Enrollment = { factorId: string; qrCode: string; secret: string | null };

const FACTOR_NAME = "Funds Up authenticator app";

export default function SecurityPage() {
  const [verified, setVerified] = useState<Factor[]>([]);
  const [unverified, setUnverified] = useState<Factor[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"start" | "verify" | string | null>(null);
  const [signOutErr, setSignOutErr] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [themeMode, setThemeMode] = useState<AppThemeMode>(() => readStoredTheme());

  const load = async () => {
    setLoading(true); setError(null);
    const { data, error: e } = await supabase.auth.mfa.listFactors();
    if (e) { setError(e.message || "Unable to load MFA settings."); setLoading(false); return; }
    setVerified(data.totp.filter((f) => f.status === "verified"));
    setUnverified(data.totp.filter((f) => f.status !== "verified"));
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== APP_THEME_KEY) return;
      applyStoredTheme();
      setThemeMode(readStoredTheme());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const removeUnverified = async () => {
    const { data, error: e } = await supabase.auth.mfa.listFactors();
    if (e) throw e;
    const outs = await Promise.all(data.totp.filter((f) => f.status !== "verified").map((f) => supabase.auth.mfa.unenroll({ factorId: f.id })));
    const ue = outs.find((o) => o.error)?.error;
    if (ue) throw ue;
  };

  const startEnroll = async () => {
    setError(null); setSuccess(null); setBusy("start");
    try {
      await removeUnverified();
      const { data, error: e } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: FACTOR_NAME });
      if (e) { setError(e.message || "Unable to start setup."); return; }
      setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret ?? null });
      setCode("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to prepare MFA setup.");
    } finally { setBusy(null); }
  };

  const verifyEnroll = async (e: FormEvent) => {
    e.preventDefault();
    if (!enrollment) return;
    setError(null); setSuccess(null); setBusy("verify");
    try {
      const { data: ch, error: ce } = await supabase.auth.mfa.challenge({ factorId: enrollment.factorId });
      if (ce) { setError(ce.message || "Unable to verify."); return; }
      const { error: ve } = await supabase.auth.mfa.verify({ factorId: enrollment.factorId, challengeId: ch.id, code });
      if (ve) { setError(ve.message || "Invalid authenticator code."); return; }
      setEnrollment(null); setCode("");
      setSuccess("Authenticator app MFA is now enabled.");
      await supabase.auth.refreshSession();
      await load();
    } finally { setBusy(null); }
  };

  const cancelEnroll = async () => {
    if (!enrollment) return;
    setBusy(enrollment.factorId); setError(null); setSuccess(null);
    try {
      const { error: e } = await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId });
      if (e) { setError(e.message || "Unable to cancel setup."); return; }
      setEnrollment(null); setCode("");
      await load();
    } finally { setBusy(null); }
  };

  const removeFactor = async (factorId: string) => {
    setBusy(factorId); setError(null); setSuccess(null);
    try {
      const { error: e } = await supabase.auth.mfa.unenroll({ factorId });
      if (e) { setError(e.message || "Unable to remove MFA."); return; }
      setSuccess("Authenticator app MFA has been removed.");
      await supabase.auth.refreshSession();
      await load();
    } finally { setBusy(null); }
  };

  const has = verified.length > 0;
  const canStart = !enrollment && !loading && !has;

  return (
    <div className="account-page">
      <header className="page-header">
        <div>
          <h1>Account</h1>
          <p className="desc">Manage multi-factor authentication for your account.</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn ghost"
            disabled={signingOut}
            onClick={() => {
              setSignOutErr(null);
              setSigningOut(true);
              void supabase.auth.signOut()
                .then(({ error: se }) => { if (se) setSignOutErr(se.message || "Sign out failed."); })
                .catch(() => setSignOutErr("Sign out failed."))
                .finally(() => setSigningOut(false));
            }}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>

      {signOutErr && <div className="mb-3"><Alert tone="danger" onClose={() => setSignOutErr(null)}>{signOutErr}</Alert></div>}
      {error && <div className="mb-3"><Alert tone="danger" onClose={() => setError(null)}>{error}</Alert></div>}
      {success && <div className="mb-3"><Alert tone="success" onClose={() => setSuccess(null)}>{success}</Alert></div>}

      <div className="card mb-4">
        <div className="between mb-3">
          <div>
            <h3>Appearance</h3>
            <p className="small muted mt-2">Match your device or pick a fixed look.</p>
          </div>
        </div>
        <div className="segmented" role="group" aria-label="Theme">
          <button type="button" className={themeMode === "system" ? "active" : ""} onClick={() => { setThemeMode("system"); persistTheme("system"); }}>System</button>
          <button type="button" className={themeMode === "light" ? "active" : ""} onClick={() => { setThemeMode("light"); persistTheme("light"); }}>Light</button>
          <button type="button" className={themeMode === "dark" ? "active" : ""} onClick={() => { setThemeMode("dark"); persistTheme("dark"); }}>Dark</button>
        </div>
      </div>

      <div className="card mb-4">
        <div className="between mb-3">
          <div>
            <h3>Authenticator app MFA</h3>
            <p className="small muted mt-2">Use apps like 1Password, Google Authenticator, Microsoft Authenticator, or Authy.</p>
          </div>
          <span className={`chip ${has ? "chip-success" : ""}`}>{has ? "Enabled" : "Off"}</span>
        </div>

        {loading && <p className="muted small">Loading MFA settings…</p>}

        {!loading && has && verified.map((f) => (
          <div key={f.id} className="between" style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 12 }}>
            <div className="small">
              <div className="fw-semi">{f.friendly_name || "Authenticator app"}</div>
              <div className="muted xs">Factor ID: {f.id}</div>
            </div>
            <button className="btn danger-ghost btn-sm" onClick={() => void removeFactor(f.id)} disabled={busy === f.id}>
              {busy === f.id ? "Removing…" : "Remove"}
            </button>
          </div>
        ))}

        {canStart && <button className="btn primary mt-3" onClick={() => void startEnroll()} disabled={busy === "start"}>{busy === "start" ? "Starting setup…" : "Set up authenticator app"}</button>}
      </div>

      {enrollment && (
        <div className="card">
          <h3>Scan the QR code</h3>
          <p className="small muted mt-2 mb-3">Scan with your authenticator app, then enter the 6-digit code below.</p>
          <img src={enrollment.qrCode} alt="Authenticator app setup QR code" style={{ width: "100%", maxWidth: 220, marginBottom: 12 }} />
          {enrollment.secret && <p className="small mb-3">Or enter this key manually: <code style={{ userSelect: "all" }}>{enrollment.secret}</code></p>}
          <form onSubmit={verifyEnroll} className="col-flex">
            <div className="field">
              <label htmlFor="enrollmentCode">Authenticator code</label>
              <input id="enrollmentCode" type="text" inputMode="numeric" autoComplete="one-time-code" className="input" value={code} onChange={(e) => setCode(e.target.value.trim())} required />
            </div>
            <div className="row-flex gap-2">
              <button type="submit" className="btn primary" disabled={busy === "verify"}>{busy === "verify" ? "Enabling…" : "Enable MFA"}</button>
              <button type="button" className="btn ghost" onClick={() => void cancelEnroll()} disabled={busy === enrollment.factorId}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {!enrollment && unverified.length > 0 && <p className="muted small">You have an incomplete MFA setup. Start setup again to generate a new QR code.</p>}

      <nav className="account-legal" aria-label="Legal">
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/terms">Terms of Service</Link>
      </nav>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { buildAuthHeaders } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { Modal } from "./ui";

type Props = {
  open: boolean;
  reason?: "add_bank" | "sync" | null;
  onClose: () => void;
};

const TITLE: Record<"add_bank" | "sync", string> = {
  add_bank: "Upgrade to link unlimited banks",
  sync: "Upgrade for unlimited syncs"
};

export function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M3.5 9h11M10 4.5 14.5 9 10 13.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PaywallModal({ open, reason = "add_bank", onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [arrow, setArrow] = useState<"in" | "out" | "reset">("reset");
  const leaveTimer = useRef<number | null>(null);

  useEffect(() => () => { if (leaveTimer.current) window.clearTimeout(leaveTimer.current); }, []);
  useEffect(() => {
    if (!open) {
      if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
      setArrow("reset");
      setBusy(false);
      setError(null);
    }
  }, [open]);

  const onCheckout = async () => {
    setBusy(true); setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Not signed in");
      const res = await fetch("/api/billing/checkout", { method: "POST", headers: buildAuthHeaders(token) });
      const body = await res.json().catch(() => ({})) as { url?: string; error?: string };
      if (!res.ok || !body.url) throw new Error(body.error || `Checkout failed (${res.status})`);
      window.location.href = body.url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to start checkout.");
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={TITLE[reason === "sync" ? "sync" : "add_bank"]}
      onClose={onClose}
      showClose={false}
    >
      <div className="paywall-cta">
        <button
          type="button"
          className={`btn primary btn-pricing${arrow === "in" ? " is-hot" : ""}`}
          disabled={busy}
          onClick={() => void onCheckout()}
          onMouseEnter={() => {
            if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
            setArrow("in");
          }}
          onMouseLeave={() => {
            setArrow("out");
            leaveTimer.current = window.setTimeout(() => setArrow("reset"), 280);
          }}
        >
          <span className={`btn-pricing-arrow ${arrow}`}><ArrowIcon /></span>
          <span className="btn-pricing-label">{busy ? "Redirecting…" : "Check Pricing"}</span>
        </button>
        <button type="button" className="btn ghost" onClick={onClose}>Not now</button>
        {error && <p className="danger-text mt-3" style={{ marginBottom: 0, width: "100%", textAlign: "center" }}>{error}</p>}
      </div>
    </Modal>
  );
}

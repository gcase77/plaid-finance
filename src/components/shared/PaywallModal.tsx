import { Modal } from "./ui";

type Props = {
  open: boolean;
  reason?: "add_bank" | "sync" | null;
  onClose: () => void;
};

const COPY: Record<"add_bank" | "sync", { title: string; body: string }> = {
  add_bank: {
    title: "Upgrade to link another bank",
    body: "Free accounts can connect one bank. Upgrade to link more institutions."
  },
  sync: {
    title: "Upgrade to sync again",
    body: "Free accounts get one transaction sync. Upgrade for unlimited syncs."
  }
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

/** Placeholder paywall — checkout wiring comes later. */
export default function PaywallModal({ open, reason = "add_bank", onClose }: Props) {
  const copy = COPY[reason === "sync" ? "sync" : "add_bank"];
  return (
    <Modal
      open={open}
      title={copy.title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>Not now</button>
          <button type="button" className="btn primary" disabled title="Coming soon">
            Upgrade (coming soon)
          </button>
        </>
      }
    >
      <p className="muted" style={{ margin: 0 }}>{copy.body}</p>
    </Modal>
  );
}

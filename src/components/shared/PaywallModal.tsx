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

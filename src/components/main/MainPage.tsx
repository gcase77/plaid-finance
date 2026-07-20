import { useEffect, useState } from "react";
import { getTextColorForBackground } from "../../utils/transactionUtils";
import type { Session } from "@supabase/supabase-js";
import { useEntitlements } from "../../hooks/useEntitlements";
import { usePlaidData } from "../../hooks/usePlaidData";
import { supabase } from "../../lib/supabase";
import type { PaymentRequiredReason } from "../../lib/entitlements";
import type { Account, AccountBalances, Item } from "../types";
import LoadingSpinner from "../shared/LoadingSpinner";
import PaywallModal, { LockIcon } from "../shared/PaywallModal";
import { Alert, ClickEditNumber, Modal, Tooltip } from "../shared/ui";

const BANKS_COLLAPSE_KEY = "funds-up-home-banks-all-collapsed";

function syncBanksCollapseStorage(next: Record<string, boolean>, its: Item[]) {
  if (!its.length) return;
  const allCollapsed = its.every((i) => !(next[i.id] ?? true));
  const allOpen = its.every((i) => (next[i.id] ?? true));
  if (allCollapsed) localStorage.setItem(BANKS_COLLAPSE_KEY, "1");
  else if (allOpen) localStorage.setItem(BANKS_COLLAPSE_KEY, "0");
}

const DELETE_WARNING =
  "Removing a bank permanently deletes its accounts and all transaction history in Funds Up. You can re-link later, but past data will not be restored.";

function fmtMoney(n: number | null | undefined, currency = "USD") {
  if (n == null || Number.isNaN(n)) return "—";
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n); }
  catch { return String(n); }
}

function readBalances(b: AccountBalances | null | undefined) {
  if (!b || typeof b !== "object") return { current: null, available: null, limit: null, currency: "USD" } as const;
  return {
    current: typeof b.current === "number" ? b.current : null,
    available: typeof b.available === "number" ? b.available : null,
    limit: typeof b.limit === "number" ? b.limit : null,
    currency: typeof b.iso_currency_code === "string" && b.iso_currency_code ? b.iso_currency_code : "USD"
  };
}

function logoSrc(logo: string | null | undefined) {
  if (!logo) return null;
  return logo.startsWith("data:") ? logo : `data:image/png;base64,${logo}`;
}

function brandColor(color: string | null | undefined) {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : null;
}

function CreditBar({ current, available, limit, currency }: { current: number; available: number | null; limit: number; currency: string }) {
  const fmt = (n: number | null) => fmtMoney(n, currency);
  const over = current > limit;
  const curPct = Math.min(100, (current / Math.max(limit, current)) * 100);
  const availNum = available ?? 0;
  const limitForAvail = Math.max(limit, current);
  const availPct = limitForAvail > 0 ? Math.max(0, Math.min(100 - curPct, (availNum / limitForAvail) * 100)) : 0;
  const usedColor = over ? "var(--danger)" : "var(--brand)";
  return (
    <div>
      <div className="bar" title={`Balance ${fmt(current)} · available ${fmt(available)} · limit ${fmt(limit)}`}>
        <div style={{ left: 0, width: `${curPct}%`, background: usedColor, opacity: 0.85 }} />
        <div style={{ left: `${curPct}%`, width: `${availPct}%`, background: "var(--success)", opacity: 0.5 }} />
      </div>
      <div className="row-flex between xs muted mt-2">
        <span>Balance {fmt(current)}</span>
        <span>Available {fmt(available)}</span>
        <span>Limit {fmt(limit)}</span>
      </div>
    </div>
  );
}

function AccountRow({ account }: { account: Account }) {
  const { current, available, limit, currency } = readBalances(account.balances);
  const isCredit = account.type?.toLowerCase() === "credit";
  return (
    <div style={{ padding: "var(--s3) var(--s4)", borderTop: "1px solid var(--line)" }}>
      <div className="between">
        <div>
          <div className="fw-semi">{account.official_name ?? account.name ?? "Account"}</div>
          {account.subtype && <div className="xs muted" style={{ textTransform: "capitalize" }}>{account.subtype}</div>}
        </div>
        {!isCredit && (
          <div style={{ textAlign: "right" }}>
            <div className="fw-semi">{fmtMoney(current, currency)}</div>
            {available != null && <div className="xs muted">{fmtMoney(available, currency)} available</div>}
          </div>
        )}
      </div>
      {isCredit && limit != null && limit > 0 && current != null && (
        <div style={{ marginTop: 10 }}><CreditBar current={current} available={available} limit={limit} currency={currency} /></div>
      )}
      {isCredit && (limit == null || limit === 0) && (
        <div className="xs muted mt-2">Balance {fmtMoney(current, currency)}{available != null ? ` · Available ${fmtMoney(available, currency)}` : ""}</div>
      )}
    </div>
  );
}

export default function MainPage() {
  const [session, setSession] = useState<Session | null>(null);
  const userId = session?.user?.id ?? null;
  const token = session?.access_token ?? null;
  const { items, accountsByItem, loadingItems, loadItems, linkBank, deleteItem, refreshItemAccounts } = usePlaidData(userId, token);
  const { canAddBank } = useEntitlements(token);

  const [showHistoryPicker, setShowHistoryPicker] = useState(false);
  const [historyDays, setHistoryDays] = useState(730);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [deleteMode, setDeleteMode] = useState(false);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ itemId: string; label: string; nAcc: number } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ tone: "info" | "warning"; text: string } | null>(null);
  const [paywallReason, setPaywallReason] = useState<PaymentRequiredReason | null>(null);

  const startLinkFlow = () => {
    if (!canAddBank) {
      setPaywallReason("add_bank");
      return;
    }
    setShowHistoryPicker(true);
  };

  const confirmLink = async () => {
    if (!canAddBank) {
      setPaywallReason("add_bank");
      setShowHistoryPicker(false);
      return;
    }
    setShowHistoryPicker(false);
    const result = await linkBank(historyDays);
    if (!result.ok && result.paymentRequired) {
      setPaywallReason(result.reason);
      return;
    }
    if (!result.ok) {
      setFlash({ tone: "warning", text: result.error });
    }
  };

  useEffect(() => { supabase.auth.getSession().then(({ data }) => setSession(data.session)); }, []);
  useEffect(() => {
    if (userId && token) void loadItems(userId, token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, token]);

  useEffect(() => {
    if (!items.length) return;
    const allCollapsed = localStorage.getItem(BANKS_COLLAPSE_KEY) === "1";
    setExpanded((prev) => {
      const next = { ...prev };
      for (const it of items) {
        if (next[it.id] === undefined) next[it.id] = !allCollapsed;
      }
      for (const k of Object.keys(next)) {
        if (!items.some((i) => i.id === k)) delete next[k];
      }
      syncBanksCollapseStorage(next, items);
      return next;
    });
  }, [items]);

  const allBanksCollapsed = items.length > 0 && items.every((i) => !(expanded[i.id] ?? true));
  const banksCollapseTip = allBanksCollapsed ? "Expand all banks" : "Collapse all banks";

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Home</h1>
          <p className="desc">Your linked banks and current balances.</p>
        </div>
        <div className="page-actions">
          {showHistoryPicker ? (
            <div className="card card-tight" style={{ padding: 12, minWidth: 280, boxShadow: "var(--shadow-2)" }}>
              <div className="small fw-semi mb-2">Pull transactions up to <ClickEditNumber value={historyDays} onCommit={setHistoryDays} min={1} max={730} step={1} decimals={0} format={(n) => String(n)} ariaLabel="days of transaction history" /> days ago</div>
              <input className="mb-2" type="range" min={1} max={730} value={historyDays} onChange={(e) => setHistoryDays(Number(e.target.value))} />
              <div className="row-flex gap-2">
                <button className="btn primary btn-sm" onClick={() => { void confirmLink(); }}>
                  {!canAddBank && <LockIcon size={12} />}
                  Link via Plaid
                </button>
                <button className="btn ghost btn-sm" onClick={() => setShowHistoryPicker(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="btn primary" onClick={startLinkFlow}>
              {!canAddBank && <LockIcon />}
              + Link bank
            </button>
          )}
          <button
            className={`btn ${deleteMode ? "danger" : "ghost"}`}
            onClick={() => { if (deleteMode) setDeleteMode(false); else setShowDeleteWarning(true); }}
          >
            {deleteMode ? "Exit removal" : "Remove a bank"}
          </button>
        </div>
      </header>

      {flash && <div className="mb-3"><Alert tone={flash.tone} onClose={() => setFlash(null)}>{flash.text}</Alert></div>}

      {loadingItems ? <LoadingSpinner message="Loading banks..." /> : items.length === 0 ? (
        <div className="card"><p className="muted">No banks linked yet. Click <strong>Link bank</strong> to connect your first account.</p></div>
      ) : (
        <>
          <div className="row-flex" style={{ justifyContent: "flex-end", marginBottom: "var(--s3)" }}>
            <Tooltip content={banksCollapseTip}>
              <button
                type="button"
                className="btn ghost btn-sm btn-icon"
                aria-label={banksCollapseTip}
                onClick={() => {
                  if (allBanksCollapsed) {
                    const next: Record<string, boolean> = {};
                    syncBanksCollapseStorage(next, items);
                    setExpanded(next);
                  } else {
                    const next = Object.fromEntries(items.map((i) => [i.id, false])) as Record<string, boolean>;
                    syncBanksCollapseStorage(next, items);
                    setExpanded(next);
                  }
                }}
              >
                <span style={{ color: "var(--ink-muted)", fontSize: "1.05rem", lineHeight: 1 }} aria-hidden>{allBanksCollapsed ? "▾" : "▴"}</span>
              </button>
            </Tooltip>
          </div>
          <div className="col-flex">
          {items.map((item: Item) => {
            const accs = accountsByItem[item.id] ?? [];
            const open = expanded[item.id] ?? true;
            const label = item.institution_name || item.id;
            const logo = logoSrc(item.inst_logo);
            const color = brandColor(item.inst_color);
            return (
              <div key={item.id} className="card" style={{ padding: 0 }}>
                <div className="between" style={{ padding: "var(--s3) var(--s4)" }}>
                  <div className="row-flex gap-2" style={{ flex: 1, justifyContent: "flex-start" }}>
                    <button className="row-flex gap-2" style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", color: "inherit", justifyContent: "flex-start" }} onClick={() => setExpanded((p) => {
                      const next = { ...p, [item.id]: !open };
                      syncBanksCollapseStorage(next, items);
                      return next;
                    })}>
                      <span style={{ display: "inline-block", width: 14, transform: open ? "rotate(0)" : "rotate(-90deg)", transition: "transform 120ms", color: "var(--ink-muted)" }}>▾</span>
                    </button>
                    {logo && (
                      item.inst_url ? <a href={item.inst_url} target="_blank" rel="noreferrer" aria-label={`Open ${label} website`}>
                        <img src={logo} alt="" style={{ width: 18, height: 18, objectFit: "contain", borderRadius: 4, display: "block" }} />
                      </a> : <img src={logo} alt="" style={{ width: 18, height: 18, objectFit: "contain", borderRadius: 4, display: "block" }} />
                    )}
                    <button className="row-flex gap-2" style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", color: "inherit", justifyContent: "flex-start" }} onClick={() => setExpanded((p) => {
                      const next = { ...p, [item.id]: !open };
                      syncBanksCollapseStorage(next, items);
                      return next;
                    })}>
                      <span className="fw-semi">{label}</span>
                      <span className="chip" style={color ? { background: color, color: getTextColorForBackground(color), borderColor: color } : undefined}>{accs.length} account{accs.length !== 1 ? "s" : ""}</span>
                    </button>
                  </div>
                  <div className="row-flex gap-2">
                    <button className="btn ghost btn-sm btn-icon" title="Refresh balances" disabled={busyId === item.id} onClick={async () => {
                      setBusyId(item.id);
                      const r = await refreshItemAccounts(item.id);
                      setBusyId(null);
                      if (r.ok === false) setFlash({ tone: "warning", text: r.error });
                      else setFlash({ tone: "info", text: `Refreshed ${r.updatedAccounts} account${r.updatedAccounts !== 1 ? "s" : ""} for ${label}.` });
                    }}>
                      {busyId === item.id ? <span className="spinner" /> : "↻"}
                    </button>
                    {deleteMode && (
                      <button className="btn danger-ghost btn-sm" disabled={busyId === item.id} onClick={() => setConfirmDelete({ itemId: item.id, label, nAcc: accs.length })}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                {open && accs.map((acc) => <AccountRow key={acc.id} account={acc} />)}
              </div>
            );
          })}
          </div>
        </>
      )}

      <Modal
        open={showDeleteWarning}
        title="Remove a bank?"
        onClose={() => setShowDeleteWarning(false)}
        footer={<>
          <button className="btn ghost btn-sm" onClick={() => setShowDeleteWarning(false)}>Cancel</button>
          <button className="btn danger btn-sm" onClick={() => { setDeleteMode(true); setShowDeleteWarning(false); }}>Remove a bank</button>
        </>}
      >
        <p className="small">{DELETE_WARNING}</p>
      </Modal>

      <Modal
        open={!!confirmDelete}
        title="Delete this bank?"
        onClose={() => setConfirmDelete(null)}
        footer={<>
          <button className="btn ghost btn-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
          <button className="btn danger btn-sm" disabled={busyId != null} onClick={async () => {
            if (!confirmDelete) return;
            const { itemId, label } = confirmDelete;
            setBusyId(itemId);
            const r = await deleteItem(itemId);
            setBusyId(null);
            setConfirmDelete(null);
            if (r.ok === false) setFlash({ tone: "warning", text: r.error });
            else if (!r.plaidRemoved && r.plaidError) setFlash({ tone: "warning", text: `${label} data removed locally, but Plaid unlink failed: ${r.plaidError}` });
          }}>
            {busyId ? "Deleting…" : "Delete bank"}
          </button>
        </>}
      >
        <p>Are you sure you want to delete <strong>{confirmDelete?.label}</strong>?</p>
        <p className="small muted">This removes {confirmDelete?.nAcc} linked account{confirmDelete && confirmDelete.nAcc !== 1 ? "s" : ""} and all transactions for this bank.</p>
      </Modal>

      <PaywallModal open={!!paywallReason} reason={paywallReason} onClose={() => setPaywallReason(null)} />
    </>
  );
}

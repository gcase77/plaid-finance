import { useState } from "react";
import type { DeleteItemResult, RefreshAccountsResult } from "../../hooks/usePlaidData";
import type { Account, AccountBalances, Item } from "../types";
import LoadingSpinner from "../shared/LoadingSpinner";

type MainTabProps = {
  linkBank: (daysRequested?: number) => void | Promise<void>;
  deleteItem: (itemId: string) => Promise<DeleteItemResult>;
  refreshItemAccounts: (itemId: string) => Promise<RefreshAccountsResult>;
  loadingItems: boolean;
  items: Item[];
  accountsByItem: Record<string, Account[]>;
};

const DELETE_MODE_WARNING =
  "Removing a bank permanently deletes that bank, its accounts, and its transaction history from this app. You can link it again later, but past data will not be restored.";

function fmtMoney(n: number | null | undefined, currency = "USD") {
  if (n == null || Number.isNaN(n)) return "--";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return String(n);
  }
}

function readBalances(b: AccountBalances | null | undefined) {
  if (!b || typeof b !== "object") return { current: null as number | null, available: null as number | null, limit: null as number | null, currency: "USD" };
  return {
    current: typeof b.current === "number" ? b.current : null,
    available: typeof b.available === "number" ? b.available : null,
    limit: typeof b.limit === "number" ? b.limit : null,
    currency: typeof b.iso_currency_code === "string" && b.iso_currency_code ? b.iso_currency_code : "USD"
  };
}

function CreditLimitBar({ current, available, limit, currency }: { current: number; available: number | null; limit: number; currency: string }) {
  const pct = Math.min(100, Math.max(0, (current / limit) * 100));
  return (
    <div>
      <div className="progress" style={{ height: 10 }}>
        <div className={`progress-bar ${current > limit ? "bg-danger" : ""}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="split small text-muted mt-1">
        <span>Balance {fmtMoney(current, currency)}</span>
        <span>Available {available != null ? fmtMoney(available, currency) : "--"}</span>
        <span>Limit {fmtMoney(limit, currency)}</span>
      </div>
    </div>
  );
}

function AccountCard({ account }: { account: Account }) {
  const title = account.official_name ?? account.name ?? "Account";
  const { current, available, limit, currency } = readBalances(account.balances);
  const isCredit = account.type?.toLowerCase() === "credit";
  return (
    <div className="metric-card">
      <div className="split">
        <div>
          <b>{title}</b>
          <span className="small text-muted">{account.subtype || account.type || "Account"}</span>
        </div>
        {account.mask && <span className="chip">**{account.mask}</span>}
      </div>
      <div className="mt-3">
        {isCredit && limit != null && limit > 0 && current != null ? (
          <CreditLimitBar current={current} available={available} limit={limit} currency={currency} />
        ) : (
          <div className="cluster small">
            <span className="chip">Balance {fmtMoney(current, currency)}</span>
            {available != null && <span className="chip">{isCredit ? "Available" : "Withdrawable"} {fmtMoney(available, currency)}</span>}
            {isCredit && limit != null && <span className="chip">Limit {fmtMoney(limit, currency)}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MainTab({ linkBank, deleteItem, refreshItemAccounts, loadingItems, items, accountsByItem }: MainTabProps) {
  const [historyDays, setHistoryDays] = useState(730);
  const [showLink, setShowLink] = useState(false);
  const [bankExpanded, setBankExpanded] = useState<Record<string, boolean>>({});
  const [deleteMode, setDeleteMode] = useState(false);
  const [showDeleteModeWarning, setShowDeleteModeWarning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ itemId: string; label: string; nAcc: number } | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [refreshingItemId, setRefreshingItemId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ tone: "info" | "warning"; message: string } | null>(null);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <span className="page-kicker">Connected accounts</span>
          <h1>Banks</h1>
        </div>
        <div className="cluster">
          <button className="btn btn-primary" onClick={() => setShowLink(true)}>Link bank</button>
          <button
            type="button"
            className={`btn ${deleteMode ? "btn-danger" : "btn-outline-secondary"}`}
            onClick={() => deleteMode ? setDeleteMode(false) : setShowDeleteModeWarning(true)}>
            {deleteMode ? "Done removing" : "Remove bank"}
          </button>
        </div>
      </div>

      {flash && (
        <div className={`alert alert-${flash.tone} py-2 small split`} role="alert">
          <span>{flash.message}</span>
          <button type="button" className="btn-close" aria-label="Dismiss" onClick={() => setFlash(null)} />
        </div>
      )}

      <section className="surface-card p-3">
        <div className="split mb-3">
          <div>
            <h2 className="h5 mb-1">Your banks</h2>
            <p className="text-muted small mb-0">Refresh balances, review accounts, or unlink data you no longer need.</p>
          </div>
          <span className="chip">{items.length} bank{items.length === 1 ? "" : "s"}</span>
        </div>
        {loadingItems ? (
          <LoadingSpinner message="Loading items..." />
        ) : items.length === 0 ? (
          <div className="metric-card text-center py-5">
            <h3 className="h5">No banks linked yet</h3>
            <p className="text-muted">Connect a bank to sync accounts and transactions.</p>
            <button className="btn btn-primary" onClick={() => setShowLink(true)}>Link your first bank</button>
          </div>
        ) : (
          <div className="stack">
            {items.map(item => {
              const open = bankExpanded[item.id] ?? true;
              const accounts = accountsByItem[item.id] ?? [];
              const label = item.institution_name || item.id;
              return (
                <article key={item.id} className="metric-card">
                  <div className="split">
                    <button type="button" className="btn btn-link text-start p-0 text-decoration-none" onClick={() => setBankExpanded(p => ({ ...p, [item.id]: !open }))}>
                      <b>{open ? "v" : ">"} {label}</b>
                      <span className="small text-muted ms-2">{accounts.length} account{accounts.length === 1 ? "" : "s"}</span>
                    </button>
                    <div className="cluster">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        disabled={refreshingItemId === item.id || deletingItemId === item.id}
                        onClick={async () => {
                          setRefreshingItemId(item.id);
                          const r = await refreshItemAccounts(item.id);
                          setRefreshingItemId(null);
                          setFlash({ tone: r.ok ? "info" : "warning", message: r.ok ? `Refreshed ${r.updatedAccounts} account${r.updatedAccounts === 1 ? "" : "s"} for ${label}.` : r.error });
                        }}>
                        {refreshingItemId === item.id ? "Refreshing..." : "Refresh"}
                      </button>
                      {deleteMode && (
                        <button type="button" className="btn btn-sm btn-outline-danger" disabled={deletingItemId === item.id}
                          onClick={() => setConfirmDelete({ itemId: item.id, label, nAcc: accounts.length })}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  {open && <div className="grid-cards mt-3">{accounts.map(acc => <AccountCard key={acc.id} account={acc} />)}</div>}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {showLink && (
        <div className="modal-backdrop-lite" role="dialog" aria-modal="true" aria-labelledby="link-bank-title">
          <div className="surface-card modal-panel p-3">
            <div className="split mb-3">
              <h2 id="link-bank-title" className="h5 mb-0">Link a bank</h2>
              <button type="button" className="btn-close" aria-label="Close" onClick={() => setShowLink(false)} />
            </div>
            <label className="form-label">Transaction history: <strong>{historyDays}</strong> days</label>
            <input className="form-range" type="range" min={1} max={730} step={1} value={historyDays} onChange={e => setHistoryDays(Number(e.target.value))} />
            <input className="form-control form-control-sm mb-3" type="number" min={1} max={730} value={historyDays}
              onChange={e => setHistoryDays(Math.min(730, Math.max(1, Number(e.target.value) || 1)))} />
            <div className="cluster justify-content-end">
              <button className="btn btn-outline-secondary" onClick={() => setShowLink(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { void linkBank(historyDays); setShowLink(false); }}>Open Plaid</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModeWarning && (
        <div className="modal-backdrop-lite" role="dialog" aria-modal="true" aria-labelledby="delete-mode-warn-title">
          <div className="surface-card modal-panel p-3">
            <h2 id="delete-mode-warn-title" className="h5">Remove a bank?</h2>
            <p className="small text-muted">{DELETE_MODE_WARNING}</p>
            <div className="cluster justify-content-end">
              <button type="button" className="btn btn-outline-secondary" onClick={() => setShowDeleteModeWarning(false)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={() => { setDeleteMode(true); setShowDeleteModeWarning(false); }}>Continue</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-backdrop-lite" role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title">
          <div className="surface-card modal-panel p-3">
            <h2 id="confirm-delete-title" className="h5">Delete this bank?</h2>
            <p>Delete <strong>{confirmDelete.label}</strong> and {confirmDelete.nAcc} linked account{confirmDelete.nAcc === 1 ? "" : "s"}?</p>
            <p className="small text-muted">All transactions for this bank are removed from this app.</p>
            <div className="cluster justify-content-end">
              <button type="button" className="btn btn-outline-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={deletingItemId != null}
                onClick={async () => {
                  const { itemId } = confirmDelete;
                  setDeletingItemId(itemId);
                  const r = await deleteItem(itemId);
                  setDeletingItemId(null);
                  setConfirmDelete(null);
                  if (r.ok) {
                    if (!r.plaidRemoved && r.plaidError) setFlash({ tone: "warning", message: `Data was removed, but unlinking the bank at Plaid failed: ${r.plaidError}` });
                  } else {
                    setFlash({ tone: "warning", message: r.error });
                  }
                }}>
                {deletingItemId ? "Deleting..." : "Delete bank"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

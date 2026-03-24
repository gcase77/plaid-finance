import { useEffect, useState } from "react";
import type { DeleteItemResult, RefreshAccountsResult } from "../../hooks/usePlaidData";
import type { Account, AccountBalances, Item } from "../types";
import LoadingSpinner from "../shared/LoadingSpinner";

type MainTabProps = {
  userEmail: string;
  signOut: () => void;
  linkBank: (daysRequested?: number) => void;
  deleteItem: (itemId: string) => Promise<DeleteItemResult>;
  refreshItemAccounts: (itemId: string) => Promise<RefreshAccountsResult>;
  loadingItems: boolean;
  items: Item[];
  accountsByItem: Record<string, Account[]>;
};

const DELETE_MODE_WARNING =
  "When you remove a bank, that bank’s accounts and all transaction history for it in this app are permanently deleted. You can link that bank again later, but past data will not be restored.";

const NARROW_QUERY = "(max-width: 576px)";
/** Wider than Tools sidebar so auth content fits comfortably */
const AUTH_SIDEBAR_OPEN = 210;
const AUTH_SIDEBAR_COLLAPSED = 40;

function fmtMoney(n: number | null | undefined, currency = "USD") {
  if (n == null || Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return String(n);
  }
}

function readBalances(b: AccountBalances | null | undefined) {
  if (!b || typeof b !== "object") return { current: null as number | null, available: null as number | null, limit: null as number | null, currency: "USD" };
  const currency = typeof b.iso_currency_code === "string" && b.iso_currency_code ? b.iso_currency_code : "USD";
  return {
    current: typeof b.current === "number" ? b.current : null,
    available: typeof b.available === "number" ? b.available : null,
    limit: typeof b.limit === "number" ? b.limit : null,
    currency
  };
}

function creditBarLabels(fmt: (n: number | null) => string, current: number, available: number | null, limit: number) {
  return (
    <div className="d-flex flex-wrap justify-content-between gap-1 small mt-1 text-muted">
      <span>Balance {fmt(current)}</span>
      <span>Available {available != null ? fmt(available) : "—"}</span>
      <span>Limit {fmt(limit)}</span>
    </div>
  );
}

function CreditLimitBar(props: { current: number; available: number | null; limit: number; currency: string }) {
  const { current, available, limit, currency } = props;
  const fmt = (n: number | null) => fmtMoney(n, currency);
  const over = current > limit;
  const tip = `Balance ${fmt(current)} · available ${available != null ? fmt(available) : "—"} · limit ${fmt(limit)}`;

  if (over) {
    const limitPct = (limit / current) * 100;
    return (
      <div className="w-100">
        <div className="position-relative rounded bg-secondary bg-opacity-25" style={{ height: 14 }} title={tip}>
          <div
            className="position-absolute top-0 bottom-0 start-0 rounded opacity-75 bg-primary"
            style={{ width: `${limitPct}%` }}
          />
          <div
            className="position-absolute top-0 bottom-0 rounded-end opacity-75 bg-danger"
            style={{ left: `${limitPct}%`, width: `${100 - limitPct}%` }}
          />
          <div
            className="position-absolute top-0 bottom-0 bg-dark opacity-75"
            style={{ left: `${limitPct}%`, width: 2, marginLeft: -1, zIndex: 1 }}
          />
        </div>
        {creditBarLabels(fmt, current, available, limit)}
      </div>
    );
  }

  const curPct = Math.min(100, (current / limit) * 100);
  const availNum = available ?? 0;
  let availPct = limit > 0 ? (availNum / limit) * 100 : 0;
  availPct = Math.max(0, Math.min(100 - curPct, availPct));
  const restPct = Math.max(0, 100 - curPct - availPct);

  return (
    <div className="w-100">
      <div
        className="position-relative rounded bg-secondary bg-opacity-25 overflow-hidden"
        style={{ height: 14 }}
        title={tip}>
        <div
          className="position-absolute top-0 bottom-0 start-0 rounded opacity-75 bg-primary"
          style={{ width: `${curPct}%` }}
        />
        <div
          className="position-absolute top-0 bottom-0 opacity-75 bg-success"
          style={{ left: `${curPct}%`, width: `${availPct}%` }}
        />
        <div
          className="position-absolute top-0 bottom-0 bg-secondary bg-opacity-25"
          style={{ left: `${curPct + availPct}%`, width: `${restPct}%` }}
        />
      </div>
      {creditBarLabels(fmt, current, available, limit)}
    </div>
  );
}

function AccountCard({ account }: { account: Account }) {
  const title = account.official_name ?? account.name ?? "Account";
  const { current, available, limit, currency } = readBalances(account.balances);
  const isCredit = account.type?.toLowerCase() === "credit";

  return (
    <div className="list-group-item py-3">
      <div className="fw-semibold">{title}</div>
      {account.subtype && (
        <div className="fst-italic small text-muted mb-2">{account.subtype}</div>
      )}

      <div className="mt-2">
        {isCredit ? (
          limit != null && limit > 0 && current != null ? (
            <CreditLimitBar current={current} available={available} limit={limit} currency={currency} />
          ) : (
            <div className="small">
              <div>
                <span className="text-muted">Balance</span> {fmtMoney(current, currency)}
              </div>
              {available != null && (
                <div>
                  <span className="text-muted">Available</span> {fmtMoney(available, currency)}
                </div>
              )}
              {limit != null && (
                <div>
                  <span className="text-muted">Limit</span> {fmtMoney(limit, currency)}
                </div>
              )}
            </div>
          )
        ) : (
          <div className="small">
            <div>
              <span className="text-muted">Balance</span> {fmtMoney(current, currency)}
            </div>
            {available != null && (
              <div>
                <span className="text-muted">Withdrawable</span> {fmtMoney(available, currency)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MainTab(props: MainTabProps) {
  const { userEmail, signOut, linkBank, deleteItem, refreshItemAccounts, loadingItems, items, accountsByItem } = props;
  const narrowInit =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(NARROW_QUERY).matches
      : false;
  const [isNarrow, setIsNarrow] = useState<boolean>(narrowInit);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => !narrowInit);
  const [historyDays, setHistoryDays] = useState(730);
  const [showHistoryPicker, setShowHistoryPicker] = useState(false);
  /** Bank id → expanded; default true when unset */
  const [bankExpanded, setBankExpanded] = useState<Record<string, boolean>>({});
  const [deleteMode, setDeleteMode] = useState(false);
  const [showDeleteModeWarning, setShowDeleteModeWarning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ itemId: string; label: string; nAcc: number } | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [deleteFlash, setDeleteFlash] = useState<string | null>(null);
  const [refreshFlash, setRefreshFlash] = useState<string | null>(null);
  const [refreshingItemId, setRefreshingItemId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(NARROW_QUERY);
    const handler = () => {
      const narrow = mq.matches;
      setIsNarrow(narrow);
      setSidebarOpen(!narrow);
    };
    handler();
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, []);

  return (
    <div className="d-flex gap-2 align-items-start" style={{ marginLeft: "-1rem" }}>
      <div
        className="card"
        style={{
          width: sidebarOpen ? AUTH_SIDEBAR_OPEN : AUTH_SIDEBAR_COLLAPSED,
          minWidth: sidebarOpen ? AUTH_SIDEBAR_OPEN : AUTH_SIDEBAR_COLLAPSED,
          flexShrink: 0,
          transition: "width 160ms ease"
        }}>
        <div
          className="card-body p-2"
          style={{
            padding: sidebarOpen ? undefined : "0.25rem 0.25rem",
            overflow: "hidden"
          }}>
          <button
            type="button"
            className="btn btn-link text-decoration-none text-muted fw-bold w-100 d-flex align-items-center justify-content-center"
            onClick={() => setSidebarOpen(o => !o)}
            aria-expanded={sidebarOpen}
            style={{ padding: sidebarOpen ? "0.125rem 0.25rem" : "0.125rem 0" }}>
            {sidebarOpen ? (
              <span className="fs-6 text-center lh-sm">Authentication</span>
            ) : (
              <span
                style={{
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                  fontSize: "0.9rem"
                }}>
                Authentication
              </span>
            )}
          </button>

          {sidebarOpen && (
            <>
              <p className="mb-2 small text-break">
                Signed in as: <strong>{userEmail}</strong>
              </p>
              <button className="btn btn-outline-secondary w-100 btn-sm" onClick={signOut}>
                Sign Out
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-fill min-w-0">
        <div className="card">
          <div className="card-body">
            <h5 className="card-title">Your Banks</h5>
            {refreshFlash && (
              <div className="alert alert-info py-2 small mb-2 d-flex justify-content-between align-items-start gap-2" role="alert">
                <span>{refreshFlash}</span>
                <button
                  type="button"
                  className="btn-close flex-shrink-0"
                  aria-label="Dismiss"
                  onClick={() => setRefreshFlash(null)}
                />
              </div>
            )}
            {deleteFlash && (
              <div
                className="alert alert-warning py-2 small mb-2 d-flex justify-content-between align-items-start gap-2"
                role="alert">
                <span>{deleteFlash}</span>
                <button
                  type="button"
                  className="btn-close flex-shrink-0"
                  aria-label="Dismiss"
                  onClick={() => setDeleteFlash(null)}
                />
              </div>
            )}
            <div className="mb-3 d-flex flex-wrap align-items-center gap-2">
              {!showHistoryPicker ? (
                <button className="btn btn-success" onClick={() => setShowHistoryPicker(true)}>
                  Link Bank
                </button>
              ) : (
                <div className="border rounded p-3 flex-grow-1" style={{ minWidth: 240 }}>
                  <label className="form-label mb-1">
                    Allow this app to access transactions up to <strong>{historyDays}</strong> days ago
                  </label>
                  <div className="row g-2 align-items-center">
                    <div className="col-md-8">
                      <input
                        className="form-range"
                        type="range"
                        min={1}
                        max={730}
                        step={1}
                        value={historyDays}
                        onChange={e => setHistoryDays(Number(e.target.value))}
                      />
                    </div>
                    <div className="col-md-4">
                      <input
                        className="form-control form-control-sm"
                        type="number"
                        min={1}
                        max={730}
                        value={historyDays}
                        onChange={e =>
                          setHistoryDays(Math.min(730, Math.max(1, Number(e.target.value) || 1)))
                        }
                      />
                    </div>
                  </div>
                  <div className="d-flex justify-content-between small text-muted mb-2">
                    <span>1</span>
                    <span>730</span>
                  </div>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => {
                        linkBank(historyDays);
                        setShowHistoryPicker(false);
                        if (isNarrow) setSidebarOpen(false);
                      }}>
                      Link via Plaid
                    </button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowHistoryPicker(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <button
                type="button"
                className={`btn btn-sm px-3 ${deleteMode ? "btn-danger" : "btn-outline-secondary"}`}
                style={{ minWidth: 130 }}
                onClick={() => {
                  if (deleteMode) setDeleteMode(false);
                  else setShowDeleteModeWarning(true);
                }}>
                Remove a bank
              </button>
            </div>

            {loadingItems ? (
              <LoadingSpinner message="Loading items..." />
            ) : (
              <div className="vstack gap-2">
                {items.map(item => {
                  const open = bankExpanded[item.id] ?? true;
                  const nAcc = (accountsByItem[item.id] ?? []).length;
                  const label = item.institution_name || item.id;
                  const toggleBank = () =>
                    setBankExpanded(p => ({ ...p, [item.id]: !(p[item.id] ?? true) }));
                  return (
                    <div key={item.id} className="border rounded overflow-hidden">
                      <div className="d-flex align-items-center gap-2 py-2 px-3 bg-light">
                        <button
                          type="button"
                          className="border-0 bg-transparent p-0 text-muted flex-shrink-0"
                          onClick={toggleBank}
                          aria-expanded={open}
                          aria-label={open ? "Collapse accounts" : "Expand accounts"}>
                          <span
                            className="user-select-none d-inline-block"
                            style={{
                              width: "0.75rem",
                              transform: open ? "rotate(0deg)" : "rotate(-90deg)",
                              transition: "transform 0.15s ease"
                            }}>
                            ▼
                          </span>
                        </button>
                        <button
                          type="button"
                          className="flex-grow-1 text-start border-0 bg-transparent py-0 px-0"
                          onClick={toggleBank}>
                          <span className="fw-semibold">{label}</span>
                          <span className="text-muted small ms-2">
                            {nAcc} account{nAcc !== 1 ? "s" : ""}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary py-0 text-nowrap flex-shrink-0"
                          disabled={refreshingItemId === item.id || deletingItemId === item.id}
                          aria-label={refreshingItemId === item.id ? "Refreshing accounts" : "Refresh accounts"}
                          title={refreshingItemId === item.id ? "Refreshing..." : "Refresh"}
                          onClick={async () => {
                            setRefreshingItemId(item.id);
                            const r = await refreshItemAccounts(item.id);
                            setRefreshingItemId(null);
                            if (r.ok) {
                              setRefreshFlash(
                                `Refreshed ${r.updatedAccounts} account${r.updatedAccounts !== 1 ? "s" : ""} for ${label}.`
                              );
                            } else if ("error" in r) {
                              setRefreshFlash(r.error);
                            } else {
                              setRefreshFlash("Refresh failed");
                            }
                          }}>
                          {refreshingItemId === item.id ? "…" : "↻"}
                        </button>
                        {deleteMode && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger text-nowrap flex-shrink-0"
                            disabled={deletingItemId === item.id}
                            onClick={() =>
                              setConfirmDelete({ itemId: item.id, label, nAcc })
                            }>
                            {deletingItemId === item.id ? "Deleting…" : `Delete ${nAcc} account${nAcc !== 1 ? "s" : ""}`}
                          </button>
                        )}
                      </div>
                      {open && (
                        <div className="list-group list-group-flush border-top">
                          {(accountsByItem[item.id] ?? []).map(acc => (
                            <AccountCard key={acc.id} account={acc} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showDeleteModeWarning && (
        <div
          className="modal d-block show"
          style={{ background: "rgba(0,0,0,0.45)" }}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-mode-warn-title">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title" id="delete-mode-warn-title">
                  Remove a bank?
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setShowDeleteModeWarning(false)}
                />
              </div>
              <div className="modal-body">
                <p className="mb-0 small">{DELETE_MODE_WARNING}</p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setShowDeleteModeWarning(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    setDeleteMode(true);
                    setShowDeleteModeWarning(false);
                  }}>
                  Remove a bank
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          className="modal d-block show"
          style={{ background: "rgba(0,0,0,0.45)" }}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title" id="confirm-delete-title">
                  Delete this bank?
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setConfirmDelete(null)}
                />
              </div>
              <div className="modal-body">
                <p className="mb-2">
                  Are you sure you want to delete <strong>{confirmDelete.label}</strong>?
                </p>
                <p className="mb-0 small text-muted">
                  This removes {confirmDelete.nAcc} linked account
                  {confirmDelete.nAcc !== 1 ? "s" : ""} and all transactions for this bank in the app.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setConfirmDelete(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={deletingItemId != null}
                  onClick={async () => {
                    const { itemId } = confirmDelete;
                    setDeletingItemId(itemId);
                    const r = await deleteItem(itemId);
                    setDeletingItemId(null);
                    setConfirmDelete(null);
                    if (r.ok === false) {
                      setDeleteFlash(r.error);
                    } else {
                      if (!r.plaidRemoved && r.plaidError)
                        setDeleteFlash(
                          `Data was removed in this app, but unlinking the bank at Plaid failed: ${r.plaidError}`
                        );
                      else setDeleteFlash(null);
                    }
                  }}>
                  {deletingItemId ? "Deleting…" : "Delete bank"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

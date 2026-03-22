import { useEffect, useState } from "react";
import type { Account, AccountBalances, Item } from "../types";
import LoadingSpinner from "../shared/LoadingSpinner";

type MainTabProps = {
  userEmail: string;
  signOut: () => void;
  linkBank: (daysRequested?: number) => void;
  loadingItems: boolean;
  items: Item[];
  accountsByItem: Record<string, Account[]>;
};

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
  const { userEmail, signOut, linkBank, loadingItems, items, accountsByItem } = props;
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
            <div className="mb-3">
              {!showHistoryPicker ? (
                <button className="btn btn-success" onClick={() => setShowHistoryPicker(true)}>
                  Link Bank
                </button>
              ) : (
                <div className="border rounded p-3">
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
            </div>

            {loadingItems ? (
              <LoadingSpinner message="Loading items..." />
            ) : (
              <div className="vstack gap-2">
                {items.map(item => {
                  const open = bankExpanded[item.id] ?? true;
                  const nAcc = (accountsByItem[item.id] ?? []).length;
                  return (
                    <div key={item.id} className="border rounded overflow-hidden">
                      <button
                        type="button"
                        className="d-flex align-items-center gap-2 w-100 py-2 px-3 border-0 bg-light text-start"
                        onClick={() =>
                          setBankExpanded(p => ({ ...p, [item.id]: !(p[item.id] ?? true) }))
                        }
                        aria-expanded={open}>
                        <span
                          className="text-muted user-select-none d-inline-block"
                          style={{
                            width: "0.75rem",
                            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
                            transition: "transform 0.15s ease"
                          }}>
                          ▼
                        </span>
                        <span className="fw-semibold">{item.institution_name || item.id}</span>
                        <span className="text-muted small ms-auto">{nAcc} accounts</span>
                      </button>
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
    </div>
  );
}

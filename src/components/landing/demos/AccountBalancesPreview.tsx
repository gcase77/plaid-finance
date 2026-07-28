import type { Account, AccountBalances } from "../../types";
import { DEMO_ACCOUNTS, DEMO_ITEMS } from "../demoData";

function fmtMoney(n: number | null | undefined, currency = "USD") {
  if (n == null || Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return String(n);
  }
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
          {account.mask && <div className="xs muted">•••• {account.mask}</div>}
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
        <div style={{ marginTop: 10 }}>
          <CreditBar current={current} available={available} limit={limit} currency={currency} />
        </div>
      )}
    </div>
  );
}

export default function AccountBalancesPreview() {
  return (
    <div className="landing-demo-shell">
      <div className="landing-demo-hint">
        Linked banks and account balances update automatically after each sync.
      </div>
      <div className="col-flex" style={{ gap: 12 }}>
        {DEMO_ITEMS.map((item) => {
          const accounts = DEMO_ACCOUNTS[item.id] ?? [];
          const color = item.inst_color && /^#[0-9a-f]{6}$/i.test(item.inst_color) ? item.inst_color : "var(--brand)";
          return (
            <div key={item.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="between" style={{ padding: "var(--s3) var(--s4)", borderBottom: "1px solid var(--line)" }}>
                <div className="row-flex gap-3">
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: color, flexShrink: 0 }} />
                  <div>
                    <div className="fw-semi">{item.institution_name}</div>
                    <div className="xs muted">{accounts.length} account{accounts.length === 1 ? "" : "s"}</div>
                  </div>
                </div>
                <span className="chip chip-success">Synced</span>
              </div>
              {accounts.map((acct) => (
                <AccountRow key={acct.id} account={acct} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useState } from "react";
import type { Account, AccountBalances, Item } from "../types";
import { getTextColorForBackground } from "../../utils/transactionUtils";
import demo from "./landingDemo.json";

const { items, accounts } = demo as { items: Item[]; accounts: Account[] };

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
    currency: typeof b.iso_currency_code === "string" && b.iso_currency_code ? b.iso_currency_code : "USD",
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
  const over = current > limit;
  const curPct = Math.min(100, (current / Math.max(limit, current)) * 100);
  const availNum = available ?? 0;
  const limitForAvail = Math.max(limit, current);
  const availPct = limitForAvail > 0 ? Math.max(0, Math.min(100 - curPct, (availNum / limitForAvail) * 100)) : 0;
  return (
    <div>
      <div className="bar" title={`Balance ${fmtMoney(current, currency)} · available ${fmtMoney(available, currency)} · limit ${fmtMoney(limit, currency)}`}>
        <div style={{ left: 0, width: `${curPct}%`, background: over ? "var(--danger)" : "var(--brand)", opacity: 0.85 }} />
        <div style={{ left: `${curPct}%`, width: `${availPct}%`, background: "var(--success)", opacity: 0.5 }} />
      </div>
      <div className="row-flex between xs muted mt-2">
        <span>Balance {fmtMoney(current, currency)}</span>
        <span>Available {fmtMoney(available, currency)}</span>
        <span>Limit {fmtMoney(limit, currency)}</span>
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

export default function LandingAccountsDemo() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => Object.fromEntries(items.map((i) => [i.id, true])));

  return (
    <div className="col-flex">
      {items.map((item) => {
        const accs = accounts.filter((a) => a.item_id === item.id);
        const open = expanded[item.id] ?? true;
        const label = item.institution_name || "Connected bank";
        const logo = logoSrc(item.inst_logo);
        const color = brandColor(item.inst_color);
        return (
          <div key={item.id} className="card" style={{ padding: 0 }}>
            <button
              type="button"
              className="between"
              style={{ width: "100%", padding: "var(--s3) var(--s4)", border: 0, background: "transparent", cursor: "pointer", color: "inherit", textAlign: "left" }}
              onClick={() => setExpanded((p) => ({ ...p, [item.id]: !open }))}
            >
              <div className="row-flex gap-2">
                <span style={{ display: "inline-block", width: 14, transform: open ? "rotate(0)" : "rotate(-90deg)", transition: "transform 120ms", color: "var(--ink-muted)" }} aria-hidden>▾</span>
                {logo && <img src={logo} alt="" style={{ width: 18, height: 18, objectFit: "contain", borderRadius: 4, display: "block" }} />}
                <span className="fw-semi">{label}</span>
                <span className="chip" style={color ? { background: color, color: getTextColorForBackground(color), borderColor: color } : undefined}>
                  {accs.length} account{accs.length !== 1 ? "s" : ""}
                </span>
              </div>
            </button>
            {open && accs.map((acc) => <AccountRow key={acc.id} account={acc} />)}
          </div>
        );
      })}
    </div>
  );
}

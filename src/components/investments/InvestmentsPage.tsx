import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { buildAuthHeaders } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

type InvestmentsPayload = {
  holdings: InvestmentHolding[];
  transactions: InvestmentTransaction[];
  securities: SecurityRow[];
};

type JoinedAccount = { name?: string | null; official_name?: string | null };
type JoinedItem = { institution_name?: string | null };
type JoinedSecurity = {
  id?: string;
  name?: string | null;
  ticker_symbol?: string | null;
  type?: string | null;
  subtype?: string | null;
};

type InvestmentHolding = Record<string, unknown> & {
  account_id: string;
  security_id: string;
  user_id?: string;
  item_id?: string;
  accounts?: JoinedAccount | null;
  items?: JoinedItem | null;
  securities?: JoinedSecurity | null;
};

type InvestmentTransaction = Record<string, unknown> & {
  id: string;
  account_id: string;
  accounts?: JoinedAccount | null;
  items?: JoinedItem | null;
  securities?: JoinedSecurity | null;
};

type SecurityRow = Record<string, unknown> & { id: string };

type SectionKey = "holdings" | "transactions" | "securities";

type ColDef<T> = { key: string; label: string; align?: "end"; get: (row: T) => unknown };

const HOLDING_DEFAULT_ON = new Set([
  "institution_price",
  "institution_value",
  "quantity",
  "cost_basis",
  "vested_quantity",
  "vested_value"
]);
const TX_DEFAULT_ON = new Set(["name", "quantity", "price", "amount", "fees", "type", "subtype"]);
const SEC_DEFAULT_ON = new Set([
  "id",
  "name",
  "ticker_symbol",
  "is_cash_equivalent",
  "type",
  "subtype",
  "close_price",
  "sector",
  "industry",
  "option_contract",
  "fixed_income"
]);

function defaultCols<T>(defs: ColDef<T>[], on: Set<string>): Record<string, boolean> {
  return Object.fromEntries(defs.map((d) => [d.key, on.has(d.key)]));
}

/** Prefer institution-facing name; never show full Plaid account_id as the label */
const accountLabel = (accounts: JoinedAccount | null | undefined, fallbackId: string) =>
  accounts?.name || accounts?.official_name || `Account …${fallbackId.slice(-4)}`;

const fmt = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 19).replace("T", " ");
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
};

/** Display order: primary metrics first, then remaining fields */
const HOLDING_COLS: ColDef<InvestmentHolding>[] = [
  { key: "institution_price", label: "institution_price", align: "end", get: (h) => h.institution_price },
  { key: "institution_value", label: "institution_value", align: "end", get: (h) => h.institution_value },
  { key: "quantity", label: "quantity", align: "end", get: (h) => h.quantity },
  { key: "cost_basis", label: "cost_basis", align: "end", get: (h) => h.cost_basis },
  { key: "vested_quantity", label: "vested_quantity", align: "end", get: (h) => h.vested_quantity },
  { key: "vested_value", label: "vested_value", align: "end", get: (h) => h.vested_value },
  { key: "institution_price_as_of", label: "institution_price_as_of", get: (h) => h.institution_price_as_of },
  { key: "institution_price_datetime", label: "institution_price_datetime", get: (h) => h.institution_price_datetime },
  { key: "institution_price_date", label: "institution_price_date", get: (h) => h.institution_price_date },
  { key: "iso_currency_code", label: "iso_currency_code", get: (h) => h.iso_currency_code },
  { key: "unofficial_currency_code", label: "unofficial_currency_code", get: (h) => h.unofficial_currency_code },
  { key: "currency_code", label: "currency_code", get: (h) => h.currency_code },
  { key: "user_id", label: "user_id", get: (h) => h.user_id },
  { key: "item_id", label: "item_id", get: (h) => h.item_id },
  { key: "account_id", label: "account_id", get: (h) => h.account_id },
  { key: "security_id", label: "security_id", get: (h) => h.security_id },
  { key: "created_at", label: "created_at", get: (h) => h.created_at },
  { key: "updated_at", label: "updated_at", get: (h) => h.updated_at },
  { key: "_institution_name", label: "items.institution_name", get: (h) => h.items?.institution_name },
  { key: "_account_display", label: "account (display)", get: (h) => accountLabel(h.accounts, h.account_id) },
  { key: "_security_ticker", label: "securities.ticker_symbol", get: (h) => h.securities?.ticker_symbol },
  { key: "_security_name", label: "securities.name", get: (h) => h.securities?.name },
  { key: "raw_payload", label: "raw_payload", get: (h) => h.raw_payload }
];

const TX_COLS: ColDef<InvestmentTransaction>[] = [
  { key: "name", label: "name", get: (t) => t.name },
  { key: "quantity", label: "quantity", align: "end", get: (t) => t.quantity },
  { key: "price", label: "price", align: "end", get: (t) => t.price },
  { key: "amount", label: "amount", align: "end", get: (t) => t.amount },
  { key: "fees", label: "fees", align: "end", get: (t) => t.fees },
  { key: "type", label: "type", get: (t) => t.type },
  { key: "subtype", label: "subtype", get: (t) => t.subtype },
  { key: "date", label: "date", get: (t) => t.date },
  { key: "plaid_datetime", label: "plaid_datetime", get: (t) => t.plaid_datetime },
  { key: "datetime", label: "datetime", get: (t) => t.datetime },
  { key: "id", label: "id", get: (t) => t.id },
  { key: "user_id", label: "user_id", get: (t) => t.user_id },
  { key: "item_id", label: "item_id", get: (t) => t.item_id },
  { key: "account_id", label: "account_id", get: (t) => t.account_id },
  { key: "security_id", label: "security_id", get: (t) => t.security_id },
  { key: "iso_currency_code", label: "iso_currency_code", get: (t) => t.iso_currency_code },
  { key: "unofficial_currency_code", label: "unofficial_currency_code", get: (t) => t.unofficial_currency_code },
  { key: "currency_code", label: "currency_code", get: (t) => t.currency_code },
  { key: "created_at", label: "created_at", get: (t) => t.created_at },
  { key: "updated_at", label: "updated_at", get: (t) => t.updated_at },
  { key: "_institution_name", label: "items.institution_name", get: (t) => t.items?.institution_name },
  { key: "_account_display", label: "account (display)", get: (t) => accountLabel(t.accounts, t.account_id) },
  { key: "_security_ticker", label: "securities.ticker_symbol", get: (t) => t.securities?.ticker_symbol },
  { key: "_security_name", label: "securities.name", get: (t) => t.securities?.name },
  { key: "raw_payload", label: "raw_payload", get: (t) => t.raw_payload }
];

/** Display order: primary fields first (same as SEC_DEFAULT_ON), then the rest */
const SEC_COLS: ColDef<SecurityRow>[] = [
  { key: "id", label: "id", get: (s) => s.id },
  { key: "name", label: "name", get: (s) => s.name },
  { key: "ticker_symbol", label: "ticker_symbol", get: (s) => s.ticker_symbol },
  { key: "is_cash_equivalent", label: "is_cash", get: (s) => s.is_cash_equivalent },
  { key: "type", label: "type", get: (s) => s.type },
  { key: "subtype", label: "subtype", get: (s) => s.subtype },
  { key: "close_price", label: "close_price", align: "end", get: (s) => s.close_price },
  { key: "sector", label: "sector", get: (s) => s.sector },
  { key: "industry", label: "industry", get: (s) => s.industry },
  { key: "option_contract", label: "option_contract", get: (s) => s.option_contract },
  { key: "fixed_income", label: "fixed_income", get: (s) => s.fixed_income },
  { key: "close_price_as_of", label: "close_price_as_of", get: (s) => s.close_price_as_of },
  { key: "update_datetime", label: "update_datetime", get: (s) => s.update_datetime },
  { key: "iso_currency_code", label: "iso_currency_code", get: (s) => s.iso_currency_code },
  { key: "unofficial_currency_code", label: "unofficial_currency_code", get: (s) => s.unofficial_currency_code },
  { key: "currency_code", label: "currency_code", get: (s) => s.currency_code },
  { key: "market_identifier_code", label: "market_identifier_code", get: (s) => s.market_identifier_code },
  { key: "user_id", label: "user_id", get: (s) => s.user_id },
  { key: "item_id", label: "item_id", get: (s) => s.item_id },
  { key: "account_id", label: "account_id", get: (s) => s.account_id },
  { key: "institution_security_id", label: "institution_security_id", get: (s) => s.institution_security_id },
  { key: "institution_id", label: "institution_id", get: (s) => s.institution_id },
  { key: "proxy_security_id", label: "proxy_security_id", get: (s) => s.proxy_security_id },
  { key: "raw_payload", label: "raw_payload", get: (s) => s.raw_payload },
  { key: "created_at", label: "created_at", get: (s) => s.created_at },
  { key: "updated_at", label: "updated_at", get: (s) => s.updated_at }
];

const today = () => new Date().toISOString().slice(0, 10);
const oneYearAgo = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
};
const money = (value: unknown, currency = "USD") =>
  typeof value === "number"
    ? value.toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 2 })
    : "";

export default function InvestmentsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<InvestmentsPayload>({ holdings: [], transactions: [], securities: [] });
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(oneYearAgo());
  const [endDate, setEndDate] = useState(today());
  const token = session?.access_token ?? null;

  const [visibleSections, setVisibleSections] = useState({ holdings: true, transactions: true, securities: true });
  const [excludedAccounts, setExcludedAccounts] = useState<Set<string>>(() => new Set());
  const [colsHoldings, setColsHoldings] = useState<Record<string, boolean>>(() =>
    defaultCols(HOLDING_COLS, HOLDING_DEFAULT_ON)
  );
  const [colsTx, setColsTx] = useState<Record<string, boolean>>(() => defaultCols(TX_COLS, TX_DEFAULT_ON));
  const [colsSec, setColsSec] = useState<Record<string, boolean>>(() => defaultCols(SEC_COLS, SEC_DEFAULT_ON));

  const load = async (accessToken = token) => {
    if (!accessToken) return;
    const res = await fetch("/api/investments", { headers: buildAuthHeaders(accessToken) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `Load failed (${res.status})`);
    setData({
      holdings: Array.isArray(json.holdings) ? json.holdings : [],
      transactions: Array.isArray(json.transactions) ? json.transactions : [],
      securities: Array.isArray(json.securities) ? json.securities : []
    });
  };

  const sync = async (path: string, body?: object) => {
    if (!token) return;
    setLoading(true);
    setStatus(`POST ${path}`);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) },
        body: body ? JSON.stringify(body) : undefined
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Sync failed (${res.status})`);
      setStatus(JSON.stringify(json));
      await load();
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: authData }) => {
      setSession(authData.session);
      if (authData.session?.access_token) await load(authData.session.access_token);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time session bootstrap
  }, []);

  useEffect(() => {
    setColsHoldings(defaultCols(HOLDING_COLS, HOLDING_DEFAULT_ON));
    setColsTx(defaultCols(TX_COLS, TX_DEFAULT_ON));
    setColsSec(defaultCols(SEC_COLS, SEC_DEFAULT_ON));
  }, [data.holdings, data.transactions, data.securities]);

  const accountsIndex = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of data.holdings) m.set(h.account_id, accountLabel(h.accounts as JoinedAccount, h.account_id));
    for (const t of data.transactions) m.set(t.account_id, accountLabel(t.accounts as JoinedAccount, t.account_id));
    for (const s of data.securities) {
      const aid = s.account_id as string | undefined;
      if (!aid || m.has(aid)) continue;
      m.set(aid, accountLabel(null, aid));
    }
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data.holdings, data.transactions, data.securities]);

  const filteredHoldings = useMemo(
    () => data.holdings.filter((h) => !excludedAccounts.has(h.account_id)),
    [data.holdings, excludedAccounts]
  );
  const filteredTx = useMemo(
    () => data.transactions.filter((t) => !excludedAccounts.has(t.account_id)),
    [data.transactions, excludedAccounts]
  );
  const filteredSec = useMemo(
    () => data.securities.filter((s) => !s.account_id || !excludedAccounts.has(String(s.account_id))),
    [data.securities, excludedAccounts]
  );

  const totalValue = useMemo(
    () =>
      filteredHoldings.reduce(
        (sum, h) => sum + (typeof h.institution_value === "number" ? h.institution_value : 0),
        0
      ),
    [filteredHoldings]
  );

  const toggleSection = (key: SectionKey) => setVisibleSections((p) => ({ ...p, [key]: !p[key] }));
  const toggleAccount = (id: string, checked: boolean) => {
    setExcludedAccounts((prev) => {
      const next = new Set(prev);
      if (checked) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const thClass = (align?: "end") => (align === "end" ? "text-end" : "");

  const renderCell = (def: ColDef<InvestmentHolding>, h: InvestmentHolding) => {
    const v = def.get(h);
    if (def.key === "_account_display") return <td key={def.key}>{String(v ?? "")}</td>;
    if (def.key === "raw_payload")
      return (
        <td key={def.key} className="small">
          <code>{fmt(v)}</code>
        </td>
      );
    if (
      def.key === "institution_value" ||
      def.key === "cost_basis" ||
      def.key === "institution_price" ||
      def.key === "vested_value"
    )
      return (
        <td key={def.key} className="text-end">
          {money(v, (h.currency_code as string) || "USD")}
        </td>
      );
    return (
      <td key={def.key} className={def.align === "end" ? "text-end" : undefined}>
        {fmt(v)}
      </td>
    );
  };

  const renderTxCell = (def: ColDef<InvestmentTransaction>, t: InvestmentTransaction) => {
    const v = def.get(t);
    if (def.key === "_account_display") return <td key={def.key}>{String(v ?? "")}</td>;
    if (def.key === "raw_payload")
      return (
        <td key={def.key} className="small">
          <code>{fmt(v)}</code>
        </td>
      );
    if (def.key === "amount" || def.key === "price" || def.key === "fees")
      return (
        <td key={def.key} className="text-end">
          {money(v, (t.currency_code as string) || "USD")}
        </td>
      );
    return (
      <td key={def.key} className={def.align === "end" ? "text-end" : undefined}>
        {fmt(v)}
      </td>
    );
  };

  const renderSecCell = (def: ColDef<SecurityRow>, s: SecurityRow) => {
    const v = def.get(s);
    if (def.key === "raw_payload" || def.key === "option_contract" || def.key === "fixed_income")
      return (
        <td key={def.key} className="small">
          <code>{fmt(v)}</code>
        </td>
      );
    if (def.key === "close_price")
      return (
        <td key={def.key} className="text-end">
          {money(v, (s.currency_code as string) || "USD")}
        </td>
      );
    if (def.key === "id")
      return (
        <td key={def.key}>
          <code>{String(v)}</code>
        </td>
      );
    return (
      <td key={def.key} className={def.align === "end" ? "text-end" : undefined}>
        {fmt(v)}
      </td>
    );
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h1 className="h3 mb-1">Investments Dev</h1>
          <div className="text-muted">Holdings, investment activity, and security reference data from Plaid.</div>
        </div>
        <div className="text-end">
          <div className="fw-semibold">{money(totalValue)}</div>
          <div className="small text-muted">filtered holding value</div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-header py-2 small fw-semibold">Filters</div>
        <div className="card-body py-3">
          <div className="mb-3">
            <div className="small text-muted mb-1">Sections — hide entire blocks</div>
            <div className="btn-group btn-group-sm" role="group">
              {(["holdings", "transactions", "securities"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`btn ${visibleSections[k] ? "btn-outline-primary" : "btn-outline-secondary"}`}
                  onClick={() => toggleSection(k)}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <div className="small text-muted mb-1">Accounts — uncheck to remove rows tied to that account</div>
            <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setExcludedAccounts(new Set())}>
                All accounts
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setExcludedAccounts(new Set(accountsIndex.map(([id]) => id)))}
              >
                Hide all
              </button>
            </div>
            {accountsIndex.length === 0 ? (
              <div className="text-muted small">No accounts loaded yet.</div>
            ) : (
              <div className="d-flex flex-wrap gap-3 border rounded px-3 py-2" style={{ maxHeight: 140, overflowY: "auto" }}>
                {accountsIndex.map(([id, label]) => (
                  <label key={id} className="form-check mb-0 small" title={id}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={!excludedAccounts.has(id)}
                      onChange={(e) => toggleAccount(id, e.target.checked)}
                    />
                    <span className="form-check-label ms-1">{label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="row g-3">
            {visibleSections.holdings && (
              <div className="col-lg-4">
                <div className="small text-muted mb-1">Columns — Holdings</div>
                <div className="d-flex flex-column gap-1 border rounded px-2 py-2 small" style={{ maxHeight: 220, overflowY: "auto" }}>
                  {HOLDING_COLS.map((c) => (
                    <label key={c.key} className="form-check mb-0">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={colsHoldings[c.key] ?? false}
                        onChange={() => setColsHoldings((p) => ({ ...p, [c.key]: !p[c.key] }))}
                      />
                      <span className="form-check-label">{c.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {visibleSections.transactions && (
              <div className="col-lg-4">
                <div className="small text-muted mb-1">Columns — Transactions</div>
                <div className="d-flex flex-column gap-1 border rounded px-2 py-2 small" style={{ maxHeight: 220, overflowY: "auto" }}>
                  {TX_COLS.map((c) => (
                    <label key={c.key} className="form-check mb-0">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={colsTx[c.key] ?? false}
                        onChange={() => setColsTx((p) => ({ ...p, [c.key]: !p[c.key] }))}
                      />
                      <span className="form-check-label">{c.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {visibleSections.securities && (
              <div className="col-lg-4">
                <div className="small text-muted mb-1">Columns — Securities</div>
                <div className="d-flex flex-column gap-1 border rounded px-2 py-2 small" style={{ maxHeight: 220, overflowY: "auto" }}>
                  {SEC_COLS.map((c) => (
                    <label key={c.key} className="form-check mb-0">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={colsSec[c.key] ?? false}
                        onChange={() => setColsSec((p) => ({ ...p, [c.key]: !p[c.key] }))}
                      />
                      <span className="form-check-label">{c.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body d-flex flex-wrap gap-2 align-items-end">
          <button className="btn btn-primary" disabled={loading || !token} onClick={() => sync("/api/investments/holdings/sync")}>
            Sync holdings
          </button>
          <div>
            <label className="form-label small mb-1">Start</label>
            <input className="form-control" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="form-label small mb-1">End</label>
            <input className="form-control" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <button
            className="btn btn-outline-primary"
            disabled={loading || !token}
            onClick={() => sync("/api/investments/transactions/sync", { startDate, endDate })}
          >
            Sync transactions
          </button>
          <button className="btn btn-outline-secondary" disabled={loading || !token} onClick={() => load()}>
            Reload
          </button>
          {status && <code className="ms-auto small">{status}</code>}
        </div>
      </div>

      {visibleSections.holdings && (
        <section className="mb-4">
          <h2 className="h5">Holdings ({filteredHoldings.length})</h2>
          <div className="table-responsive">
            <table className="table table-sm table-striped align-middle">
              <thead>
                <tr>
                  {HOLDING_COLS.map((c) =>
                    colsHoldings[c.key] ? (
                      <th key={c.key} className={thClass(c.align)}>
                        {c.label}
                      </th>
                    ) : null
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredHoldings.map((h) => (
                  <tr key={`${h.account_id}:${h.security_id}`}>
                    {HOLDING_COLS.map((c) => (colsHoldings[c.key] ? renderCell(c, h) : null))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {visibleSections.transactions && (
        <section className="mb-4">
          <h2 className="h5">Investment Transactions ({filteredTx.length})</h2>
          <div className="table-responsive">
            <table className="table table-sm table-striped align-middle">
              <thead>
                <tr>
                  {TX_COLS.map((c) =>
                    colsTx[c.key] ? (
                      <th key={c.key} className={thClass(c.align)}>
                        {c.label}
                      </th>
                    ) : null
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredTx.map((t) => (
                  <tr key={t.id}>
                    {TX_COLS.map((c) => (colsTx[c.key] ? renderTxCell(c, t) : null))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {visibleSections.securities && (
        <section>
          <h2 className="h5">Securities ({filteredSec.length})</h2>
          <div className="table-responsive">
            <table className="table table-sm table-striped align-middle">
              <thead>
                <tr>
                  {SEC_COLS.map((c) =>
                    colsSec[c.key] ? (
                      <th key={c.key} className={thClass(c.align)}>
                        {c.label}
                      </th>
                    ) : null
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredSec.map((s) => (
                  <tr key={s.id}>
                    {SEC_COLS.map((c) => (colsSec[c.key] ? renderSecCell(c, s) : null))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

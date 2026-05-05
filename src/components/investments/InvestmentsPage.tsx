import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { buildAuthHeaders } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

type InvestmentsPayload = {
  holdings: InvestmentHolding[];
  transactions: InvestmentTransaction[];
  securities: Security[];
};

type JoinedAccount = { name?: string | null; official_name?: string | null };
type JoinedItem = { institution_name?: string | null };
type Security = {
  id: string;
  name?: string | null;
  ticker_symbol?: string | null;
  type?: string | null;
  subtype?: string | null;
  close_price?: number | null;
  currency_code?: string | null;
  close_price_as_of?: string | null;
  update_datetime?: string | null;
};
type InvestmentHolding = {
  account_id: string;
  security_id: string;
  quantity?: number | null;
  institution_price?: number | null;
  institution_value?: number | null;
  currency_code?: string | null;
  institution_price_date?: string | null;
  accounts?: JoinedAccount | null;
  items?: JoinedItem | null;
  securities?: Security | null;
};
type InvestmentTransaction = {
  id: string;
  account_id: string;
  datetime?: string | null;
  name?: string | null;
  quantity?: number | null;
  amount?: number | null;
  currency_code?: string | null;
  type?: string | null;
  subtype?: string | null;
  accounts?: JoinedAccount | null;
  items?: JoinedItem | null;
  securities?: Security | null;
};

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

  const totalValue = useMemo(
    () => data.holdings.reduce((sum, h) => sum + (typeof h.institution_value === "number" ? h.institution_value : 0), 0),
    [data.holdings]
  );

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h1 className="h3 mb-1">Investments Dev</h1>
          <div className="text-muted">Holdings, investment activity, and security reference data from Plaid.</div>
        </div>
        <div className="text-end">
          <div className="fw-semibold">{money(totalValue)}</div>
          <div className="small text-muted">current holding value</div>
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

      <section className="mb-4">
        <h2 className="h5">Holdings ({data.holdings.length})</h2>
        <div className="table-responsive">
          <table className="table table-sm table-striped align-middle">
            <thead><tr><th>Institution</th><th>Account</th><th>Ticker</th><th>Name</th><th className="text-end">Qty</th><th className="text-end">Price</th><th className="text-end">Value</th><th>Price date</th></tr></thead>
            <tbody>
              {data.holdings.map((h) => (
                <tr key={`${h.account_id}:${h.security_id}`}>
                  <td>{h.items?.institution_name}</td>
                  <td>{h.accounts?.name || h.accounts?.official_name || h.account_id}</td>
                  <td>{h.securities?.ticker_symbol}</td>
                  <td>{h.securities?.name}</td>
                  <td className="text-end">{h.quantity}</td>
                  <td className="text-end">{money(h.institution_price, h.currency_code || "USD")}</td>
                  <td className="text-end">{money(h.institution_value, h.currency_code || "USD")}</td>
                  <td>{h.institution_price_date?.slice?.(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-4">
        <h2 className="h5">Investment Transactions ({data.transactions.length})</h2>
        <div className="table-responsive">
          <table className="table table-sm table-striped align-middle">
            <thead><tr><th>Date</th><th>Institution</th><th>Account</th><th>Ticker</th><th>Name</th><th>Type</th><th className="text-end">Qty</th><th className="text-end">Amount</th></tr></thead>
            <tbody>
              {data.transactions.map((t) => (
                <tr key={t.id}>
                  <td>{t.datetime?.slice?.(0, 10)}</td>
                  <td>{t.items?.institution_name}</td>
                  <td>{t.accounts?.name || t.accounts?.official_name || t.account_id}</td>
                  <td>{t.securities?.ticker_symbol}</td>
                  <td>{t.name}</td>
                  <td>{t.type} / {t.subtype}</td>
                  <td className="text-end">{t.quantity}</td>
                  <td className="text-end">{money(t.amount, t.currency_code || "USD")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="h5">Securities ({data.securities.length})</h2>
        <div className="table-responsive">
          <table className="table table-sm table-striped align-middle">
            <thead><tr><th>Ticker</th><th>Name</th><th>Type</th><th>Subtype</th><th className="text-end">Close</th><th>Updated</th><th>ID</th></tr></thead>
            <tbody>
              {data.securities.map((s) => (
                <tr key={s.id}>
                  <td>{s.ticker_symbol}</td>
                  <td>{s.name}</td>
                  <td>{s.type}</td>
                  <td>{s.subtype}</td>
                  <td className="text-end">{money(s.close_price, s.currency_code || "USD")}</td>
                  <td>{s.update_datetime?.slice?.(0, 10) || s.close_price_as_of?.slice?.(0, 10)}</td>
                  <td><code>{s.id}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

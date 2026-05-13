import { useMemo, useState, type ReactNode } from "react";
import type { Txn } from "../types";
import { buildAuthHeaders } from "../../lib/auth";
import { formatTxnDate, getTxnDateOnly } from "../../utils/transactionUtils";
import { Alert, ClickEditNumber } from "../shared/ui";

type Props = { transactions: Txn[]; token: string | null; invalidateTransactionMeta: () => Promise<void> };
type Pair = { pairId: string; outflow: Txn; inflow: Txn; dayGap: number };

const errMsg = (e: unknown) => e instanceof Error ? e.message : "Unexpected error";

function groupPairsByDaysApart(sorted: Pair[]): { gapKey: number; label: string; pairs: Pair[] }[] {
  const out: { gapKey: number; label: string; pairs: Pair[] }[] = [];
  for (const p of sorted) {
    const gapKey = Number.isFinite(p.dayGap) ? Math.round(p.dayGap) : -1;
    const label = gapKey < 0 ? "Date unknown" : gapKey === 0 ? "Same day" : `${gapKey} day${gapKey === 1 ? "" : "s"} apart`;
    const last = out[out.length - 1];
    if (last?.gapKey === gapKey) last.pairs.push(p);
    else out.push({ gapKey, label, pairs: [p] });
  }
  return out;
}

function daysBetween(a: Txn, b: Txn): number {
  const d1 = getTxnDateOnly(a), d2 = getTxnDateOnly(b);
  if (!d1 || !d2) return Infinity;
  return Math.abs((new Date(d1).getTime() - new Date(d2).getTime()) / 86_400_000);
}

function TxnCell({ t }: { t: Txn }) {
  return (
    <div>
      <div className="fw-semi small">{t.name || t.merchant_name || "—"}</div>
      <div className="xs muted">{t.account_name || t.account_official_name || ""}</div>
    </div>
  );
}

function AccountCheckFilter({ label, options, excluded, setExcluded }: { label: string; options: { id: string; label: string }[]; excluded: Set<string>; setExcluded: (updater: (prev: Set<string>) => Set<string>) => void }) {
  return (
    <div className="field">
      <div className="row-flex between flex-wrap gap-2">
        <label style={{ margin: 0 }}>{label} ({options.length - excluded.size} of {options.length})</label>
        <div className="row-flex gap-2">
          <button type="button" className="btn ghost btn-sm" onClick={() => setExcluded(() => new Set())}>All</button>
          <button type="button" className="btn ghost btn-sm" onClick={() => setExcluded(() => new Set(options.map((a) => a.id)))}>None</button>
        </div>
      </div>
      <div className="scrollbox" style={{ border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: 8, marginTop: 6 }}>
        {options.map((a) => (
          <label key={a.id} className="check" style={{ display: "flex", padding: "3px 0" }}>
            <input
              type="checkbox"
              checked={!excluded.has(a.id)}
              onChange={(e) => setExcluded((prev) => {
                const next = new Set(prev);
                if (e.target.checked) next.delete(a.id); else next.add(a.id);
                return next;
              })}
            />
            <span>{a.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function PairRow({ pair, ambiguous, action }: { pair: Pair; ambiguous?: boolean; action: ReactNode }) {
  const outAmt = Math.abs(pair.outflow.amount ?? 0);
  const inAmt = Math.abs(pair.inflow.amount ?? 0);
  const amtMismatch = Math.abs(outAmt - inAmt) > 0.001;
  return (
    <div className="transfer-pair" style={{ opacity: ambiguous ? 0.65 : 1 }}>
      <div>
        <div className="fw-bold">
          {amtMismatch ? <><span className="text-danger">${outAmt.toFixed(2)}</span> <span className="muted xs">/</span> <span className="text-success">${inAmt.toFixed(2)}</span></> : `$${outAmt.toFixed(2)}`}
        </div>
        <div className="xs muted">{formatTxnDate(pair.outflow)}{formatTxnDate(pair.outflow) !== formatTxnDate(pair.inflow) ? ` / ${formatTxnDate(pair.inflow)}` : ""}</div>
        {ambiguous && <span className="chip chip-warning mt-2">Ambiguous</span>}
      </div>
      <div><div className="xs muted fw-semi mb-1">OUT</div><TxnCell t={pair.outflow} /></div>
      <div><div className="xs muted fw-semi mb-1">IN</div><TxnCell t={pair.inflow} /></div>
      <div>{action}</div>
    </div>
  );
}

export default function TransferGroupTool({ transactions, token, invalidateTransactionMeta }: Props) {
  const [tab, setTab] = useState<"find" | "existing">("find");
  const [maxDays, setMaxDays] = useState(3);
  const [amountTol, setAmountTol] = useState(0);
  const [excludedOutAccounts, setExcludedOutAccounts] = useState<Set<string>>(new Set());
  const [excludedInAccounts, setExcludedInAccounts] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accountOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of transactions) {
      if (!t.account_id) continue;
      if (!m.has(t.account_id)) m.set(t.account_id, t.account_name || t.account_official_name || t.account_id);
    }
    return [...m.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [transactions]);

  const { pairs, ambiguousIds, totalPairs } = useMemo(() => {
    const cand = transactions.filter((t) => !t.account_transfer_group && t.transaction_id && t.amount != null);
    const out: Pair[] = [];
    for (let i = 0; i < cand.length; i++) {
      for (let j = i + 1; j < cand.length; j++) {
        const a = cand[i], b = cand[j];
        if (a.account_id === b.account_id) continue;
        if (Math.abs((a.amount ?? 0) + (b.amount ?? 0)) > amountTol) continue;
        const gap = daysBetween(a, b);
        if (gap > maxDays) continue;
        const [outflow, inflow] = (a.amount ?? 0) > 0 ? [a, b] : [b, a];
        if (outflow.account_id && excludedOutAccounts.has(outflow.account_id)) continue;
        if (inflow.account_id && excludedInAccounts.has(inflow.account_id)) continue;
        out.push({ pairId: `${a.transaction_id}-${b.transaction_id}`, outflow, inflow, dayGap: gap });
      }
    }
    const count = new Map<string, number>();
    out.forEach((p) => { count.set(p.outflow.transaction_id!, (count.get(p.outflow.transaction_id!) ?? 0) + 1); count.set(p.inflow.transaction_id!, (count.get(p.inflow.transaction_id!) ?? 0) + 1); });
    const ambiguous = new Set([...count.entries()].filter(([, c]) => c > 1).map(([id]) => id));
    out.sort((a, b) => {
      if (a.dayGap !== b.dayGap) return a.dayGap - b.dayGap;
      const da = getTxnDateOnly(a.outflow) || "";
      const db = getTxnDateOnly(b.outflow) || "";
      if (da !== db) return da.localeCompare(db);
      return a.pairId.localeCompare(b.pairId);
    });
    return { pairs: out, ambiguousIds: ambiguous, totalPairs: out.length };
  }, [transactions, maxDays, amountTol, excludedOutAccounts, excludedInAccounts]);

  const { existing, broken } = useMemo(() => {
    const m = new Map<string, Txn[]>();
    transactions.forEach((t) => { if (t.account_transfer_group) { const arr = m.get(t.account_transfer_group) ?? []; arr.push(t); m.set(t.account_transfer_group, arr); } });
    const existing: { id: string; outflow: Txn; inflow: Txn }[] = [];
    const broken: { id: string; t: Txn }[] = [];
    for (const [id, txns] of m.entries()) {
      if (txns.length >= 2) { const [outflow, inflow] = (txns[0]?.amount ?? 0) > 0 ? [txns[0], txns[1]] : [txns[1], txns[0]]; existing.push({ id, outflow, inflow }); }
      else if (txns.length === 1) broken.push({ id, t: txns[0] });
    }
    return { existing, broken };
  }, [transactions]);

  const addGroup = async (pair: Pair) => {
    setBusyId(pair.pairId); setError(null);
    try {
      const res = await fetch("/api/transaction_meta/transfer_group", { method: "POST", headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) }, body: JSON.stringify({ transaction_ids: [pair.outflow.transaction_id, pair.inflow.transaction_id] }) });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      await invalidateTransactionMeta();
    } catch (e) { setError(errMsg(e)); } finally { setBusyId(null); }
  };

  const removeGroup = async (id: string, txIds: string[]) => {
    setBusyId(id); setError(null);
    try {
      const res = await fetch("/api/transaction_meta/transfer_group", { method: "DELETE", headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) }, body: JSON.stringify({ transaction_ids: txIds }) });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      await invalidateTransactionMeta();
    } catch (e) { setError(errMsg(e)); } finally { setBusyId(null); }
  };

  return (
    <>
      <div className="tabs">
        <button className={tab === "find" ? "active" : ""} onClick={() => setTab("find")}>Find{totalPairs > 0 && <span className="count">{totalPairs}</span>}</button>
        <button className={tab === "existing" ? "active" : ""} onClick={() => setTab("existing")}>Existing{existing.length + broken.length > 0 && <span className="count">{existing.length + broken.length}</span>}</button>
      </div>

      {error && <div className="mb-3"><Alert tone="danger" onClose={() => setError(null)}>{error}</Alert></div>}

      {tab === "find" && (
        <>
          <div className="card card-tight mb-4 transfer-tool-filters">
            <div className="field">
              <label>Max days apart: <ClickEditNumber value={maxDays} onCommit={setMaxDays} min={0} max={14} step={1} decimals={0} format={(n) => String(n)} ariaLabel="max days apart" /></label>
              <input type="range" min={0} max={14} step={1} value={maxDays} onChange={(e) => setMaxDays(Number(e.target.value))} />
            </div>
            <div className="field">
              <label>Amount tolerance: <ClickEditNumber value={amountTol} onCommit={setAmountTol} min={0} max={20} step={0.5} decimals={2} format={(n) => `$${n.toFixed(2)}`} ariaLabel="amount tolerance in dollars" /></label>
              <input type="range" min={0} max={20} step={0.5} value={amountTol} onChange={(e) => setAmountTol(Number(e.target.value))} />
            </div>
            {accountOptions.length > 0 && (
              <>
                <AccountCheckFilter label="OUT accounts" options={accountOptions} excluded={excludedOutAccounts} setExcluded={setExcludedOutAccounts} />
                <AccountCheckFilter label="IN accounts" options={accountOptions} excluded={excludedInAccounts} setExcluded={setExcludedInAccounts} />
              </>
            )}
          </div>

          {totalPairs === 0 ? (
            <div className="card"><p className="muted">No transfer pairs found with these settings. Try increasing the day range or amount tolerance.</p></div>
          ) : (
            <div>
              {groupPairsByDaysApart(pairs).map((g) => (
                <section key={g.gapKey} className="transfer-day-block">
                  <div className="transfer-day-head">{g.label}</div>
                  {g.pairs.map((p) => {
                    const ambig = ambiguousIds.has(p.outflow.transaction_id!) || ambiguousIds.has(p.inflow.transaction_id!);
                    return (
                      <PairRow
                        key={p.pairId}
                        pair={p}
                        ambiguous={ambig}
                        action={
                          <button className="btn primary btn-sm" disabled={busyId === p.pairId} onClick={() => addGroup(p)}>
                            {busyId === p.pairId ? "…" : "+ Pair"}
                          </button>
                        }
                      />
                    );
                  })}
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "existing" && (
        existing.length === 0 && broken.length === 0 ? (
          <div className="card"><p className="muted">No transfer pairs saved yet. Use the <strong>Find</strong> tab to detect them.</p></div>
        ) : (
          <div>
            {existing.map(({ id, outflow, inflow }) => (
              <PairRow
                key={id}
                pair={{ pairId: id, outflow, inflow, dayGap: 0 }}
                action={<button className="btn danger-ghost btn-sm" disabled={busyId === id} onClick={() => removeGroup(id, [outflow.transaction_id!, inflow.transaction_id!])}>{busyId === id ? "…" : "Unpair"}</button>}
              />
            ))}
            {broken.map(({ id, t }) => {
              const amt = Math.abs(t.amount ?? 0);
              const isOut = (t.amount ?? 0) > 0;
              return (
                <div key={`broken-${id}`} className="transfer-pair" style={{ background: "var(--warning-soft)", borderRadius: "var(--r-sm)", padding: "var(--s2) var(--s3)" }}>
                  <div>
                    <div className="fw-bold">${amt.toFixed(2)}</div>
                    <div className="xs muted">{formatTxnDate(t)}</div>
                    <span className="chip chip-warning mt-2">Incomplete pair</span>
                  </div>
                  <div><div className="xs muted fw-semi mb-1">OUT</div>{isOut ? <TxnCell t={t} /> : <span className="muted">—</span>}</div>
                  <div><div className="xs muted fw-semi mb-1">IN</div>{!isOut ? <TxnCell t={t} /> : <span className="muted">—</span>}</div>
                  <button className="btn danger-ghost btn-sm" disabled={busyId === id} onClick={() => removeGroup(id, [t.transaction_id!])}>{busyId === id ? "…" : "Unpair"}</button>
                </div>
              );
            })}
          </div>
        )
      )}
    </>
  );
}

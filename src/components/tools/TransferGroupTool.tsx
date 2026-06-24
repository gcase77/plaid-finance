import { useMemo, useState, type ReactNode } from "react";
import type { Txn } from "../types";
import { buildAuthHeaders } from "../../lib/auth";
import { formatTxnDate, getTxnDateOnly } from "../../utils/transactionUtils";
import { Alert, ClickEditNumber } from "../shared/ui";

type Props = { transactions: Txn[]; token: string | null; invalidateTransactionMeta: () => Promise<void> };
type Pair = { pairId: string; outflow: Txn; inflow: Txn; dayGap: number };

const errMsg = (e: unknown) => e instanceof Error ? e.message : "Unexpected error";
const TAB_KEY = "funds-up-transfer-group-tab";
const DAY_MS = 86_400_000;

function txnDateEpochMs(t: Txn): number {
  const d = getTxnDateOnly(t);
  if (!d) return Number.NEGATIVE_INFINITY;
  return Date.parse(`${d}T00:00:00Z`);
}

function pairNewestEpochMs(pair: Pair): number {
  return Math.max(txnDateEpochMs(pair.outflow), txnDateEpochMs(pair.inflow));
}

function isEpochOlderThanDays(epochMs: number, days: number, nowMs: number): boolean {
  if (!Number.isFinite(epochMs)) return false;
  return nowMs - epochMs > days * DAY_MS;
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

function PairRow({ pair, ambiguous, old, action }: { pair: Pair; ambiguous?: boolean; old?: boolean; action: ReactNode }) {
  const outAmt = Math.abs(pair.outflow.amount ?? 0);
  const inAmt = Math.abs(pair.inflow.amount ?? 0);
  const amtMismatch = Math.abs(outAmt - inAmt) > 0.001;
  return (
    <div className={`transfer-pair${old ? " transfer-pair-old" : ""}`} style={{ opacity: ambiguous ? 0.65 : undefined }}>
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
  const [tab, setTab] = useState<"find" | "existing">(() => {
    if (typeof window === "undefined") return "find";
    return window.localStorage.getItem(TAB_KEY) === "existing" ? "existing" : "find";
  });
  const setTabPersist = (t: "find" | "existing") => {
    setTab(t);
    if (typeof window !== "undefined") window.localStorage.setItem(TAB_KEY, t);
  };
  const [maxDays, setMaxDays] = useState(3);
  const [amountTol, setAmountTol] = useState(0);
  const [existingStartDate, setExistingStartDate] = useState("");
  const [existingEndDate, setExistingEndDate] = useState("");
  const [existingMinAmount, setExistingMinAmount] = useState(0);
  const [existingMaxAmountFilter, setExistingMaxAmountFilter] = useState<number | null>(null);
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
      const newestA = pairNewestEpochMs(a);
      const newestB = pairNewestEpochMs(b);
      if (newestA !== newestB) return newestB - newestA;
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

  const existingMaxAmount = useMemo(() => Math.ceil(Math.max(0, ...existing.map(({ outflow }) => Math.abs(outflow.amount ?? 0)), ...broken.map(({ t }) => Math.abs(t.amount ?? 0)))), [existing, broken]);
  const existingAmountMax = Math.max(1, existingMaxAmount);
  const existingAmountHi = Math.min(existingMaxAmountFilter ?? existingAmountMax, existingAmountMax);
  const existingAmountLo = Math.min(existingMinAmount, existingAmountHi);
  const amountLoPct = (existingAmountLo / existingAmountMax) * 100;
  const amountHiPct = (existingAmountHi / existingAmountMax) * 100;

  const filteredExisting = useMemo(() => existing.filter(({ outflow }) => {
    const d = getTxnDateOnly(outflow);
    if (existingStartDate && (!d || d < existingStartDate)) return false;
    if (existingEndDate && (!d || d > existingEndDate)) return false;
    const amt = Math.abs(outflow.amount ?? 0);
    return amt >= existingAmountLo && amt <= existingAmountHi;
  }), [existing, existingStartDate, existingEndDate, existingAmountLo, existingAmountHi]);

  const filteredBroken = useMemo(() => broken.filter(({ t }) => {
    const isOut = (t.amount ?? 0) > 0;
    const d = getTxnDateOnly(t);
    if (existingStartDate && (!isOut || !d || d < existingStartDate)) return false;
    if (existingEndDate && (!isOut || !d || d > existingEndDate)) return false;
    const amt = Math.abs(t.amount ?? 0);
    return amt >= existingAmountLo && amt <= existingAmountHi;
  }), [broken, existingStartDate, existingEndDate, existingAmountLo, existingAmountHi]);

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
  const nowMs = Date.now();

  return (
    <>
      <div className="tabs">
        <button className={tab === "find" ? "active" : ""} onClick={() => setTabPersist("find")}>Find{totalPairs > 0 && <span className="count">{totalPairs}</span>}</button>
        <button className={tab === "existing" ? "active" : ""} onClick={() => setTabPersist("existing")}>Existing{filteredExisting.length + filteredBroken.length > 0 && <span className="count">{filteredExisting.length + filteredBroken.length}</span>}</button>
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
              <label>Amount tolerance: <ClickEditNumber value={amountTol} onCommit={setAmountTol} min={0} max={20} step={0.1} decimals={2} format={(n) => `$${n.toFixed(2)}`} ariaLabel="amount tolerance in dollars" /></label>
              <input type="range" min={0} max={20} step={0.1} value={amountTol} onChange={(e) => setAmountTol(Number(e.target.value))} />
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
              {pairs.map((p) => {
                const ambig = ambiguousIds.has(p.outflow.transaction_id!) || ambiguousIds.has(p.inflow.transaction_id!);
                const old = isEpochOlderThanDays(pairNewestEpochMs(p), 30, nowMs);
                return (
                  <PairRow
                    key={p.pairId}
                    pair={p}
                    ambiguous={ambig}
                    old={old}
                    action={
                      <button className="btn primary btn-sm" disabled={busyId === p.pairId} onClick={() => addGroup(p)}>
                        {busyId === p.pairId ? "…" : "+ Pair"}
                      </button>
                    }
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "existing" && (
        existing.length === 0 && broken.length === 0 ? (
          <div className="card"><p className="muted">No transfer pairs saved yet. Use the <strong>Find</strong> tab to detect them.</p></div>
        ) : (
          <div>
            <div className="card card-tight mb-4 transfer-tool-filters">
              <div className="field">
                <label>OUT date from</label>
                <input className="input" type="date" value={existingStartDate} onChange={(e) => setExistingStartDate(e.target.value)} />
              </div>
              <div className="field">
                <label>OUT date to</label>
                <input className="input" type="date" value={existingEndDate} onChange={(e) => setExistingEndDate(e.target.value)} />
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Amount</label>
                <div className="row-flex between gap-3">
                  <input className="input input-sm" type="number" min={0} max={existingAmountHi} step={1} value={existingAmountLo} onChange={(e) => setExistingMinAmount(Math.min(Number(e.target.value), existingAmountHi))} aria-label="minimum existing transfer amount" style={{ width: "7rem" }} />
                  <input className="input input-sm" type="number" min={existingAmountLo} max={existingAmountMax} step={1} value={existingAmountHi} onChange={(e) => setExistingMaxAmountFilter(Math.max(Number(e.target.value), existingAmountLo))} aria-label="maximum existing transfer amount" style={{ width: "7rem" }} />
                </div>
                <div className="amount-range" style={{ background: `linear-gradient(to right, var(--line) 0%, var(--line) ${amountLoPct}%, var(--brand) ${amountLoPct}%, var(--brand) ${amountHiPct}%, var(--line) ${amountHiPct}%, var(--line) 100%)` }}>
                  <input type="range" min={0} max={existingAmountMax} step={1} value={existingAmountLo} onChange={(e) => setExistingMinAmount(Math.min(Number(e.target.value), existingAmountHi))} aria-label="minimum existing transfer amount slider" />
                  <input type="range" min={0} max={existingAmountMax} step={1} value={existingAmountHi} onChange={(e) => setExistingMaxAmountFilter(Math.max(Number(e.target.value), existingAmountLo))} aria-label="maximum existing transfer amount slider" />
                </div>
                <div className="row-flex between xs muted">
                  <span>${existingAmountLo.toFixed(2)}</span>
                  <span>${existingAmountHi.toFixed(2)}</span>
                </div>
              </div>
            </div>
            {filteredExisting.length === 0 && filteredBroken.length === 0 && <div className="card"><p className="muted">No saved transfer pairs match these filters.</p></div>}
            {filteredBroken.map(({ id, t }) => {
              const amt = Math.abs(t.amount ?? 0);
              const isOut = (t.amount ?? 0) > 0;
              const old = isEpochOlderThanDays(txnDateEpochMs(t), 30, nowMs);
              return (
                <div key={`broken-${id}`} className={`transfer-pair${old ? " transfer-pair-old" : ""}`} style={{ background: "var(--warning-soft)", borderRadius: "var(--r-sm)", padding: "var(--s2) var(--s3)" }}>
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
            {filteredExisting.map(({ id, outflow, inflow }) => (
              <PairRow
                key={id}
                pair={{ pairId: id, outflow, inflow, dayGap: 0 }}
                old={isEpochOlderThanDays(pairNewestEpochMs({ pairId: id, outflow, inflow, dayGap: 0 }), 30, nowMs)}
                action={<button className="btn danger-ghost btn-sm" disabled={busyId === id} onClick={() => removeGroup(id, [outflow.transaction_id!, inflow.transaction_id!])}>{busyId === id ? "…" : "Unpair"}</button>}
              />
            ))}
          </div>
        )
      )}
    </>
  );
}

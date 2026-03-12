import { useMemo, useState } from "react";
import type { Txn } from "../types";
import { buildAuthHeaders } from "../../lib/auth";
import { formatTxnAmount, formatTxnDate, getTxnDateOnly } from "../../utils/transactionUtils";

type Props = {
  transactions: Txn[];
  token: string | null;
  invalidateTransactionMeta: () => Promise<void>;
};

type Pair = {
  pairId: string;
  outflow: Txn;
  inflow: Txn;
  dayGap: number;
};

function daysBetween(a: Txn, b: Txn): number {
  const d1 = getTxnDateOnly(a);
  const d2 = getTxnDateOnly(b);
  if (!d1 || !d2) return Infinity;
  return Math.abs((new Date(d1).getTime() - new Date(d2).getTime()) / 86_400_000);
}

function TxnCols({ t }: { t: Txn }) {
  return (
    <td>
      <div className="small">{t.name || t.merchant_name || "—"}</div>
      <div className="text-muted fst-italic" style={{ fontSize: "0.75em" }}>{t.account_name || t.account_official_name || ""}</div>
    </td>
  );
}

function SummaryCol({ outflow, inflow }: { outflow: Txn; inflow: Txn }) {
  const outAmt = Math.abs(outflow.amount ?? 0);
  const inAmt = Math.abs(inflow.amount ?? 0);
  const amountsDiffer = Math.abs(outAmt - inAmt) > 0.001;

  const outDate = formatTxnDate(outflow);
  const inDate = formatTxnDate(inflow);
  const datesDiffer = outDate !== inDate;

  return (
    <td className="small text-nowrap" style={{ borderRight: "1px solid var(--bs-border-color)" }}>
      <div className="fw-semibold">
        {amountsDiffer
          ? <><span className="text-danger">${outAmt.toFixed(2)}</span><span className="text-muted mx-1">/</span><span className="text-success">${inAmt.toFixed(2)}</span></>
          : `$${outAmt.toFixed(2)}`}
      </div>
      <div className="text-muted" style={{ fontSize: "0.8em" }}>
        {datesDiffer ? <>{outDate}<span className="text-muted mx-1">/</span>{inDate}</> : outDate}
      </div>
    </td>
  );
}

const COL_SPAN = 4; // summary + outflow + inflow + action

export default function TransferGroupTool({ transactions, token, invalidateTransactionMeta }: Props) {
  const [tab, setTab] = useState<"find" | "existing">("find");
  const [maxDays, setMaxDays] = useState(3);
  const [amountTol, setAmountTol] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { pairsByGap, ambiguousIds } = useMemo(() => {
    const candidates = transactions.filter(t => !t.account_transfer_group && t.transaction_id && t.amount != null);
    const pairs: Pair[] = [];

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i], b = candidates[j];
        if (a.account_id === b.account_id) continue;
        if (Math.abs((a.amount ?? 0) + (b.amount ?? 0)) > amountTol) continue;
        const gap = daysBetween(a, b);
        if (gap > maxDays) continue;
        const [outflow, inflow] = (a.amount ?? 0) > 0 ? [a, b] : [b, a];
        pairs.push({ pairId: `${a.transaction_id}-${b.transaction_id}`, outflow, inflow, dayGap: gap });
      }
    }

    const txCount = new Map<string, number>();
    for (const p of pairs) {
      txCount.set(p.outflow.transaction_id!, (txCount.get(p.outflow.transaction_id!) ?? 0) + 1);
      txCount.set(p.inflow.transaction_id!, (txCount.get(p.inflow.transaction_id!) ?? 0) + 1);
    }
    const ambiguousIds = new Set([...txCount.entries()].filter(([, c]) => c > 1).map(([id]) => id));

    const map = new Map<number, Pair[]>();
    for (const p of pairs) {
      const arr = map.get(p.dayGap) ?? [];
      arr.push(p);
      map.set(p.dayGap, arr);
    }

    return { pairsByGap: [...map.entries()].sort((a, b) => a[0] - b[0]), ambiguousIds };
  }, [transactions, maxDays, amountTol]);

  const totalPairs = pairsByGap.reduce((s, [, ps]) => s + ps.length, 0);

  const existingGroups = useMemo(() => {
    const map = new Map<string, Txn[]>();
    for (const t of transactions) {
      if (t.account_transfer_group) {
        const arr = map.get(t.account_transfer_group) ?? [];
        arr.push(t);
        map.set(t.account_transfer_group, arr);
      }
    }
    return [...map.entries()].map(([id, txns]) => {
      const [outflow, inflow] = (txns[0]?.amount ?? 0) > 0 ? [txns[0], txns[1]] : [txns[1], txns[0]];
      return { id, outflow, inflow };
    });
  }, [transactions]);

  const addGroup = async (pair: Pair) => {
    setSavingId(pair.pairId);
    setError(null);
    try {
      const res = await fetch("/api/transaction_meta/transfer_group", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) },
        body: JSON.stringify({ transaction_ids: [pair.outflow.transaction_id, pair.inflow.transaction_id] })
      });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      await invalidateTransactionMeta();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  };

  const removeGroup = async (groupId: string, outflow: Txn, inflow: Txn) => {
    setRemovingId(groupId);
    setError(null);
    try {
      const res = await fetch("/api/transaction_meta/transfer_group", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) },
        body: JSON.stringify({ transaction_ids: [outflow.transaction_id, inflow.transaction_id] })
      });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      await invalidateTransactionMeta();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRemovingId(null);
    }
  };

  const tableHead = (
    <thead>
      <tr>
        <th />
        <th className="small text-muted fw-semibold border-end">Outflow</th>
        <th className="small text-muted fw-semibold">Inflow</th>
        <th />
      </tr>
    </thead>
  );

  return (
    <div className="card">
      <div className="card-body">
        <h6 className="card-title mb-1">Account Transfers</h6>
        <p className="text-muted small mb-3">Recognized transfers will be ignored from income and spending calculations.</p>

        {error && <div className="alert alert-danger py-1 small">{error}</div>}

        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button className={`nav-link ${tab === "find" ? "active" : ""}`} onClick={() => setTab("find")}>
              Find {totalPairs > 0 && <span className="badge bg-secondary ms-1">{totalPairs}</span>}
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${tab === "existing" ? "active" : ""}`} onClick={() => setTab("existing")}>
              Existing {existingGroups.length > 0 && <span className="badge bg-secondary ms-1">{existingGroups.length}</span>}
            </button>
          </li>
        </ul>

        {tab === "find" && (
          <>
            <div className="row g-3 mb-4">
              <div className="col-sm-6">
                <label className="form-label small mb-1">Max days apart</label>
                <div className="d-flex align-items-center gap-2">
                  <input type="range" className="form-range flex-fill" min={0} max={14} step={1} value={maxDays}
                    onChange={e => setMaxDays(Number(e.target.value))} />
                  <input type="number" className="form-control form-control-sm" min={0} max={14} step={1} value={maxDays}
                    style={{ width: 64 }}
                    onChange={e => setMaxDays(Math.min(14, Math.max(0, Number(e.target.value))))} />
                </div>
              </div>
              <div className="col-sm-6">
                <label className="form-label small mb-1">Amount tolerance ($)</label>
                <div className="d-flex align-items-center gap-2">
                  <input type="range" className="form-range flex-fill" min={0} max={20} step={0.01} value={amountTol}
                    onChange={e => setAmountTol(Number(e.target.value))} />
                  <input type="number" className="form-control form-control-sm" min={0} max={20} step={0.01} value={amountTol}
                    style={{ width: 64 }}
                    onChange={e => setAmountTol(Math.min(20, Math.max(0, Number(e.target.value))))} />
                </div>
              </div>
            </div>

            {totalPairs === 0 ? (
              <p className="text-muted small mb-0">No transfer pairs found with these settings.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-striped align-middle mb-0">
                  {tableHead}
                  <tbody>
                    {pairsByGap.map(([gap, gPairs]) => (
                      <>
                        <tr key={`gap-${gap}`} className="table-light">
                          <td colSpan={COL_SPAN} className="py-1">
                            <h6 className="fw-bold mb-0 small">
                              {gap === 0 ? "Same day" : `${gap} day${gap > 1 ? "s" : ""} apart`}
                              <span className="fw-normal text-muted ms-2">({gPairs.length})</span>
                            </h6>
                          </td>
                        </tr>
                        {gPairs.map(pair => {
                          const isAmbiguous = ambiguousIds.has(pair.outflow.transaction_id!) || ambiguousIds.has(pair.inflow.transaction_id!);
                          return (
                            <tr key={pair.pairId} className={isAmbiguous ? "opacity-50" : ""}>
                              <SummaryCol outflow={pair.outflow} inflow={pair.inflow} />
                              <TxnCols t={pair.outflow} />
                              <TxnCols t={pair.inflow} />
                              <td className="text-end">
                                {isAmbiguous ? (
                                  <span className="badge bg-warning text-dark">Ambiguous</span>
                                ) : (
                                  <button className="btn btn-sm btn-outline-primary"
                                    disabled={savingId === pair.pairId}
                                    onClick={() => addGroup(pair)}>
                                    {savingId === pair.pairId ? "..." : "Add"}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === "existing" && (
          existingGroups.length === 0 ? (
            <p className="text-muted small mb-0">No transfer groups yet.</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-striped align-middle mb-0">
                {tableHead}
                <tbody>
                  {existingGroups.map(({ id, outflow, inflow }) => (
                    <tr key={id}>
                      <SummaryCol outflow={outflow} inflow={inflow} />
                      <TxnCols t={outflow} />
                      <TxnCols t={inflow} />
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-danger"
                          disabled={removingId === id}
                          onClick={() => removeGroup(id, outflow, inflow)}>
                          {removingId === id ? "..." : "Remove"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}

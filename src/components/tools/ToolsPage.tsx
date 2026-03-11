import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import LoadingSpinner from "../shared/LoadingSpinner";
import { useTransactionsData } from "../../hooks/useTransactionsData";
import { supabase } from "../../lib/supabase";
import { buildToolsInsights, type ToolsWindowOption } from "../../utils/toolsAnalytics";

const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

const decimal = (value: number, digits = 1) => value.toFixed(digits);

const scoreTone = (score: number) => {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "danger";
};

export default function ToolsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const token = session?.access_token ?? null;
  const txData = useTransactionsData(token);
  const [windowDays, setWindowDays] = useState<ToolsWindowOption>(90);
  const [anomalyThreshold, setAnomalyThreshold] = useState(2.2);
  const [minRecurringOccurrences, setMinRecurringOccurrences] = useState(3);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  const insights = useMemo(
    () => buildToolsInsights(txData.transactions, {
      days: windowDays,
      anomalyZThreshold: anomalyThreshold,
      minRecurringOccurrences
    }),
    [txData.transactions, windowDays, anomalyThreshold, minRecurringOccurrences]
  );

  const tone = scoreTone(insights.health.score);
  const hasTransactions = txData.transactions.length > 0;

  return (
    <div className="d-flex flex-column gap-3">
      <div className="card">
        <div className="card-body d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
          <div>
            <h5 className="mb-1">Tools: Financial Intelligence Cockpit</h5>
            <p className="text-muted mb-0">
              Live cashflow diagnostics, recurring charge radar, and anomaly detection over your real transaction stream.
            </p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button className="btn btn-success" onClick={txData.syncTransactions}>Refresh + Sync</button>
            <span className="small text-muted">{txData.errorMessage || txData.syncStatus}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-md-4">
              <label className="form-label mb-1">Analysis window</label>
              <select
                className="form-select"
                value={windowDays}
                onChange={(e) => setWindowDays(Number(e.target.value) as ToolsWindowOption)}
              >
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
                <option value={180}>180 days</option>
              </select>
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label mb-1">
                Anomaly sensitivity ({decimal(anomalyThreshold, 1)}σ)
              </label>
              <input
                type="range"
                min={1.5}
                max={3.5}
                step={0.1}
                className="form-range"
                value={anomalyThreshold}
                onChange={(e) => setAnomalyThreshold(Number(e.target.value))}
              />
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label mb-1">
                Recurring minimum occurrences ({minRecurringOccurrences})
              </label>
              <input
                type="range"
                min={3}
                max={6}
                step={1}
                className="form-range"
                value={minRecurringOccurrences}
                onChange={(e) => setMinRecurringOccurrences(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="small text-muted mt-2">
            Window: {insights.window.start} to {insights.window.end} ({insights.window.transactionCount} transactions)
          </div>
        </div>
      </div>

      {txData.loadingTxns ? (
        <LoadingSpinner />
      ) : !hasTransactions ? (
        <div className="card">
          <div className="card-body">
            <h6 className="mb-1">No transaction data yet</h6>
            <p className="text-muted mb-0">
              Link an account and sync transactions, then come back here to unlock advanced diagnostics.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="row g-3">
            <div className="col-12 col-md-6 col-xl-3">
              <div className="card h-100">
                <div className="card-body">
                  <div className="text-muted small">Income</div>
                  <div className="fs-4 fw-semibold">{money(insights.totals.income)}</div>
                  <div className="small text-muted">Avg daily {money(insights.velocity.avgDailyIncome)}</div>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <div className="card h-100">
                <div className="card-body">
                  <div className="text-muted small">Spending</div>
                  <div className="fs-4 fw-semibold">{money(insights.totals.spending)}</div>
                  <div className="small text-muted">Avg daily {money(insights.velocity.avgDailySpending)}</div>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <div className="card h-100">
                <div className="card-body">
                  <div className="text-muted small">Net cashflow</div>
                  <div className={`fs-4 fw-semibold ${insights.totals.net >= 0 ? "text-success" : "text-danger"}`}>
                    {money(insights.totals.net)}
                  </div>
                  <div className={`small ${insights.velocity.avgDailyNet >= 0 ? "text-success" : "text-danger"}`}>
                    Avg daily net {money(insights.velocity.avgDailyNet)}
                  </div>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <div className="card h-100">
                <div className="card-body">
                  <div className="text-muted small">Estimated runway</div>
                  <div className="fs-4 fw-semibold">
                    {insights.velocity.runwayDays == null ? "Stable +" : `${Math.round(insights.velocity.runwayDays)} days`}
                  </div>
                  <div className="small text-muted">
                    {insights.velocity.runwayDays == null
                      ? "Positive daily net in this window"
                      : "Projected using current burn-rate"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="mb-0">Financial health score</h6>
                <span className={`badge text-bg-${tone}`}>{insights.health.score}/100</span>
              </div>
              <div className="progress mb-3" role="progressbar" aria-label="Financial health score">
                <div
                  className={`progress-bar bg-${tone}`}
                  style={{ width: `${insights.health.score}%` }}
                  aria-valuenow={insights.health.score}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <ul className="mb-0">
                {insights.health.reasons.map((reason) => (
                  <li key={reason} className="small">{reason}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-12 col-xl-6">
              <div className="card h-100">
                <div className="card-body">
                  <h6 className="mb-2">Recurring charge radar</h6>
                  {insights.recurringCharges.length === 0 ? (
                    <p className="text-muted mb-0 small">
                      No high-confidence recurring spenders in this window.
                    </p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm align-middle mb-0">
                        <thead>
                          <tr>
                            <th>Merchant</th>
                            <th>Cadence</th>
                            <th className="text-end">Monthly</th>
                            <th className="text-end">Confidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {insights.recurringCharges.map((charge) => (
                            <tr key={`${charge.merchant}-${charge.lastChargeDate}`}>
                              <td>
                                <div>{charge.merchant}</div>
                                <div className="small text-muted">Last: {charge.lastChargeDate}</div>
                              </td>
                              <td>{charge.cadence}</td>
                              <td className="text-end">{money(charge.estimatedMonthlyCost)}</td>
                              <td className="text-end">{charge.confidence}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="col-12 col-xl-6">
              <div className="card h-100">
                <div className="card-body">
                  <h6 className="mb-2">Top spending categories</h6>
                  {insights.topCategories.length === 0 ? (
                    <p className="text-muted mb-0 small">No categorized spending in this window.</p>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {insights.topCategories.map((category) => {
                        const width = insights.totals.spending > 0 ? (category.spend / insights.totals.spending) * 100 : 0;
                        return (
                          <div key={category.category}>
                            <div className="d-flex justify-content-between small">
                              <span>{category.category}</span>
                              <span>{money(category.spend)}</span>
                            </div>
                            <div className="progress" role="progressbar" aria-label={category.category}>
                              <div className="progress-bar" style={{ width: `${Math.max(2, width)}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h6 className="mb-2">Anomaly radar</h6>
              {insights.anomalies.length === 0 ? (
                <p className="text-muted mb-0 small">
                  No overspend anomalies above {decimal(anomalyThreshold, 1)}σ in this window.
                </p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Merchant</th>
                        <th className="text-end">Amount</th>
                        <th className="text-end">Expected</th>
                        <th className="text-end">Z-score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insights.anomalies.map((anomaly) => (
                        <tr key={anomaly.id}>
                          <td>{anomaly.date}</td>
                          <td>
                            <div>{anomaly.merchant}</div>
                            <div className="small text-muted">{anomaly.reason}</div>
                          </td>
                          <td className="text-end">{money(anomaly.amount)}</td>
                          <td className="text-end">{money(anomaly.expectedAmount)}</td>
                          <td className="text-end">{decimal(anomaly.zScore, 2)}σ</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

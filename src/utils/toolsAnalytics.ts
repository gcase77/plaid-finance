import type { TransactionMerged } from "../components/types";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type ToolsWindowOption = 30 | 60 | 90 | 180;

export type RecurringChargeInsight = {
  merchant: string;
  cadence: "weekly" | "biweekly" | "monthly" | "irregular";
  averageAmount: number;
  estimatedMonthlyCost: number;
  occurrences: number;
  confidence: number;
  lastChargeDate: string;
};

export type SpendingAnomalyInsight = {
  id: string;
  merchant: string;
  amount: number;
  expectedAmount: number;
  zScore: number;
  date: string;
  reason: string;
};

export type CategoryInsight = {
  category: string;
  spend: number;
};

export type ToolsInsights = {
  totals: {
    income: number;
    spending: number;
    net: number;
  };
  velocity: {
    avgDailySpending: number;
    avgDailyIncome: number;
    avgDailyNet: number;
    runwayDays: number | null;
  };
  health: {
    score: number;
    reasons: string[];
  };
  recurringCharges: RecurringChargeInsight[];
  anomalies: SpendingAnomalyInsight[];
  topCategories: CategoryInsight[];
  window: {
    start: string;
    end: string;
    days: ToolsWindowOption;
    transactionCount: number;
  };
};

type BuildToolsInsightsOptions = {
  days: ToolsWindowOption;
  anomalyZThreshold: number;
  minRecurringOccurrences: number;
};

const toDateOnly = (raw?: string | null): string | null => {
  if (!raw) return null;
  const match = raw.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
};

const parseTransactionDate = (txn: TransactionMerged): Date | null => {
  const dateOnly = toDateOnly(txn.datetime || txn.authorized_datetime || null);
  if (!dateOnly) return null;
  const parsed = new Date(`${dateOnly}T00:00:00`);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
};

const transactionMerchant = (txn: TransactionMerged): string => {
  const raw = (txn.merchant_name || txn.name || "Unknown merchant").trim();
  return raw.replace(/\s+/g, " ").toLowerCase();
};

const categoryLabel = (txn: TransactionMerged): string =>
  txn.personal_finance_category?.detailed || txn.personal_finance_category?.primary || "uncategorized";

const median = (values: number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const standardDeviation = (values: number[], mean: number): number => {
  if (values.length < 2) return 0;
  const variance = values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

const formatDate = (date: Date): string => date.toISOString().slice(0, 10);

const cadenceFromDays = (medianGap: number): RecurringChargeInsight["cadence"] => {
  if (medianGap >= 6 && medianGap <= 9) return "weekly";
  if (medianGap >= 12 && medianGap <= 17) return "biweekly";
  if (medianGap >= 25 && medianGap <= 35) return "monthly";
  return "irregular";
};

const monthlyCostForCadence = (averageAmount: number, cadence: RecurringChargeInsight["cadence"], medianGap: number): number => {
  if (cadence === "weekly") return averageAmount * 4.33;
  if (cadence === "biweekly") return averageAmount * 2.17;
  if (cadence === "monthly") return averageAmount;
  return medianGap > 0 ? averageAmount * (30 / medianGap) : averageAmount;
};

const clampScore = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const titleCase = (raw: string): string =>
  raw
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");

export const buildToolsInsights = (
  transactions: TransactionMerged[],
  options: BuildToolsInsightsOptions
): ToolsInsights => {
  const now = new Date();
  const windowStartDate = new Date(now);
  windowStartDate.setHours(0, 0, 0, 0);
  windowStartDate.setDate(windowStartDate.getDate() - options.days + 1);

  const parsed = transactions
    .map((txn) => ({ txn, date: parseTransactionDate(txn) }))
    .filter((entry): entry is { txn: TransactionMerged; date: Date } => entry.date !== null);

  const inWindow = parsed.filter(({ date }) => date >= windowStartDate && date <= now);
  const beforeWindow = parsed.filter(({ date }) => date < windowStartDate);

  const spendingRows = inWindow.filter(({ txn }) => Number(txn.amount || 0) > 0);
  const incomeRows = inWindow.filter(({ txn }) => Number(txn.amount || 0) < 0);

  const totalSpending = spendingRows.reduce((sum, { txn }) => sum + Number(txn.amount || 0), 0);
  const totalIncome = incomeRows.reduce((sum, { txn }) => sum + Math.abs(Number(txn.amount || 0)), 0);
  const net = totalIncome - totalSpending;

  const avgDailySpending = totalSpending / options.days;
  const avgDailyIncome = totalIncome / options.days;
  const avgDailyNet = net / options.days;
  const runwayDays = avgDailyNet < 0 ? Math.abs(totalIncome / avgDailyNet) : null;

  const categorySpend = new Map<string, number>();
  spendingRows.forEach(({ txn }) => {
    const key = categoryLabel(txn);
    categorySpend.set(key, (categorySpend.get(key) || 0) + Number(txn.amount || 0));
  });

  const topCategories: CategoryInsight[] = [...categorySpend.entries()]
    .map(([category, spend]) => ({ category, spend }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5);

  const recurringCandidates = new Map<string, Array<{ amount: number; date: Date }>>();
  spendingRows.forEach(({ txn, date }) => {
    const merchant = transactionMerchant(txn);
    if (!merchant || merchant === "unknown merchant") return;
    const amount = Number(txn.amount || 0);
    if (amount <= 0) return;
    if (!recurringCandidates.has(merchant)) recurringCandidates.set(merchant, []);
    recurringCandidates.get(merchant)?.push({ amount, date });
  });

  const recurringCharges: RecurringChargeInsight[] = [...recurringCandidates.entries()]
    .map(([merchant, rows]) => {
      const sortedRows = [...rows].sort((a, b) => a.date.getTime() - b.date.getTime());
      if (sortedRows.length < options.minRecurringOccurrences) return null;

      const gaps: number[] = [];
      for (let i = 1; i < sortedRows.length; i += 1) {
        const gap = Math.round((sortedRows[i].date.getTime() - sortedRows[i - 1].date.getTime()) / MS_PER_DAY);
        if (gap > 0) gaps.push(gap);
      }
      if (!gaps.length) return null;

      const amounts = sortedRows.map((row) => row.amount);
      const averageAmount = amounts.reduce((sum, value) => sum + value, 0) / amounts.length;
      const amountStdDev = standardDeviation(amounts, averageAmount);
      const amountVarianceRatio = averageAmount > 0 ? amountStdDev / averageAmount : 1;
      const medianGap = median(gaps);
      const cadence = cadenceFromDays(medianGap);
      const gapStdDev = standardDeviation(gaps, gaps.reduce((sum, g) => sum + g, 0) / gaps.length);
      const gapVarianceRatio = medianGap > 0 ? gapStdDev / medianGap : 1;
      const confidence = Math.max(0, Math.min(100, Math.round(100 - (amountVarianceRatio * 45 + gapVarianceRatio * 45))));

      if (amountVarianceRatio > 0.35 || gapVarianceRatio > 0.4) return null;

      return {
        merchant: titleCase(merchant),
        cadence,
        averageAmount,
        estimatedMonthlyCost: monthlyCostForCadence(averageAmount, cadence, medianGap),
        occurrences: sortedRows.length,
        confidence,
        lastChargeDate: formatDate(sortedRows[sortedRows.length - 1].date)
      } satisfies RecurringChargeInsight;
    })
    .filter((entry): entry is RecurringChargeInsight => entry !== null)
    .sort((a, b) => b.estimatedMonthlyCost - a.estimatedMonthlyCost)
    .slice(0, 8);

  const merchantBaselines = new Map<string, number[]>();
  beforeWindow.forEach(({ txn }) => {
    const amount = Number(txn.amount || 0);
    if (amount <= 0) return;
    const merchant = transactionMerchant(txn);
    if (!merchantBaselines.has(merchant)) merchantBaselines.set(merchant, []);
    merchantBaselines.get(merchant)?.push(amount);
  });

  const anomalies: SpendingAnomalyInsight[] = spendingRows
    .map(({ txn, date }) => {
      const amount = Number(txn.amount || 0);
      const merchant = transactionMerchant(txn);
      const baseline = merchantBaselines.get(merchant) || [];
      if (baseline.length < 4) return null;

      const mean = baseline.reduce((sum, value) => sum + value, 0) / baseline.length;
      const stdDev = standardDeviation(baseline, mean);
      if (stdDev === 0) return null;

      const zScore = (amount - mean) / stdDev;
      if (zScore < options.anomalyZThreshold) return null;

      return {
        id: String(txn.transaction_id || `${merchant}-${formatDate(date)}-${amount}`),
        merchant: titleCase(merchant),
        amount,
        expectedAmount: mean,
        zScore,
        date: formatDate(date),
        reason: `${amount.toFixed(2)} is ${zScore.toFixed(1)}σ above ${mean.toFixed(2)} baseline`
      } satisfies SpendingAnomalyInsight;
    })
    .filter((entry): entry is SpendingAnomalyInsight => entry !== null)
    .sort((a, b) => b.zScore - a.zScore)
    .slice(0, 10);

  let healthScoreRaw = 100;
  const reasons: string[] = [];
  const spendToIncomeRatio = totalIncome > 0 ? totalSpending / totalIncome : Number.POSITIVE_INFINITY;

  if (!Number.isFinite(spendToIncomeRatio)) {
    healthScoreRaw -= 45;
    reasons.push("No recorded income in selected window");
  } else if (spendToIncomeRatio > 1.05) {
    healthScoreRaw -= 35;
    reasons.push("Spending exceeds income");
  } else if (spendToIncomeRatio > 0.9) {
    healthScoreRaw -= 20;
    reasons.push("Spending is near income ceiling");
  }

  const topCategoryShare = topCategories.length && totalSpending > 0 ? topCategories[0].spend / totalSpending : 0;
  if (topCategoryShare > 0.55) {
    healthScoreRaw -= 12;
    reasons.push("Spending concentration is high in one category");
  }

  if (recurringCharges.length >= 6) {
    healthScoreRaw -= 8;
    reasons.push("Recurring obligations footprint is high");
  }

  if (anomalies.length >= 3) {
    healthScoreRaw -= 10;
    reasons.push("Multiple high-confidence anomalies detected");
  }

  if (avgDailyNet > 0) {
    healthScoreRaw += 6;
    reasons.push("Positive daily net cash flow");
  }

  if (!reasons.length) {
    reasons.push("Healthy spending and income balance");
  }

  return {
    totals: {
      income: totalIncome,
      spending: totalSpending,
      net
    },
    velocity: {
      avgDailySpending,
      avgDailyIncome,
      avgDailyNet,
      runwayDays
    },
    health: {
      score: clampScore(healthScoreRaw),
      reasons
    },
    recurringCharges,
    anomalies,
    topCategories,
    window: {
      start: formatDate(windowStartDate),
      end: formatDate(now),
      days: options.days,
      transactionCount: inWindow.length
    }
  };
};

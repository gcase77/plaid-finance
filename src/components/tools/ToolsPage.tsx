import { useEffect, useMemo, useState } from "react";

type Debt = {
  id: number;
  name: string;
  balance: number;
  apr: number;
  minPayment: number;
};

type Subscription = {
  id: number;
  name: string;
  amount: number;
  frequency: "monthly" | "yearly";
};

type Bill = {
  id: number;
  name: string;
  amount: number;
  dueDay: number;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toTwo(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function getInitialNoSpendState() {
  if (typeof window === "undefined") {
    return { streak: 0, lastDate: "" };
  }
  const streakRaw = window.localStorage.getItem("tools_no_spend_streak");
  const dateRaw = window.localStorage.getItem("tools_no_spend_last_date");
  return {
    streak: streakRaw ? toNumber(streakRaw) : 0,
    lastDate: dateRaw ?? ""
  };
}

export default function ToolsPage() {
  const [monthlyIncome, setMonthlyIncome] = useState(7000);
  const [needsPct, setNeedsPct] = useState(50);
  const [wantsPct, setWantsPct] = useState(30);
  const [futurePct, setFuturePct] = useState(20);

  const [emergencyExpenses, setEmergencyExpenses] = useState(3500);
  const [emergencyMonths, setEmergencyMonths] = useState(6);
  const [currentEmergencyFund, setCurrentEmergencyFund] = useState(5000);
  const [monthlyEmergencyContribution, setMonthlyEmergencyContribution] = useState(750);

  const [currentSavings, setCurrentSavings] = useState(6000);
  const [savingsGoal, setSavingsGoal] = useState(25000);
  const [monthlySavingsContribution, setMonthlySavingsContribution] = useState(700);
  const [savingsApy, setSavingsApy] = useState(4.2);

  const [debtStrategy, setDebtStrategy] = useState<"snowball" | "avalanche">("avalanche");
  const [debts, setDebts] = useState<Debt[]>([
    { id: 1, name: "Credit Card A", balance: 3800, apr: 23.9, minPayment: 145 },
    { id: 2, name: "Student Loan", balance: 12000, apr: 6.8, minPayment: 180 },
    { id: 3, name: "Car Loan", balance: 6800, apr: 5.2, minPayment: 210 }
  ]);
  const [nextDebtId, setNextDebtId] = useState(4);

  const [subName, setSubName] = useState("");
  const [subAmount, setSubAmount] = useState(0);
  const [subFrequency, setSubFrequency] = useState<"monthly" | "yearly">("monthly");
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([
    { id: 1, name: "Streaming", amount: 19.99, frequency: "monthly" },
    { id: 2, name: "Cloud Storage", amount: 120, frequency: "yearly" }
  ]);
  const [nextSubId, setNextSubId] = useState(3);

  const [billName, setBillName] = useState("");
  const [billAmount, setBillAmount] = useState(0);
  const [billDueDay, setBillDueDay] = useState(1);
  const [bills, setBills] = useState<Bill[]>([
    { id: 1, name: "Rent", amount: 1900, dueDay: 1 },
    { id: 2, name: "Phone", amount: 85, dueDay: 14 }
  ]);
  const [nextBillId, setNextBillId] = useState(3);

  const [cash, setCash] = useState(9000);
  const [investments, setInvestments] = useState(26000);
  const [retirement, setRetirement] = useState(42000);
  const [propertyValue, setPropertyValue] = useState(0);
  const [creditCardDebt, setCreditCardDebt] = useState(2000);
  const [studentDebt, setStudentDebt] = useState(9500);
  const [mortgageDebt, setMortgageDebt] = useState(0);
  const [otherDebt, setOtherDebt] = useState(0);

  const [scenarioIncomeA, setScenarioIncomeA] = useState(7000);
  const [scenarioExpensesA, setScenarioExpensesA] = useState(4700);
  const [scenarioIncomeB, setScenarioIncomeB] = useState(6100);
  const [scenarioExpensesB, setScenarioExpensesB] = useState(3950);

  const [sharedExpense, setSharedExpense] = useState(180);
  const [tipPercent, setTipPercent] = useState(18);
  const [taxPercent, setTaxPercent] = useState(8.25);
  const [splitPeople, setSplitPeople] = useState(3);

  const [noSpendStreak, setNoSpendStreak] = useState(() => getInitialNoSpendState().streak);
  const [lastNoSpendDate, setLastNoSpendDate] = useState(() => getInitialNoSpendState().lastDate);

  const budgetNeeds = (monthlyIncome * needsPct) / 100;
  const budgetWants = (monthlyIncome * wantsPct) / 100;
  const budgetFuture = (monthlyIncome * futurePct) / 100;
  const budgetDelta = monthlyIncome - budgetNeeds - budgetWants - budgetFuture;

  const emergencyTarget = emergencyExpenses * emergencyMonths;
  const emergencyGap = Math.max(emergencyTarget - currentEmergencyFund, 0);
  const emergencyMonthsToGoal =
    monthlyEmergencyContribution > 0
      ? Math.ceil(emergencyGap / monthlyEmergencyContribution)
      : Number.POSITIVE_INFINITY;

  const savingsProjection = useMemo(() => {
    const monthlyRate = savingsApy / 100 / 12;
    let months = 0;
    let balance = currentSavings;
    while (balance < savingsGoal && months < 1200) {
      balance = balance * (1 + monthlyRate) + monthlySavingsContribution;
      months += 1;
    }
    const hitGoal = balance >= savingsGoal;
    return {
      months,
      hitGoal,
      projectedBalance: balance
    };
  }, [currentSavings, monthlySavingsContribution, savingsApy, savingsGoal]);

  const orderedDebts = useMemo(() => {
    const rows = [...debts];
    if (debtStrategy === "snowball") {
      rows.sort((a, b) => a.balance - b.balance);
    } else {
      rows.sort((a, b) => b.apr - a.apr);
    }
    return rows;
  }, [debts, debtStrategy]);

  const totalDebtBalance = debts.reduce((sum, debt) => sum + debt.balance, 0);
  const totalDebtMinPayment = debts.reduce((sum, debt) => sum + debt.minPayment, 0);
  const monthlyInterestBurn = debts.reduce((sum, debt) => sum + (debt.balance * debt.apr) / 100 / 12, 0);

  const monthlySubscriptionBurn = subscriptions.reduce((sum, sub) => {
    return sum + (sub.frequency === "monthly" ? sub.amount : sub.amount / 12);
  }, 0);
  const annualSubscriptionBurn = monthlySubscriptionBurn * 12;

  const billRows = useMemo(() => {
    const now = new Date();
    return bills
      .map((bill) => {
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const monthDays = new Date(currentYear, currentMonth + 1, 0).getDate();
        const normalizedDueDay = Math.min(Math.max(1, bill.dueDay), monthDays);
        let dueDate = new Date(currentYear, currentMonth, normalizedDueDay);
        if (dueDate < now) {
          const nextMonthDays = new Date(currentYear, currentMonth + 2, 0).getDate();
          const nextDueDay = Math.min(Math.max(1, bill.dueDay), nextMonthDays);
          dueDate = new Date(currentYear, currentMonth + 1, nextDueDay);
        }
        const millis = dueDate.getTime() - now.getTime();
        const daysLeft = Math.ceil(millis / (1000 * 60 * 60 * 24));
        return {
          ...bill,
          daysLeft,
          dueDateLabel: dueDate.toLocaleDateString()
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [bills]);

  const totalAssets = cash + investments + retirement + propertyValue;
  const totalLiabilities = creditCardDebt + studentDebt + mortgageDebt + otherDebt;
  const netWorth = totalAssets - totalLiabilities;

  const monthlyNetA = scenarioIncomeA - scenarioExpensesA;
  const monthlyNetB = scenarioIncomeB - scenarioExpensesB;
  const annualDiff = (monthlyNetB - monthlyNetA) * 12;

  const preTipTaxTotal = sharedExpense + (sharedExpense * tipPercent) / 100 + (sharedExpense * taxPercent) / 100;
  const splitPerPerson = splitPeople > 0 ? preTipTaxTotal / splitPeople : preTipTaxTotal;

  useEffect(() => {
    window.localStorage.setItem("tools_no_spend_streak", String(noSpendStreak));
    window.localStorage.setItem("tools_no_spend_last_date", lastNoSpendDate);
  }, [lastNoSpendDate, noSpendStreak]);

  const addDebt = () => {
    setDebts((prev) => [
      ...prev,
      { id: nextDebtId, name: `Debt ${nextDebtId}`, balance: 1000, apr: 10, minPayment: 50 }
    ]);
    setNextDebtId((prev) => prev + 1);
  };

  const updateDebt = (id: number, field: keyof Omit<Debt, "id">, value: string) => {
    setDebts((prev) =>
      prev.map((debt) => {
        if (debt.id !== id) {
          return debt;
        }
        if (field === "name") {
          return { ...debt, [field]: value };
        }
        return { ...debt, [field]: toNumber(value) };
      })
    );
  };

  const deleteDebt = (id: number) => {
    setDebts((prev) => prev.filter((debt) => debt.id !== id));
  };

  const addSubscription = () => {
    if (!subName.trim() || subAmount <= 0) {
      return;
    }
    setSubscriptions((prev) => [
      ...prev,
      { id: nextSubId, name: subName.trim(), amount: subAmount, frequency: subFrequency }
    ]);
    setNextSubId((prev) => prev + 1);
    setSubName("");
    setSubAmount(0);
    setSubFrequency("monthly");
  };

  const deleteSubscription = (id: number) => {
    setSubscriptions((prev) => prev.filter((sub) => sub.id !== id));
  };

  const addBill = () => {
    if (!billName.trim() || billAmount <= 0) {
      return;
    }
    const day = Math.min(Math.max(Math.floor(billDueDay), 1), 31);
    setBills((prev) => [...prev, { id: nextBillId, name: billName.trim(), amount: billAmount, dueDay: day }]);
    setNextBillId((prev) => prev + 1);
    setBillName("");
    setBillAmount(0);
    setBillDueDay(1);
  };

  const deleteBill = (id: number) => {
    setBills((prev) => prev.filter((bill) => bill.id !== id));
  };

  const markNoSpendDay = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (lastNoSpendDate === today) {
      return;
    }
    setNoSpendStreak((prev) => prev + 1);
    setLastNoSpendDate(today);
  };

  const resetNoSpendStreak = () => {
    setNoSpendStreak(0);
    setLastNoSpendDate("");
  };

  return (
    <div className="d-grid gap-3">
      <div className="card">
        <div className="card-body">
          <h5 className="card-title mb-1">Tools: Hyper Utility Mode</h5>
          <p className="text-muted mb-0">
            Quantity-first toolbox for fast planning, projecting, and rough-cut personal finance decisions.
          </p>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-6">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="mb-3">1) 50/30/20 Budget Mixer</h6>
              <div className="row g-2">
                <div className="col-md-6">
                  <label className="form-label">Monthly Income</label>
                  <input
                    className="form-control"
                    type="number"
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(toNumber(e.target.value))}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Needs %</label>
                  <input
                    className="form-control"
                    type="number"
                    value={needsPct}
                    onChange={(e) => setNeedsPct(toNumber(e.target.value))}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Wants %</label>
                  <input
                    className="form-control"
                    type="number"
                    value={wantsPct}
                    onChange={(e) => setWantsPct(toNumber(e.target.value))}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Future %</label>
                  <input
                    className="form-control"
                    type="number"
                    value={futurePct}
                    onChange={(e) => setFuturePct(toNumber(e.target.value))}
                  />
                </div>
              </div>
              <div className="mt-3 small">
                <div>Needs target: {formatCurrency(budgetNeeds)}</div>
                <div>Wants target: {formatCurrency(budgetWants)}</div>
                <div>Future target: {formatCurrency(budgetFuture)}</div>
                <div className={budgetDelta >= 0 ? "text-success" : "text-danger"}>
                  Remaining delta: {formatCurrency(budgetDelta)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="mb-3">2) Emergency Fund Turbo Planner</h6>
              <div className="row g-2">
                <div className="col-md-6">
                  <label className="form-label">Essential Monthly Spend</label>
                  <input
                    className="form-control"
                    type="number"
                    value={emergencyExpenses}
                    onChange={(e) => setEmergencyExpenses(toNumber(e.target.value))}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Target Months</label>
                  <input
                    className="form-control"
                    type="number"
                    value={emergencyMonths}
                    onChange={(e) => setEmergencyMonths(toNumber(e.target.value))}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Current Fund</label>
                  <input
                    className="form-control"
                    type="number"
                    value={currentEmergencyFund}
                    onChange={(e) => setCurrentEmergencyFund(toNumber(e.target.value))}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Monthly Contribution</label>
                  <input
                    className="form-control"
                    type="number"
                    value={monthlyEmergencyContribution}
                    onChange={(e) => setMonthlyEmergencyContribution(toNumber(e.target.value))}
                  />
                </div>
              </div>
              <div className="mt-3 small">
                <div>Target cash buffer: {formatCurrency(emergencyTarget)}</div>
                <div>Gap remaining: {formatCurrency(emergencyGap)}</div>
                <div>
                  Time to goal:{" "}
                  {Number.isFinite(emergencyMonthsToGoal) ? `${emergencyMonthsToGoal} month(s)` : "Set contribution"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="mb-3">3) Savings Goal Cannon</h6>
              <div className="row g-2">
                <div className="col-md-6">
                  <label className="form-label">Current Savings</label>
                  <input
                    className="form-control"
                    type="number"
                    value={currentSavings}
                    onChange={(e) => setCurrentSavings(toNumber(e.target.value))}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Target Goal</label>
                  <input
                    className="form-control"
                    type="number"
                    value={savingsGoal}
                    onChange={(e) => setSavingsGoal(toNumber(e.target.value))}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Monthly Contribution</label>
                  <input
                    className="form-control"
                    type="number"
                    value={monthlySavingsContribution}
                    onChange={(e) => setMonthlySavingsContribution(toNumber(e.target.value))}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">APY %</label>
                  <input
                    className="form-control"
                    type="number"
                    value={savingsApy}
                    onChange={(e) => setSavingsApy(toNumber(e.target.value))}
                  />
                </div>
              </div>
              <div className="mt-3 small">
                <div>
                  Est. time to hit goal:{" "}
                  {savingsProjection.hitGoal ? `${savingsProjection.months} month(s)` : "Not reached in 100 years"}
                </div>
                <div>Projected balance at stop: {formatCurrency(savingsProjection.projectedBalance)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="mb-3">4) Debt Attack Queue</h6>
              <div className="d-flex gap-2 align-items-end mb-3">
                <div>
                  <label className="form-label">Strategy</label>
                  <select
                    className="form-select"
                    value={debtStrategy}
                    onChange={(e) => setDebtStrategy(e.target.value as "snowball" | "avalanche")}
                  >
                    <option value="avalanche">Avalanche (highest APR first)</option>
                    <option value="snowball">Snowball (lowest balance first)</option>
                  </select>
                </div>
                <button className="btn btn-outline-primary" type="button" onClick={addDebt}>
                  Add debt
                </button>
              </div>
              <div className="table-responsive">
                <table className="table table-sm align-middle">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Balance</th>
                      <th>APR %</th>
                      <th>Min Pay</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {debts.map((debt) => (
                      <tr key={debt.id}>
                        <td>
                          <input
                            className="form-control form-control-sm"
                            value={debt.name}
                            onChange={(e) => updateDebt(debt.id, "name", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="form-control form-control-sm"
                            type="number"
                            value={debt.balance}
                            onChange={(e) => updateDebt(debt.id, "balance", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="form-control form-control-sm"
                            type="number"
                            value={debt.apr}
                            onChange={(e) => updateDebt(debt.id, "apr", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="form-control form-control-sm"
                            type="number"
                            value={debt.minPayment}
                            onChange={(e) => updateDebt(debt.id, "minPayment", e.target.value)}
                          />
                        </td>
                        <td>
                          <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => deleteDebt(debt.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="small">
                <div>Total debt: {formatCurrency(totalDebtBalance)}</div>
                <div>Total minimum payments: {formatCurrency(totalDebtMinPayment)}</div>
                <div>Monthly interest burn: {formatCurrency(monthlyInterestBurn)}</div>
                <div className="mt-2">Priority order:</div>
                <ol className="mb-0">
                  {orderedDebts.map((debt) => (
                    <li key={debt.id}>
                      {debt.name} - {formatCurrency(debt.balance)} @ {toTwo(debt.apr)}%
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="mb-3">5) Subscription Sniper</h6>
              <div className="row g-2">
                <div className="col-md-5">
                  <label className="form-label">Name</label>
                  <input className="form-control" value={subName} onChange={(e) => setSubName(e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Amount</label>
                  <input
                    className="form-control"
                    type="number"
                    value={subAmount}
                    onChange={(e) => setSubAmount(toNumber(e.target.value))}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Freq</label>
                  <select
                    className="form-select"
                    value={subFrequency}
                    onChange={(e) => setSubFrequency(e.target.value as "monthly" | "yearly")}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div className="col-md-2 d-grid">
                  <label className="form-label">&nbsp;</label>
                  <button className="btn btn-outline-primary" type="button" onClick={addSubscription}>
                    Add
                  </button>
                </div>
              </div>
              <ul className="list-group list-group-flush mt-3">
                {subscriptions.map((sub) => (
                  <li
                    key={sub.id}
                    className="list-group-item d-flex justify-content-between align-items-center px-0"
                  >
                    <span>
                      {sub.name} ({sub.frequency}) - {formatCurrency(sub.amount)}
                    </span>
                    <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => deleteSubscription(sub.id)}>
                      Kill
                    </button>
                  </li>
                ))}
              </ul>
              <div className="small mt-3">
                <div>Monthly burn equivalent: {formatCurrency(monthlySubscriptionBurn)}</div>
                <div>Annual burn equivalent: {formatCurrency(annualSubscriptionBurn)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="mb-3">6) Bill Countdown Radar</h6>
              <div className="row g-2">
                <div className="col-md-5">
                  <label className="form-label">Bill</label>
                  <input className="form-control" value={billName} onChange={(e) => setBillName(e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Amount</label>
                  <input
                    className="form-control"
                    type="number"
                    value={billAmount}
                    onChange={(e) => setBillAmount(toNumber(e.target.value))}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Due day</label>
                  <input
                    className="form-control"
                    type="number"
                    min={1}
                    max={31}
                    value={billDueDay}
                    onChange={(e) => setBillDueDay(toNumber(e.target.value))}
                  />
                </div>
                <div className="col-md-2 d-grid">
                  <label className="form-label">&nbsp;</label>
                  <button className="btn btn-outline-primary" type="button" onClick={addBill}>
                    Add
                  </button>
                </div>
              </div>
              <ul className="list-group list-group-flush mt-3">
                {billRows.map((bill) => (
                  <li key={bill.id} className="list-group-item d-flex justify-content-between align-items-center px-0">
                    <span>
                      {bill.name}: {formatCurrency(bill.amount)} - due {bill.dueDateLabel} ({bill.daysLeft} day(s))
                    </span>
                    <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => deleteBill(bill.id)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="mb-3">7) Net Worth Snapshot</h6>
              <div className="row g-2">
                <div className="col-md-3">
                  <label className="form-label">Cash</label>
                  <input className="form-control" type="number" value={cash} onChange={(e) => setCash(toNumber(e.target.value))} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Investments</label>
                  <input
                    className="form-control"
                    type="number"
                    value={investments}
                    onChange={(e) => setInvestments(toNumber(e.target.value))}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Retirement</label>
                  <input
                    className="form-control"
                    type="number"
                    value={retirement}
                    onChange={(e) => setRetirement(toNumber(e.target.value))}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Property</label>
                  <input
                    className="form-control"
                    type="number"
                    value={propertyValue}
                    onChange={(e) => setPropertyValue(toNumber(e.target.value))}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Credit Card Debt</label>
                  <input
                    className="form-control"
                    type="number"
                    value={creditCardDebt}
                    onChange={(e) => setCreditCardDebt(toNumber(e.target.value))}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Student Debt</label>
                  <input
                    className="form-control"
                    type="number"
                    value={studentDebt}
                    onChange={(e) => setStudentDebt(toNumber(e.target.value))}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Mortgage Debt</label>
                  <input
                    className="form-control"
                    type="number"
                    value={mortgageDebt}
                    onChange={(e) => setMortgageDebt(toNumber(e.target.value))}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Other Debt</label>
                  <input
                    className="form-control"
                    type="number"
                    value={otherDebt}
                    onChange={(e) => setOtherDebt(toNumber(e.target.value))}
                  />
                </div>
              </div>
              <div className="small mt-3">
                <div>Total assets: {formatCurrency(totalAssets)}</div>
                <div>Total liabilities: {formatCurrency(totalLiabilities)}</div>
                <div className={netWorth >= 0 ? "text-success" : "text-danger"}>Net worth: {formatCurrency(netWorth)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="mb-3">8) What-If Scenario Duel</h6>
              <div className="row g-2">
                <div className="col-md-3">
                  <label className="form-label">Income A</label>
                  <input
                    className="form-control"
                    type="number"
                    value={scenarioIncomeA}
                    onChange={(e) => setScenarioIncomeA(toNumber(e.target.value))}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Expenses A</label>
                  <input
                    className="form-control"
                    type="number"
                    value={scenarioExpensesA}
                    onChange={(e) => setScenarioExpensesA(toNumber(e.target.value))}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Income B</label>
                  <input
                    className="form-control"
                    type="number"
                    value={scenarioIncomeB}
                    onChange={(e) => setScenarioIncomeB(toNumber(e.target.value))}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Expenses B</label>
                  <input
                    className="form-control"
                    type="number"
                    value={scenarioExpensesB}
                    onChange={(e) => setScenarioExpensesB(toNumber(e.target.value))}
                  />
                </div>
              </div>
              <div className="small mt-3">
                <div>Scenario A monthly net: {formatCurrency(monthlyNetA)}</div>
                <div>Scenario B monthly net: {formatCurrency(monthlyNetB)}</div>
                <div className={annualDiff >= 0 ? "text-success" : "text-danger"}>
                  Annual difference (B - A): {formatCurrency(annualDiff)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="mb-3">9) Split Check Blaster</h6>
              <div className="row g-2">
                <div className="col-md-3">
                  <label className="form-label">Base Bill</label>
                  <input
                    className="form-control"
                    type="number"
                    value={sharedExpense}
                    onChange={(e) => setSharedExpense(toNumber(e.target.value))}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Tip %</label>
                  <input
                    className="form-control"
                    type="number"
                    value={tipPercent}
                    onChange={(e) => setTipPercent(toNumber(e.target.value))}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Tax %</label>
                  <input
                    className="form-control"
                    type="number"
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(toNumber(e.target.value))}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">People</label>
                  <input
                    className="form-control"
                    type="number"
                    min={1}
                    value={splitPeople}
                    onChange={(e) => setSplitPeople(Math.max(1, toNumber(e.target.value)))}
                  />
                </div>
              </div>
              <div className="small mt-3">
                <div>Total with tip+tax: {formatCurrency(preTipTaxTotal)}</div>
                <div>Per person: {formatCurrency(splitPerPerson)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="mb-3">10) No-Spend Streak Tracker</h6>
              <div className="d-flex gap-2 flex-wrap">
                <button className="btn btn-success" type="button" onClick={markNoSpendDay}>
                  Mark today as no-spend
                </button>
                <button className="btn btn-outline-danger" type="button" onClick={resetNoSpendStreak}>
                  Reset streak
                </button>
              </div>
              <div className="small mt-3">
                <div>Current streak: {noSpendStreak} day(s)</div>
                <div>Last no-spend day: {lastNoSpendDate || "none yet"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Tag, Txn } from "../types";
import { buildAuthHeaders } from "../../lib/auth";
import { getTxnDateOnly } from "../../utils/transactionUtils";
import { collapseNettingGroups } from "../../utils/nettingUtils";
import TransactionTable from "../shared/TransactionTable";
import { TrendPiePanel } from "../shared/TrendPieChart";
import { Popover, Segmented } from "../shared/ui";
import { buildTrendPieSlices, sliceColors, type TrendPieGrouping } from "./visualizeTrendsUtils";

type Props = { transactions: Txn[]; token: string | null };
type Settings = { targetSpendPct: number; incomeTagId: number | null };
type DrillDown = "spending" | "income" | null;

const SETTINGS_KEY = "funds-up-dashboard-settings";
const EMPTY_TAGS: Tag[] = [];
const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function loadSettings(): Settings {
  try {
    const p = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return {
      targetSpendPct: typeof p.targetSpendPct === "number" ? Math.min(100, Math.max(1, p.targetSpendPct)) : 80,
      incomeTagId: typeof p.incomeTagId === "number" ? p.incomeTagId : null
    };
  } catch { return { targetSpendPct: 80, incomeTagId: null }; }
}

function saveSettings(s: Settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

function parseMonth(key: string) {
  const [y, m] = key.split("-");
  const year = Number(y);
  return { year, monthNum: Number(m) - 1 };
}

function MonthMark({ monthKey, short }: { monthKey: string; short?: boolean }) {
  const { year, monthNum } = parseMonth(monthKey);
  const month = new Date(year, monthNum, 1).toLocaleDateString("en-US", { month: short ? "short" : "long" });
  const showYear = year !== new Date().getFullYear();
  return showYear ? <>{month}<span className="dashboard-month-year">{year}</span></> : <>{month}</>;
}

function HeroNum({ kind, active, onClick, children }: { kind: "spend" | "income"; active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`dashboard-hero-num dashboard-hero-num-btn ${kind}${active ? " active" : ""}`} onClick={onClick} aria-pressed={active}>
      {children}
    </button>
  );
}

function monthKeys(txns: Txn[]) {
  const set = new Set<string>();
  for (const t of txns) {
    const d = getTxnDateOnly(t);
    if (d) set.add(d.slice(0, 7));
  }
  const keys = [...set].sort();
  return (keys.length ? keys : [new Date().toISOString().slice(0, 7)]).reverse();
}

function hasIncomeTag(t: Txn, tagId: number) {
  return t.bucket_1_tag_id === tagId || t.bucket_2_tag_id === tagId;
}

function monthBreakdown(txns: Txn[], month: string, incomeTagId: number | null) {
  const nt = collapseNettingGroups(txns.filter((t) => !t.account_transfer_group && getTxnDateOnly(t).startsWith(month)));
  const incomeTxns: Txn[] = [];
  const spendingTxns: Txn[] = [];
  let income = 0;
  let spending = 0;
  for (const t of nt) {
    const amt = t.amount ?? 0;
    if (amt < 0 && (incomeTagId == null || hasIncomeTag(t, incomeTagId))) {
      income += Math.abs(amt);
      incomeTxns.push(t);
    } else if (amt > 0) {
      spending += amt;
      spendingTxns.push(t);
    }
  }
  const pct = income > 0 ? Math.round((spending / income) * 100) : 0;
  return { income, spending, pct, incomeTxns, spendingTxns };
}

export default function DashboardTool({ transactions, token }: Props) {
  const months = useMemo(() => monthKeys(transactions), [transactions]);
  const current = new Date().toISOString().slice(0, 7);
  const [monthKey, setMonthKey] = useState(current);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsBtn, setSettingsBtn] = useState<HTMLButtonElement | null>(null);
  const [drillDown, setDrillDown] = useState<DrillDown>(null);
  const [pieSliceKey, setPieSliceKey] = useState<string | null>(null);
  const [pieGrouping, setPieGrouping] = useState<TrendPieGrouping>("detected");
  const activeMonth = months.includes(monthKey) ? monthKey : (months.includes(current) ? current : months[0]);
  const activeRef = useRef<HTMLButtonElement>(null);
  const isCurrentMonth = activeMonth === current;

  const tagsQuery = useQuery({
    queryKey: ["tags"], enabled: !!token,
    queryFn: async (): Promise<Tag[]> => {
      const res = await fetch("/api/tags", { headers: buildAuthHeaders(token) });
      if (!res.ok) throw new Error(`Failed to load tags (${res.status})`);
      return (await res.json()) || [];
    }
  });
  const tags = tagsQuery.data ?? EMPTY_TAGS;
  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const incomeTags = useMemo(
    () => tags.filter((t) => t.type === "income_bucket_1" || t.type === "income_bucket_2").sort((a, b) => a.name.localeCompare(b.name)),
    [tags]
  );

  const patchSettings = (patch: Partial<Settings>) => setSettings((prev) => {
    const next = { ...prev, ...patch };
    saveSettings(next);
    return next;
  });

  const { income, spending, pct, incomeTxns, spendingTxns } = useMemo(
    () => monthBreakdown(transactions, activeMonth, settings.incomeTagId),
    [transactions, activeMonth, settings.incomeTagId]
  );
  const targetSpend = income * (settings.targetSpendPct / 100);
  const leftToSpend = Math.max(0, targetSpend - spending);
  const overspentBy = Math.max(0, spending - targetSpend);
  const savedOffTarget = Math.max(0, targetSpend - spending);

  useEffect(() => { activeRef.current?.scrollIntoView({ inline: "nearest", block: "nearest" }); }, [activeMonth]);
  useEffect(() => { setPieSliceKey(null); }, [activeMonth]);
  useEffect(() => { setPieSliceKey(null); }, [drillDown, pieGrouping]);

  let subline: ReactNode = null;
  if (overspentBy > 0) {
    subline = <>You overspent by <span className="dashboard-hero-num spend">{fmt(overspentBy)}</span>.</>;
  } else if (!isCurrentMonth && savedOffTarget > 0) {
    subline = <>You saved <span className="dashboard-hero-num income">{fmt(savedOffTarget)}</span> off your target of {settings.targetSpendPct}%.</>;
  } else if (isCurrentMonth) {
    subline = <>You have <span className={`dashboard-hero-num${leftToSpend > 0 ? " income" : ""}`}>{fmt(leftToSpend)}</span> left to spend before your limit of {settings.targetSpendPct}%.</>;
  }

  const drillTxns = drillDown === "spending" ? spendingTxns : drillDown === "income" ? incomeTxns : [];
  const drillLabel = drillDown === "spending" ? "Spending" : "Income";
  const pieSlices = useMemo(
    () => (drillDown ? buildTrendPieSlices(drillTxns, drillDown, pieGrouping, tagMap) : []),
    [drillTxns, drillDown, pieGrouping, tagMap]
  );
  const pieColors = useMemo(() => sliceColors(pieSlices), [pieSlices]);
  const pieSlice = pieSlices.find((s) => s.key === pieSliceKey) ?? null;
  const tableTxns = pieSlice?.transactions ?? drillTxns;
  const onPieSlice = (sl: { key: string }) => setPieSliceKey((k) => k === sl.key ? null : sl.key);

  return (
    <>
      <div className="dashboard-hero-row">
        <p className="dashboard-hero">
          {income === 0 ? (
            <>
              <span className="dashboard-hero-text">You had no income {isCurrentMonth ? "this month" : <>in <MonthMark monthKey={activeMonth} /></>} and spent </span>
              <HeroNum kind="spend" active={drillDown === "spending"} onClick={() => setDrillDown((d) => d === "spending" ? null : "spending")}>{fmt(spending)}</HeroNum>
              <span className="dashboard-hero-text">.</span>
            </>
          ) : (
            <>
              <span className="dashboard-hero-text">You spent </span>
              <span className="dashboard-hero-num spend">{pct}%</span>
              <span className="dashboard-hero-nowrap">
                <span className="dashboard-hero-text"> (</span>
                <HeroNum kind="spend" active={drillDown === "spending"} onClick={() => setDrillDown((d) => d === "spending" ? null : "spending")}>{fmt(spending)}</HeroNum>
                <span className="dashboard-hero-text">)</span>
              </span>
              <span className="dashboard-hero-text"> of your income </span>
              <span className="dashboard-hero-nowrap">
                <span className="dashboard-hero-text">(</span>
                <HeroNum kind="income" active={drillDown === "income"} onClick={() => setDrillDown((d) => d === "income" ? null : "income")}>{fmt(income)}</HeroNum>
                <span className="dashboard-hero-text">)</span>
              </span>
              <span className="dashboard-hero-text"> {isCurrentMonth ? "this month" : <>in <MonthMark monthKey={activeMonth} /></>}.</span>
            </>
          )}
        </p>
        <div className="dashboard-settings-wrap">
          <button
            ref={setSettingsBtn}
            type="button"
            className="btn ghost btn-icon dashboard-settings-btn"
            aria-label="Dashboard settings"
            onClick={() => setSettingsOpen((o) => !o)}
          >
            ⚙
          </button>
          <Popover anchor={settingsBtn} open={settingsOpen} onClose={() => setSettingsOpen(false)} width={280}>
            <div style={{ padding: "var(--s4)" }} className="col-flex gap-3">
              <div className="field">
                <label htmlFor="dashboard-target-pct">Target spend %</label>
                <input
                  id="dashboard-target-pct"
                  type="number"
                  className="input input-sm"
                  min={1}
                  max={100}
                  step={1}
                  value={settings.targetSpendPct}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) patchSettings({ targetSpendPct: Math.min(100, Math.max(1, Math.round(n))) });
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="dashboard-income-tag">Income to consider</label>
                <select
                  id="dashboard-income-tag"
                  className="select input-sm"
                  value={settings.incomeTagId ?? ""}
                  onChange={(e) => patchSettings({ incomeTagId: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">All income</option>
                  {incomeTags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
          </Popover>
        </div>
      </div>
      {subline && <p className="dashboard-subline">{subline}</p>}
      {drillDown && (
        <div className="mt-3">
          <div className="between mb-3 flex-wrap gap-2">
            <h4>
              {drillLabel} — <MonthMark monthKey={activeMonth} />
              {pieSlice ? <> — {pieSlice.label} <span className="muted small">({fmt(pieSlice.amount)})</span></> : null}
              {!pieSlice && <span className="muted small"> ({fmt(drillDown === "spending" ? spending : income)})</span>}
            </h4>
            <button type="button" className="btn ghost btn-sm" onClick={() => { setDrillDown(null); setPieSliceKey(null); }}>Clear</button>
          </div>
          <div className="dashboard-drill-grid">
            <div className="card card-tight dashboard-drill-pie">
              <div className="row-flex gap-2 mb-3" style={{ flexWrap: "wrap" }}>
                <span className="xs muted fw-semi" style={{ alignSelf: "center" }}>Group by</span>
                <Segmented value={pieGrouping} onChange={setPieGrouping} options={[{ value: "detected", label: "Detected" }, { value: "buckets", label: "Buckets" }, { value: "meta", label: "Meta" }]} />
              </div>
              <TrendPiePanel slices={pieSlices} colors={pieColors} selectedKey={pieSliceKey} onSelect={onPieSlice} />
            </div>
            <div className="card card-tight dashboard-drill-table">
              <TransactionTable transactions={tableTxns} tags={tags} keyPrefix="dashboard" nettingMode />
            </div>
          </div>
        </div>
      )}
      <div className="dashboard-month-toggle" role="group" aria-label="Month">
        {months.map((key) => (
          <button
            key={key}
            ref={activeMonth === key ? activeRef : undefined}
            type="button"
            className={activeMonth === key ? "active" : ""}
            onClick={() => setMonthKey(key)}
          >
            <MonthMark monthKey={key} short />
          </button>
        ))}
      </div>
    </>
  );
}

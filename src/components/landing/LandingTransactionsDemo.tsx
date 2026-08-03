import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ACCOUNT_TRANSFER_TAG_ID, useTransactionFilters } from "../../hooks/useTransactionFilters";
import type { Tag, Txn } from "../types";
import demo from "./landingDemo.json";
import LandingAppliedFiltersBar from "./LandingAppliedFiltersBar";
import LandingFilterSection from "./LandingFilterSection";
import LandingTransactionTable from "./LandingTransactionTable";

const DEMO_QUERIES = ["refund", "payroll", "spotify", "safeway", "airbnb", "home"];
const TRANSFER_TAG: Tag = { id: ACCOUNT_TRANSFER_TAG_ID, name: "account_transfer", type: "meta", user_id: "demo", color: "#0c1730" };

type DemoTxn = Omit<Txn, "datetime" | "authorized_datetime"> & {
  days_ago: number;
  authorized_days_ago?: number | null;
};

const { tags: rawTags, transactions: rawTxns } = demo as { tags: Tag[]; transactions: DemoTxn[] };
const tags = [...rawTags, TRANSFER_TAG];

function daysAgoToIso(daysAgo: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function resolveDemoTxns(rows: DemoTxn[]): Txn[] {
  return rows.map(({ days_ago, authorized_days_ago, ...rest }) => ({
    ...rest,
    datetime: daysAgoToIso(days_ago),
    authorized_datetime: authorized_days_ago == null ? null : daysAgoToIso(authorized_days_ago),
  }));
}

export default function LandingTransactionsDemo() {
  const [auto, setAuto] = useState(true);
  const transactions = useMemo(() => resolveDemoTxns(rawTxns), []);
  const filters = useTransactionFilters(transactions);
  const { state, derived } = filters;
  const { setNameFilter } = filters.actions;

  useEffect(() => {
    if (!auto) return;
    let cancelled = false;
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    (async () => {
      let i = 0;
      while (!cancelled) {
        const word = DEMO_QUERIES[i % DEMO_QUERIES.length];
        for (let n = 1; n <= word.length && !cancelled; n++) {
          setNameFilter(word.slice(0, n));
          await wait(180);
        }
        await wait(2200);
        for (let n = word.length - 1; n >= 0 && !cancelled; n--) {
          setNameFilter(word.slice(0, n));
          await wait(120);
        }
        await wait(800);
        i++;
      }
    })();
    return () => { cancelled = true; };
  }, [auto, setNameFilter]);

  const stopAuto = () => setAuto(false);

  return (
    <>
      <header className="page-header landing-find-header">
        <h1>Track down any transaction</h1>
        <Link to="/auth" className="landing-cta">
          Connect My Bank
          <span className="landing-cta-arrow" aria-hidden>→</span>
        </Link>
      </header>
      <div className="landing-txn-layout">
        <input
          className="input landing-search"
          value={state.nameFilter}
          placeholder="Search"
          readOnly={auto}
          onFocus={stopAuto}
          onChange={(e) => { stopAuto(); setNameFilter(e.target.value); }}
          aria-label="Search transactions"
        />
        <div className="landing-active-filters" onPointerDown={stopAuto}>
          <LandingAppliedFiltersBar filters={filters} />
        </div>
        <div className="landing-txn-filters" onPointerDown={stopAuto}>
          <LandingFilterSection filters={filters} tags={tags} />
        </div>
        <div className="landing-txn-grid">
          <LandingTransactionTable
            transactions={derived.filteredTransactions}
            tags={tags}
            keyPrefix="landing"
            emptyMessage="No matching transactions"
          />
        </div>
      </div>
    </>
  );
}

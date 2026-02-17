import { useMemo, useState } from "react";
import type { AmountMode, RecognizedTransferGroup, TextMode, TransferPair, TransferTxn, Txn } from "./types";
import TransactionTable from "./shared/TransactionTable";
import CheckboxFilter from "./shared/CheckboxFilter";
import DateRangeDropdown from "./shared/DateRangeDropdown";
import AppliedFiltersBar from "./shared/AppliedFiltersBar";
import FilterSection from "./shared/FilterSection";
import LoadingSpinner from "./shared/LoadingSpinner";
import { buildDatePreset, type DatePreset } from "../utils/datePresets";
import { formatTxnAmount, formatTxnDate } from "../utils/transactionUtils";

type TransactionsPanelProps = {
  syncTransactions: () => void;
  syncStatus: string;
  clearAllFilters: () => void;
  applyDatePreset: (preset: string) => void;
  nameMode: TextMode;
  setNameMode: (v: TextMode) => void;
  nameFilter: string;
  setNameFilter: (v: string) => void;
  merchantMode: TextMode;
  setMerchantMode: (v: TextMode) => void;
  merchantFilter: string;
  setMerchantFilter: (v: string) => void;
  amountMode: AmountMode;
  setAmountMode: (v: AmountMode) => void;
  amountFilter: string;
  setAmountFilter: (v: string) => void;
  dateStart: string;
  setDateStart: (v: string) => void;
  dateEnd: string;
  setDateEnd: (v: string) => void;
  selectedBanks: string[];
  setSelectedBanks: (v: string[]) => void;
  bankOptions: Array<[string, string]>;
  selectedAccounts: string[];
  setSelectedAccounts: (v: string[]) => void;
  accountOptions: Array<[string, string]>;
  selectedCategories: string[];
  setSelectedCategories: (v: string[]) => void;
  categoryOptions: string[];
  loadingTxns: boolean;
  filteredTransactions: Txn[];
  previewTransferPairs: (args: {
    startDate?: string;
    endDate?: string;
    includePending?: boolean;
    amountTolerance?: number;
    dayRangeTolerance?: number;
  }) => Promise<{ pairs?: TransferPair[]; ambiguous_pairs?: TransferPair[]; summary?: { ambiguous_pairs?: number } }>;
  applyTransferPairs: (args: {
    pairIds: string[];
    startDate?: string;
    endDate?: string;
    includePending?: boolean;
    amountTolerance?: number;
    dayRangeTolerance?: number;
  }) => Promise<{ summary?: { written_pairs?: number; skipped_existing?: number } }>;
  getRecognizedTransfers: (args: { startDate?: string; endDate?: string }) => Promise<{ groups?: RecognizedTransferGroup[]; count?: number }>;
  unmarkTransferGroups: (groupIds: string[]) => Promise<{ cleared_rows?: number; cleared_groups?: number }>;
  loadTransactions: () => Promise<void>;
};

export default function TransactionsPanel(props: TransactionsPanelProps) {
  const {
    syncTransactions, syncStatus, clearAllFilters, applyDatePreset,
    nameMode, setNameMode, nameFilter, setNameFilter,
    merchantMode, setMerchantMode, merchantFilter, setMerchantFilter,
    amountMode, setAmountMode, amountFilter, setAmountFilter,
    dateStart, setDateStart, dateEnd, setDateEnd,
    selectedBanks, setSelectedBanks, bankOptions,
    selectedAccounts, setSelectedAccounts, accountOptions,
    selectedCategories, setSelectedCategories, categoryOptions,
    loadingTxns, filteredTransactions,
    previewTransferPairs, applyTransferPairs, getRecognizedTransfers, unmarkTransferGroups, loadTransactions
  } = props;
  const [transferView, setTransferView] = useState<"all" | "potential" | "recognized">("all");
  const [showFindControls, setShowFindControls] = useState(false);
  const [transferAmountTolerance, setTransferAmountTolerance] = useState("0");
  const [transferDayTolerance, setTransferDayTolerance] = useState("3");
  const initialLast30 = buildDatePreset("last30");
  const [transferDateStart, setTransferDateStart] = useState(initialLast30.start);
  const [transferDateEnd, setTransferDateEnd] = useState(initialLast30.end);
  const [transferDateMode, setTransferDateMode] = useState<"last30" | "all" | "custom">("last30");
  const [findingTransfers, setFindingTransfers] = useState(false);
  const [applyingTransfers, setApplyingTransfers] = useState(false);
  const [loadingRecognized, setLoadingRecognized] = useState(false);
  const [unmarkingTransfers, setUnmarkingTransfers] = useState(false);
  const [transferStatus, setTransferStatus] = useState("");
  const [potentialTransferPairs, setPotentialTransferPairs] = useState<TransferPair[]>([]);
  const [ambiguousTransferPairs, setAmbiguousTransferPairs] = useState<TransferPair[]>([]);
  const [selectedTransferPairIds, setSelectedTransferPairIds] = useState<string[]>([]);
  const [recognizedTransferGroups, setRecognizedTransferGroups] = useState<RecognizedTransferGroup[]>([]);
  const [selectedRecognizedGroupIds, setSelectedRecognizedGroupIds] = useState<string[]>([]);
  const [recognizedAmbiguousCount, setRecognizedAmbiguousCount] = useState(0);

  const PRESETS: { value: DatePreset; label: string }[] = [
    { value: "all", label: "All time" },
    { value: "last7", label: "Last 7 days" },
    { value: "last30", label: "Last 30 days" },
    { value: "last365", label: "Last 365 days" },
    { value: "lastMonth", label: "Last month" },
    { value: "lastYear", label: "Last year" }
  ];

  const matchPreset = (s: string, e: string): DatePreset | null => {
    for (const { value } of PRESETS) {
      const { start, end } = buildDatePreset(value);
      if (start === s && end === e) return value;
    }
    return null;
  };

  const nameSummary = nameFilter.trim() ? `${nameMode === "not" ? "not" : "contains"} "${nameFilter}"` : "any";
  const merchantSummary = merchantMode === "null" ? "is null" : merchantFilter.trim() ? `${merchantMode === "not" ? "not" : "contains"} "${merchantFilter}"` : "any";
  const activePreset = matchPreset(dateStart, dateEnd);
  const dateSummary = activePreset ? PRESETS.find(p => p.value === activePreset)!.label : (dateStart || dateEnd) ? (dateStart && dateEnd ? `${dateStart} – ${dateEnd}` : dateStart ? `From ${dateStart}` : `Until ${dateEnd}`) : "All time";
  const amountSummary = amountMode && amountFilter.trim() ? `${amountMode === "gt" ? ">" : "<"} ${amountFilter}` : "any";
  const banksSummary = selectedBanks.length > 0 ? `${selectedBanks.length} selected` : "any";
  const accountsSummary = selectedAccounts.length > 0 ? `${selectedAccounts.length} selected` : "any";
  const categoriesSummary = selectedCategories.length > 0 ? `${selectedCategories.length} selected` : "any";

  const filterChips = [
    nameFilter.trim() && { id: "name", label: `Name ${nameMode === "not" ? "≠" : "∋"} "${nameFilter}"`, onClear: () => { setNameFilter(""); setNameMode("contains"); } },
    merchantMode === "null" && { id: "merchant-null", label: "Merchant is null", onClear: () => setMerchantMode("contains") },
    merchantFilter.trim() && merchantMode !== "null" && { id: "merchant", label: `Merchant ${merchantMode === "not" ? "≠" : "∋"} "${merchantFilter}"`, onClear: () => { setMerchantFilter(""); setMerchantMode("contains"); } },
    amountMode && amountFilter.trim() && { id: "amount", label: `Amount ${amountMode === "gt" ? ">" : "<"} ${amountFilter}`, onClear: () => { setAmountMode(""); setAmountFilter(""); } },
    (dateStart || dateEnd) && { id: "date", label: dateStart && dateEnd ? `${dateStart} – ${dateEnd}` : dateStart ? `From ${dateStart}` : `Until ${dateEnd}`, onClear: () => { setDateStart(""); setDateEnd(""); } },
    selectedBanks.length > 0 && { id: "banks", label: `Banks: ${selectedBanks.length}`, onClear: () => setSelectedBanks([]) },
    selectedAccounts.length > 0 && { id: "accounts", label: `Accounts: ${selectedAccounts.length}`, onClear: () => setSelectedAccounts([]) },
    selectedCategories.length > 0 && { id: "categories", label: `Categories: ${selectedCategories.length}`, onClear: () => setSelectedCategories([]) }
  ].filter(Boolean) as { id: string; label: string; onClear: () => void }[];

  const parsedAmountTolerance = Math.max(0, Number.isFinite(Number(transferAmountTolerance)) ? Number(transferAmountTolerance) : 0);
  const parsedDayTolerance = Math.max(0, Number.isFinite(Number(transferDayTolerance)) ? Math.floor(Number(transferDayTolerance)) : 3);
  const transferSearchStart = transferDateMode === "all" ? undefined : transferDateStart || undefined;
  const transferSearchEnd = transferDateMode === "all" ? undefined : transferDateEnd || undefined;
  const toTxn = (t: TransferTxn): Txn => ({
    transaction_id: t.id,
    amount: t.amount,
    datetime: t.datetime || null,
    authorized_datetime: t.authorized_datetime || null,
    name: t.name || null,
    merchant_name: t.merchant_name || null,
    iso_currency_code: t.iso_currency_code || null,
    account_id: t.account_id,
    account_name: t.account_name || null,
    account_official_name: t.account_official_name || null
  });

  const potentialSections = useMemo(() => {
    const byGap = new Map<number, TransferPair[]>();
    for (const pair of potentialTransferPairs) {
      byGap.set(pair.dayGap, [...(byGap.get(pair.dayGap) || []), pair]);
    }
    return [...byGap.entries()].sort((a, b) => a[0] - b[0]);
  }, [potentialTransferPairs]);

  const ambiguousSections = useMemo(() => {
    const byGap = new Map<number, TransferPair[]>();
    for (const pair of ambiguousTransferPairs) {
      byGap.set(pair.dayGap, [...(byGap.get(pair.dayGap) || []), pair]);
    }
    return [...byGap.entries()].sort((a, b) => a[0] - b[0]);
  }, [ambiguousTransferPairs]);

  const toggleTransferPair = (pairId: string, checked: boolean) => {
    setSelectedTransferPairIds((prev) => checked ? [...prev, pairId] : prev.filter((id) => id !== pairId));
  };
  const toggleRecognizedGroup = (groupId: string, checked: boolean) => {
    setSelectedRecognizedGroupIds((prev) => checked ? [...prev, groupId] : prev.filter((id) => id !== groupId));
  };

  const handleFindTransfers = async () => {
    setFindingTransfers(true);
    setTransferView("potential");
    setTransferStatus("");
    try {
      const result = await previewTransferPairs({
        startDate: transferSearchStart,
        endDate: transferSearchEnd,
        amountTolerance: parsedAmountTolerance,
        dayRangeTolerance: parsedDayTolerance
      });
      const pairs = [...(result.pairs || [])].sort((a, b) => a.dayGap - b.dayGap || a.pairId.localeCompare(b.pairId));
      const ambiguous = [...(result.ambiguous_pairs || [])].sort((a, b) => a.dayGap - b.dayGap || a.pairId.localeCompare(b.pairId));
      setPotentialTransferPairs(pairs);
      setAmbiguousTransferPairs(ambiguous);
      setSelectedTransferPairIds([]);
      setTransferStatus(`${pairs.length} potential transfer pair${pairs.length === 1 ? "" : "s"} found${ambiguous.length ? `, ${ambiguous.length} ambiguous` : ""}.`);
    } catch {
      setPotentialTransferPairs([]);
      setAmbiguousTransferPairs([]);
      setSelectedTransferPairIds([]);
      setTransferStatus("Unable to find transfer pairs.");
    } finally {
      setFindingTransfers(false);
    }
  };

  const handleRecognizeSelected = async () => {
    if (!selectedTransferPairIds.length) return;
    setApplyingTransfers(true);
    setTransferStatus("");
    try {
      const result = await applyTransferPairs({
        pairIds: selectedTransferPairIds,
        startDate: transferSearchStart,
        endDate: transferSearchEnd,
        amountTolerance: parsedAmountTolerance,
        dayRangeTolerance: parsedDayTolerance
      });
      const written = result.summary?.written_pairs || 0;
      const skipped = result.summary?.skipped_existing || 0;
      setPotentialTransferPairs((prev) => prev.filter((p) => !selectedTransferPairIds.includes(p.pairId)));
      setSelectedTransferPairIds([]);
      setTransferStatus(`Recognized ${written} transfer pair${written === 1 ? "" : "s"}${skipped ? `, skipped ${skipped}` : ""}.`);
      await loadTransactions();
    } catch {
      setTransferStatus("Unable to apply selected transfer pairs.");
    } finally {
      setApplyingTransfers(false);
    }
  };

  const handleShowRecognized = async () => {
    setTransferView("recognized");
    setLoadingRecognized(true);
    setTransferStatus("");
    try {
      const result = await getRecognizedTransfers({});
      const groups = result.groups || [];
      const ambiguousCount = groups.filter((g) => {
        const outflows = g.rows.filter((r) => r.amount > 0).length;
        const inflows = g.rows.filter((r) => r.amount < 0).length;
        return g.rows.length !== 2 || outflows !== 1 || inflows !== 1;
      }).length;
      setRecognizedTransferGroups(groups);
      setRecognizedAmbiguousCount(ambiguousCount);
      setSelectedRecognizedGroupIds([]);
      setTransferStatus(`${groups.length} recognized transfer group${groups.length === 1 ? "" : "s"} found.`);
    } catch (e: any) {
      setRecognizedTransferGroups([]);
      setRecognizedAmbiguousCount(0);
      setSelectedRecognizedGroupIds([]);
      setTransferStatus(e?.message || "Unable to load recognized transfers.");
    } finally {
      setLoadingRecognized(false);
    }
  };

  const handleUnmarkSelected = async () => {
    if (!selectedRecognizedGroupIds.length) return;
    setUnmarkingTransfers(true);
    setTransferStatus("");
    try {
      const result = await unmarkTransferGroups(selectedRecognizedGroupIds);
      setRecognizedTransferGroups((prev) => prev.filter((g) => !selectedRecognizedGroupIds.includes(g.groupId)));
      setSelectedRecognizedGroupIds([]);
      setTransferStatus(`Unmarked ${result.cleared_groups || 0} transfer group${(result.cleared_groups || 0) === 1 ? "" : "s"}.`);
      await loadTransactions();
    } catch {
      setTransferStatus("Unable to unmark selected transfer groups.");
    } finally {
      setUnmarkingTransfers(false);
    }
  };

  const resetToAllTransactions = () => {
    setTransferView("all");
    setTransferStatus("");
    setSelectedTransferPairIds([]);
    setSelectedRecognizedGroupIds([]);
    setRecognizedAmbiguousCount(0);
  };

  return (
    <div className="card">
      <div className="card-body">
        <h5 className="card-title">Transactions</h5>
        <div className="row g-2 mb-3">
          <div className="col-md-3"><button className="btn btn-outline-primary w-100" onClick={syncTransactions}>Fetch Transactions</button></div>
          <div className="col-md-9"><div className="small text-muted">{syncStatus}</div></div>
        </div>
        <div className="row g-3">
          <div className="col-md-4 col-lg-3">
            <div className="border rounded p-3" style={{ maxHeight: "calc(100vh - 220px)", overflowY: "auto" }}>
              <h6 className="mb-3 fs-5">Filters</h6>
              
              <FilterSection label="Name" summary={nameSummary}>
                <div className="btn-group btn-group-sm w-100 mb-2">
                  <button className={`btn btn-outline-secondary ${nameMode === "contains" ? "active" : ""}`} onClick={() => setNameMode("contains")}>Contains</button>
                  <button className={`btn btn-outline-secondary ${nameMode === "not" ? "active" : ""}`} onClick={() => setNameMode("not")}>Not</button>
                </div>
                <input className="form-control form-control-sm" value={nameFilter} onChange={e => setNameFilter(e.target.value)} placeholder="Search name" />
              </FilterSection>

              <FilterSection label="Merchant" summary={merchantSummary}>
                <div className="btn-group btn-group-sm w-100 mb-2">
                  <button className={`btn btn-outline-secondary ${merchantMode === "contains" ? "active" : ""}`} onClick={() => setMerchantMode("contains")}>Contains</button>
                  <button className={`btn btn-outline-secondary ${merchantMode === "not" ? "active" : ""}`} onClick={() => setMerchantMode("not")}>Not</button>
                  <button className={`btn btn-outline-secondary ${merchantMode === "null" ? "active" : ""}`} onClick={() => setMerchantMode("null")}>Is null</button>
                </div>
                <input className="form-control form-control-sm" value={merchantFilter} onChange={e => setMerchantFilter(e.target.value)} disabled={merchantMode === "null"} placeholder="Search merchant" />
              </FilterSection>

              <FilterSection label="Date range" summary={dateSummary}>
                <DateRangeDropdown dateStart={dateStart} dateEnd={dateEnd} onPreset={applyDatePreset} onRangeChange={(s, e) => { setDateStart(s); setDateEnd(e); }} />
              </FilterSection>

              <FilterSection label="Amount" summary={amountSummary}>
                <div className="btn-group btn-group-sm w-100 mb-2">
                  <button className={`btn btn-outline-secondary ${amountMode === "" ? "active" : ""}`} onClick={() => setAmountMode("")}>Any</button>
                  <button className={`btn btn-outline-secondary ${amountMode === "gt" ? "active" : ""}`} onClick={() => setAmountMode("gt")}>&gt;</button>
                  <button className={`btn btn-outline-secondary ${amountMode === "lt" ? "active" : ""}`} onClick={() => setAmountMode("lt")}>&lt;</button>
                </div>
                <input className="form-control form-control-sm" type="number" step="0.01" value={amountFilter} onChange={e => setAmountFilter(e.target.value)} placeholder="Amount" />
                <div className="btn-group btn-group-sm w-100 mt-2">
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => { setAmountMode("gt"); setAmountFilter("0"); }}>Spending</button>
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => { setAmountMode("lt"); setAmountFilter("0"); }}>Income</button>
                </div>
              </FilterSection>

              <FilterSection label="Banks" summary={banksSummary}>
                <CheckboxFilter options={bankOptions} selected={selectedBanks} onChange={setSelectedBanks} />
              </FilterSection>

              <FilterSection label="Accounts" summary={accountsSummary}>
                <CheckboxFilter options={accountOptions} selected={selectedAccounts} onChange={setSelectedAccounts} />
              </FilterSection>

              <FilterSection label="Categories" summary={categoriesSummary}>
                <CheckboxFilter options={categoryOptions} selected={selectedCategories} onChange={setSelectedCategories} />
              </FilterSection>

              <button className="btn btn-outline-secondary btn-sm w-100 mt-2" onClick={clearAllFilters}>Clear all filters</button>
            </div>
            <div className="border rounded p-3 mt-3">
              <h6 className="mb-3">Account Transfers</h6>
              <div className="d-grid gap-2 mb-2">
                <button className="btn btn-outline-primary btn-sm" onClick={() => setShowFindControls((v) => !v)}>Find Transfers</button>
                <button className="btn btn-outline-primary btn-sm" onClick={handleShowRecognized} disabled={loadingRecognized}>Show Existing</button>
              </div>
              {showFindControls && (
                <>
                  <div className="small fw-semibold mb-1">Tolerances</div>
                  <div className="row g-1 mb-2">
                    <div className="col-6">
                      <label className="form-label small mb-1">$</label>
                      <input className="form-control form-control-sm" type="number" min="0" step="0.01" value={transferAmountTolerance} onChange={(e) => setTransferAmountTolerance(e.target.value)} />
                    </div>
                    <div className="col-6">
                      <label className="form-label small mb-1">Days</label>
                      <input className="form-control form-control-sm" type="number" min="0" step="1" value={transferDayTolerance} onChange={(e) => setTransferDayTolerance(e.target.value)} />
                    </div>
                  </div>
                  <div className="small fw-semibold mb-1">Date range (optional)</div>
                  <div className="btn-group btn-group-sm w-100 mb-2">
                    <button className={`btn btn-outline-secondary ${transferDateMode === "last30" ? "active" : ""}`} onClick={() => { const d = buildDatePreset("last30"); setTransferDateStart(d.start); setTransferDateEnd(d.end); setTransferDateMode("last30"); }}>Last 30 days</button>
                    <button className={`btn btn-outline-secondary ${transferDateMode === "all" ? "active" : ""}`} onClick={() => { setTransferDateStart(""); setTransferDateEnd(""); setTransferDateMode("all"); }}>All time</button>
                  </div>
                  <div className="row g-1 mb-2">
                    <div className="col-6"><input type="date" className="form-control form-control-sm" value={transferDateStart} onChange={(e) => { setTransferDateStart(e.target.value); setTransferDateMode("custom"); }} /></div>
                    <div className="col-6"><input type="date" className="form-control form-control-sm" value={transferDateEnd} onChange={(e) => { setTransferDateEnd(e.target.value); setTransferDateMode("custom"); }} /></div>
                  </div>
                  <button className="btn btn-primary btn-sm w-100" onClick={handleFindTransfers} disabled={findingTransfers}>{findingTransfers ? "Finding..." : "Find"}</button>
                </>
              )}
              {transferStatus && <div className="small text-muted mt-2">{transferStatus}</div>}
            </div>
          </div>
          <div className="col-md-8 col-lg-9">
            <AppliedFiltersBar chips={filterChips} onClearAll={clearAllFilters} />
            {loadingTxns ? (
              <LoadingSpinner message="Loading transactions..." />
            ) : transferView === "potential" ? (
              <div>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="mb-0">Potential Account Transfers</h6>
                  <div className="d-flex gap-2">
                    <button className="btn btn-outline-secondary btn-sm" onClick={resetToAllTransactions}>Back to all transactions</button>
                    <button className="btn btn-success btn-sm" onClick={handleRecognizeSelected} disabled={!selectedTransferPairIds.length || applyingTransfers}>{applyingTransfers ? "Recognizing..." : "Recognize Selected"}</button>
                  </div>
                </div>
                {!!potentialTransferPairs.length && (
                  <div className="d-flex gap-2 mb-2">
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedTransferPairIds(potentialTransferPairs.map((p) => p.pairId))}>Select all</button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedTransferPairIds([])}>Select none</button>
                  </div>
                )}
                {!potentialTransferPairs.length ? (
                  <div className="text-muted">No potential account transfers found.</div>
                ) : (
                  potentialSections.map(([dayGap, pairs]) => (
                    <div key={`gap-${dayGap}`} className="mb-3">
                      <div className="fw-semibold mb-2">Within {dayGap} day{dayGap === 1 ? "" : "s"}</div>
                      {pairs.map((pair) => {
                        const outflowTxn = toTxn(pair.outflow);
                        const inflowTxn = toTxn(pair.inflow);
                        return (
                          <div className="border rounded p-2 mb-2" key={pair.pairId}>
                            <div className="form-check mb-2">
                              <input
                                id={`pair-${pair.pairId}`}
                                className="form-check-input"
                                type="checkbox"
                                checked={selectedTransferPairIds.includes(pair.pairId)}
                                onChange={(e) => toggleTransferPair(pair.pairId, e.target.checked)}
                              />
                              <label className="form-check-label fw-semibold" htmlFor={`pair-${pair.pairId}`}>
                                {formatTxnAmount({ amount: pair.amount, iso_currency_code: pair.outflow.iso_currency_code })}
                              </label>
                            </div>
                            <div className="row g-2 small">
                              <div className="col-md-6">
                                <div className="text-muted">Outflow</div>
                                <div>{formatTxnDate(outflowTxn)}</div>
                                <div>{(pair.outflow.name || "").trim() || "(No name)"}</div>
                                <div>{pair.outflow.account_name || pair.outflow.account_official_name || pair.outflow.account_id}</div>
                              </div>
                              <div className="col-md-6">
                                <div className="text-muted">Inflow</div>
                                <div>{formatTxnDate(inflowTxn)}</div>
                                <div>{(pair.inflow.name || "").trim() || "(No name)"}</div>
                                <div>{pair.inflow.account_name || pair.inflow.account_official_name || pair.inflow.account_id}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
                {!!ambiguousTransferPairs.length && (
                  <div className="mt-4">
                    <h6 className="text-danger mb-2">Ambiguous Transfers (Not Selectable)</h6>
                    {ambiguousSections.map(([dayGap, pairs]) => (
                      <div key={`ambiguous-gap-${dayGap}`} className="mb-3">
                        <div className="fw-semibold mb-2">Within {dayGap} day{dayGap === 1 ? "" : "s"}</div>
                        {pairs.map((pair) => {
                          const outflowTxn = toTxn(pair.outflow);
                          const inflowTxn = toTxn(pair.inflow);
                          return (
                            <div className="border rounded p-2 mb-2 bg-light" key={`ambiguous-${pair.pairId}`}>
                              <div className="form-check mb-2">
                                <input className="form-check-input" type="checkbox" checked={false} disabled />
                                <label className="form-check-label fw-semibold text-muted">
                                  {formatTxnAmount({ amount: pair.amount, iso_currency_code: pair.outflow.iso_currency_code })} (ambiguous)
                                </label>
                              </div>
                              <div className="row g-2 small">
                                <div className="col-md-6">
                                  <div className="text-muted">Outflow</div>
                                  <div>{formatTxnDate(outflowTxn)}</div>
                                  <div>{(pair.outflow.name || "").trim() || "(No name)"}</div>
                                </div>
                                <div className="col-md-6">
                                  <div className="text-muted">Inflow</div>
                                  <div>{formatTxnDate(inflowTxn)}</div>
                                  <div>{(pair.inflow.name || "").trim() || "(No name)"}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : transferView === "recognized" ? (
              <div>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="mb-0">Recognized Account Transfers</h6>
                  <div className="d-flex gap-2">
                    <button className="btn btn-outline-secondary btn-sm" onClick={resetToAllTransactions}>Back to all transactions</button>
                    <button className="btn btn-outline-danger btn-sm" onClick={handleUnmarkSelected} disabled={!selectedRecognizedGroupIds.length || unmarkingTransfers}>
                      {unmarkingTransfers ? "Unmarking..." : "Unmark Selected"}
                    </button>
                  </div>
                </div>
                <div className="alert alert-warning py-2 mb-2 small">
                  Ambiguous transfers found: {recognizedAmbiguousCount}
                </div>
                {loadingRecognized ? (
                  <LoadingSpinner message="Loading recognized transfers..." />
                ) : !recognizedTransferGroups.length ? (
                  <div className="text-muted">No recognized transfer groups found.</div>
                ) : (
                  <>
                    {recognizedTransferGroups.filter((group) => {
                      const outflows = group.rows.filter((r) => r.amount > 0).length;
                      const inflows = group.rows.filter((r) => r.amount < 0).length;
                      return group.rows.length === 2 && outflows === 1 && inflows === 1;
                    }).map((group) => {
                      const outflow = group.rows.find((r) => r.amount > 0)!;
                      const inflow = group.rows.find((r) => r.amount < 0)!;
                      const outflowTxn = toTxn(outflow);
                      const inflowTxn = toTxn(inflow);
                      return (
                        <div className="border rounded p-2 mb-2" key={group.groupId}>
                          <div className="form-check mb-2">
                            <input id={`group-${group.groupId}`} className="form-check-input" type="checkbox" checked={selectedRecognizedGroupIds.includes(group.groupId)} onChange={(e) => toggleRecognizedGroup(group.groupId, e.target.checked)} />
                            <label className="form-check-label fw-semibold" htmlFor={`group-${group.groupId}`}>
                              {formatTxnAmount({ amount: Math.abs(outflow.amount), iso_currency_code: outflow.iso_currency_code })}
                            </label>
                          </div>
                          <div className="row g-2 small">
                            <div className="col-md-6">
                              <div className="text-muted">Outflow</div>
                              <div>{formatTxnDate(outflowTxn)}</div>
                              <div>{(outflow.name || "").trim() || "(No name)"}</div>
                              <div>{outflow.account_name || outflow.account_official_name || outflow.account_id}</div>
                            </div>
                            <div className="col-md-6">
                              <div className="text-muted">Inflow</div>
                              <div>{formatTxnDate(inflowTxn)}</div>
                              <div>{(inflow.name || "").trim() || "(No name)"}</div>
                              <div>{inflow.account_name || inflow.account_official_name || inflow.account_id}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {recognizedTransferGroups.filter((group) => {
                      const outflows = group.rows.filter((r) => r.amount > 0).length;
                      const inflows = group.rows.filter((r) => r.amount < 0).length;
                      return group.rows.length !== 2 || outflows !== 1 || inflows !== 1;
                    }).map((group) => (
                      <div className="border rounded p-2 mb-2 bg-light" key={`amb-rec-${group.groupId}`}>
                        <div className="form-check mb-2">
                          <input id={`group-${group.groupId}`} className="form-check-input" type="checkbox" checked={selectedRecognizedGroupIds.includes(group.groupId)} onChange={(e) => toggleRecognizedGroup(group.groupId, e.target.checked)} />
                          <label className="form-check-label fw-semibold text-muted" htmlFor={`group-${group.groupId}`}>Ambiguous recognized group</label>
                        </div>
                        {group.rows.map((row) => {
                          const txn = toTxn(row);
                          return (
                            <div className="small mb-1" key={row.id}>
                              {formatTxnDate(txn)} - {(row.name || "").trim() || "(No name)"} - {formatTxnAmount({ amount: row.amount, iso_currency_code: row.iso_currency_code })} - {row.account_name || row.account_official_name || row.account_id}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <TransactionTable transactions={filteredTransactions} emptyMessage="No transactions match" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

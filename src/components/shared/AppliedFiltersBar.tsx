import { Fragment } from "react";
import type { UseTransactionFiltersReturn } from "../../hooks/useTransactionFilters";

type Chip = { id: string; label: string; onClear: () => void };

export default function AppliedFiltersBar({ filters }: { filters: UseTransactionFiltersReturn }) {
  const { state, actions } = filters;
  const chips: Chip[] = [
    state.nameFilter.trim() && { id: "name", label: `Name ${state.nameMode === "not" ? "≠" : "∋"} "${state.nameFilter}"`, onClear: () => { actions.setNameFilter(""); actions.setNameMode("contains"); } },
    state.merchantMode === "null" && { id: "merchant-null", label: "Merchant unspecified", onClear: () => actions.setMerchantMode("contains") },
    state.merchantFilter.trim() && state.merchantMode !== "null" && { id: "merchant", label: `Merchant ${state.merchantMode === "not" ? "≠" : "∋"} "${state.merchantFilter}"`, onClear: () => { actions.setMerchantFilter(""); actions.setMerchantMode("contains"); } },
    (state.amountMin.trim() || state.amountMax.trim()) && { id: "amount", label: state.amountMin && state.amountMax ? `Amount ${state.amountMin}–${state.amountMax}` : state.amountMin ? `≥ ${state.amountMin}` : `≤ ${state.amountMax}`, onClear: () => { actions.setAmountMin(""); actions.setAmountMax(""); } },
    (state.dateStart || state.dateEnd) && { id: "date", label: `${state.dateStart || "?"} → ${state.dateEnd || "?"}`, onClear: () => { actions.setDateStart(""); actions.setDateEnd(""); } },
    state.selectedBanks.length > 0 && { id: "banks", label: `Banks: ${state.selectedBanks.length}`, onClear: () => actions.setSelectedBanks([]) },
    state.selectedAccounts.length > 0 && { id: "accounts", label: `Accounts: ${state.selectedAccounts.length}`, onClear: () => actions.setSelectedAccounts([]) },
    state.selectedTagIds.length > 0 && { id: "tags", label: `Tags: ${state.selectedTagIds.length}`, onClear: () => actions.setSelectedTagIds([]) },
    state.selectedCategories.length > 0 && { id: "categories", label: `Detected: ${state.selectedCategories.length}`, onClear: () => actions.setSelectedCategories([]) },
    state.tagStateFilter === "untagged" && { id: "untagged", label: "Untagged only", onClear: () => actions.setTagStateFilter("all") }
  ].filter(Boolean) as Chip[];

  if (!chips.length) return null;
  const sep = state.filterOperator === "or" ? "OR" : "AND";
  return (
    <div className="row-flex flex-wrap gap-2 mb-3">
      <span className="xs muted">Filters:</span>
      {chips.map(({ id, label, onClear }, i) => (
        <Fragment key={id}>
          {i > 0 && <span className="xs muted fw-semi">{sep}</span>}
          <span className="chip chip-soft">
            {label}
            <button type="button" aria-label="Remove" onClick={onClear} style={{ background: "transparent", border: 0, color: "inherit", marginLeft: 4, cursor: "pointer", fontSize: "0.9rem" }}>✕</button>
          </span>
        </Fragment>
      ))}
      <button className="btn ghost btn-sm" onClick={actions.clearAllFilters}>Clear all</button>
    </div>
  );
}

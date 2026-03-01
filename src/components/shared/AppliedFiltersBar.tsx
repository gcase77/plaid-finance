import { Fragment } from "react";
import type { UseTransactionFiltersReturn } from "../../hooks/useTransactionFilters";

type FilterChip = { id: string; label: string; onClear: () => void };

type AppliedFiltersBarProps = {
  filters: UseTransactionFiltersReturn;
};

export default function AppliedFiltersBar({ filters }: AppliedFiltersBarProps) {
  const { state, actions } = filters;

  const chips: FilterChip[] = [
    state.nameFilter.trim() && {
      id: "name",
      label: `Name ${state.nameMode === "not" ? "≠" : "∋"} "${state.nameFilter}"`,
      onClear: () => {
        actions.setNameFilter("");
        actions.setNameMode("contains");
      }
    },
    state.merchantMode === "null" && {
      id: "merchant-null",
      label: "Merchant unspecified",
      onClear: () => actions.setMerchantMode("contains")
    },
    state.merchantFilter.trim() && state.merchantMode !== "null" && {
      id: "merchant",
      label: `Merchant ${state.merchantMode === "not" ? "≠" : "∋"} "${state.merchantFilter}"`,
      onClear: () => {
        actions.setMerchantFilter("");
        actions.setMerchantMode("contains");
      }
    },
    state.amountMode && state.amountFilter.trim() && {
      id: "amount",
      label: `Amount ${state.amountMode === "gt" ? ">" : "<"} ${state.amountFilter}`,
      onClear: () => {
        actions.setAmountMode("");
        actions.setAmountFilter("");
      }
    },
    (state.dateStart || state.dateEnd) && {
      id: "date",
      label: `${state.dateStart || "?"} → ${state.dateEnd || "?"}`,
      onClear: () => {
        actions.setDateStart("");
        actions.setDateEnd("");
      }
    },
    state.selectedBanks.length > 0 && {
      id: "banks",
      label: `Banks: ${state.selectedBanks.length}`,
      onClear: () => actions.setSelectedBanks([])
    },
    state.selectedAccounts.length > 0 && {
      id: "accounts",
      label: `Accounts: ${state.selectedAccounts.length}`,
      onClear: () => actions.setSelectedAccounts([])
    },
    state.selectedCategories.length > 0 && {
      id: "categories",
      label: `Detected: ${state.selectedCategories.length}`,
      onClear: () => actions.setSelectedCategories([])
    }
  ].filter(Boolean) as FilterChip[];

  if (!chips.length) return null;
  const sep = state.filterOperator === "or" ? "||" : "&";
  return (
    <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
      <span className="small text-muted">Filters:</span>
      {chips.map(({ id, label, onClear }, i) => (
        <Fragment key={id}>
          {i > 0 && <span className="small text-muted fw-semibold">{sep}</span>}
          <span className="badge bg-secondary d-inline-flex align-items-center gap-1">
            {label}
            <button type="button" className="border-0 bg-transparent text-white p-0 ms-1" style={{ fontSize: "1rem", lineHeight: 1 }} aria-label="Remove" onClick={onClear}>×</button>
          </span>
        </Fragment>
      ))}
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={actions.clearAllFilters}>Clear all</button>
    </div>
  );
}

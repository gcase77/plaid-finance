import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTransactionFilters } from "../../hooks/useTransactionFilters";
import { buildAuthHeaders } from "../../lib/auth";
import { getDefaultTagColor, getDisplayTagColor, getTextColorForBackground, TAG_COLOR_PALETTE } from "../../utils/transactionUtils";
import type { Tag, TagType, Txn } from "../types";
import LoadingSpinner from "../shared/LoadingSpinner";
import AppliedFiltersBar from "../shared/AppliedFiltersBar";
import TransactionsFilterSection from "../shared/FilterSection";
import TransactionTable from "../shared/TransactionTable";

type Props = {
  transactions: Txn[];
  token: string | null;
  invalidateTransactionMeta: () => Promise<void>;
};

type TransactionTagChange = {
  transaction_id: string;
  bucket_1_tag_id?: number | null;
  bucket_2_tag_id?: number | null;
  meta_tag_ids?: number[] | null;
};

type TagUiKind = "income" | "spending" | "meta";
const TAG_UI_KIND_LABEL: Record<TagUiKind, string> = {
  income: "Income",
  spending: "Spending",
  meta: "Meta"
};
const TAG_UI_KIND_TO_TYPE: Record<TagUiKind, TagType> = {
  income: "income_bucket_1",
  spending: "spending_bucket_1",
  meta: "meta"
};
const KIND_INFO: Record<TagUiKind, string> = {
  income: "Can only be applied to inflow transactions",
  spending: "Can only be applied to outflow transactions",
  meta: "Can be applied to any transaction"
};

type MyTagsMode = "default" | "creating" | "deleting";

function KindSelect({ value, onChange }: { value: TagUiKind; onChange: (k: TagUiKind) => void }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<TagUiKind | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="form-select form-select-sm text-start"
        style={{ cursor: "pointer" }}
        onClick={() => setOpen((o) => !o)}
      >
        {TAG_UI_KIND_LABEL[value]}
      </button>
      {open && (
        <div
          className="border rounded shadow-sm bg-white"
          style={{ position: "absolute", zIndex: 200, top: "calc(100% + 2px)", left: 0, right: 0 }}
        >
          {(Object.keys(TAG_UI_KIND_LABEL) as TagUiKind[]).map((kind) => (
            <div
              key={kind}
              className="d-flex justify-content-between align-items-center px-2 py-1"
              style={{
                cursor: "pointer",
                background: kind === value ? "var(--bs-light, #f8f9fa)" : "transparent",
                userSelect: "none"
              }}
              onClick={() => { onChange(kind); setOpen(false); }}
            >
              <span className="small">{TAG_UI_KIND_LABEL[kind]}</span>
              <span
                className="text-secondary ms-2"
                style={{ position: "relative", fontSize: "0.8rem", lineHeight: 1 }}
                onMouseEnter={() => setHovered(kind)}
                onMouseLeave={() => setHovered(null)}
                onClick={(e) => e.stopPropagation()}
              >
                ⓘ
                {hovered === kind && (
                  <span style={{
                    position: "absolute",
                    bottom: "calc(100% + 5px)",
                    right: 0,
                    background: "#212529",
                    color: "#fff",
                    padding: "5px 9px",
                    borderRadius: 5,
                    fontSize: "0.7rem",
                    whiteSpace: "nowrap",
                    zIndex: 300,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                    pointerEvents: "none"
                  }}>
                    {KIND_INFO[kind]}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function friendlyApplyError(raw: string): string {
  if (/income tag/i.test(raw) && /debit/i.test(raw))
    return "You cannot apply income tags to outflow transactions.";
  if (/spending tag/i.test(raw) && /credit/i.test(raw))
    return "You cannot apply spending tags to inflow transactions.";
  return raw;
}

function colorBadgeStyle(color: string) {
  return {
    backgroundColor: color,
    color: getTextColorForBackground(color),
    border: "1px solid rgba(0,0,0,0.12)"
  } as const;
}

export default function TagsTool({ transactions, token, invalidateTransactionMeta }: Props) {
  const queryClient = useQueryClient();
  const filters = useTransactionFilters(transactions);
  const [tab, setTab] = useState<"my-tags" | "tag-transactions">("tag-transactions");
  const [myTagsMode, setMyTagsMode] = useState<MyTagsMode>("default");
  const [createName, setCreateName] = useState("");
  const [createKind, setCreateKind] = useState<TagUiKind>("spending");
  const [createColor, setCreateColor] = useState(getDefaultTagColor(TAG_UI_KIND_TO_TYPE.spending));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [applyOpen, setApplyOpen] = useState(false);
  const applyRef = useRef<HTMLDivElement>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const removeRef = useRef<HTMLDivElement>(null);

  const tagsQuery = useQuery({
    queryKey: ["tags"],
    enabled: !!token,
    queryFn: async (): Promise<Tag[]> => {
      const res = await fetch("/api/tags", { headers: buildAuthHeaders(token) });
      if (!res.ok) throw new Error(`Failed to load tags (${res.status})`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });

  const createTagMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) },
        body: JSON.stringify({ name: createName.trim(), type: TAG_UI_KIND_TO_TYPE[createKind], color: createColor })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Failed to create tag (${res.status})`);
      }
    },
    onSuccess: async () => {
      setCreateName("");
      setCreateColor(getDefaultTagColor(TAG_UI_KIND_TO_TYPE[createKind]));
      await queryClient.invalidateQueries({ queryKey: ["tags"] });
    }
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      const res = await fetch(`/api/tags/${tagId}`, {
        method: "DELETE",
        headers: buildAuthHeaders(token)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Failed to delete tag (${res.status})`);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tags"] });
      await invalidateTransactionMeta();
    }
  });

  const applyTagsMutation = useMutation({
    mutationFn: async (items: TransactionTagChange[]) => {
      const res = await fetch("/api/transaction_meta/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) },
        body: JSON.stringify(items)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(friendlyApplyError(data?.error || `Failed to apply tags (${res.status})`));
      }
    },
    onSuccess: async () => {
      setSelectedIds(new Set());
      await invalidateTransactionMeta();
    }
  });

  const tags = useMemo(() => tagsQuery.data ?? [], [tagsQuery.data]);
  const metaTags = useMemo(() => tags.filter((t) => t.type === "meta"), [tags]);
  const incomeTags = useMemo(
    () => tags.filter((t) => t.type === "income_bucket_1" || t.type === "income_bucket_2"),
    [tags]
  );
  const spendingTags = useMemo(
    () => tags.filter((t) => t.type === "spending_bucket_1" || t.type === "spending_bucket_2"),
    [tags]
  );
  const metaOnlyTags = metaTags;
  const selectableTransactions = useMemo(
    () => filters.derived.filteredTransactions.filter((t) => !!t.transaction_id),
    [filters.derived.filteredTransactions]
  );

  const tagsOnSelected = useMemo(() => {
    const ids = new Set<number>();
    selectableTransactions
      .filter((t) => t.transaction_id && selectedIds.has(t.transaction_id))
      .forEach((t) => {
        if (t.bucket_1_tag_id != null) ids.add(t.bucket_1_tag_id);
        if (t.bucket_2_tag_id != null) ids.add(t.bucket_2_tag_id);
        (t.meta_tag_ids ?? []).forEach((metaId) => ids.add(metaId));
      });
    return tags.filter((tag) => ids.has(tag.id));
  }, [selectableTransactions, selectedIds, tags]);

  useEffect(() => {
    setCreateColor(getDefaultTagColor(TAG_UI_KIND_TO_TYPE[createKind]));
  }, [createKind]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (applyRef.current && !applyRef.current.contains(e.target as Node)) setApplyOpen(false);
      if (removeRef.current && !removeRef.current.contains(e.target as Node)) setRemoveOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const applySingleTag = async (tagId: number) => {
    const tag = tags.find((t) => t.id === tagId);
    if (!tag) return;
    const ids = [...selectedIds];
    if (!ids.length) return;
    const items = ids.map((transaction_id) => {
      const item: TransactionTagChange = { transaction_id };
      if (tag.type === "meta") {
        const txn = selectableTransactions.find((t) => t.transaction_id === transaction_id);
        item.meta_tag_ids = [...new Set([...(txn?.meta_tag_ids ?? []), tag.id])];
      }
      else if (tag.type === "income_bucket_2" || tag.type === "spending_bucket_2") item.bucket_2_tag_id = tag.id;
      else item.bucket_1_tag_id = tag.id;
      return item;
    });
    await applyTagsMutation.mutateAsync(items);
    setApplyOpen(false);
  };

  const removeTag = async (tagId: number) => {
    const items = [...selectedIds].flatMap((transaction_id) => {
      const txn = selectableTransactions.find((t) => t.transaction_id === transaction_id);
      if (!txn) return [];
      const item: TransactionTagChange = { transaction_id };
      if (txn.bucket_1_tag_id === tagId) item.bucket_1_tag_id = tagId;
      if (txn.bucket_2_tag_id === tagId) item.bucket_2_tag_id = tagId;
      if ((txn.meta_tag_ids ?? []).includes(tagId)) item.meta_tag_ids = [tagId];
      return item.bucket_1_tag_id !== undefined || item.bucket_2_tag_id !== undefined || item.meta_tag_ids !== undefined ? [item] : [];
    });
    if (!items.length) return;
    const res = await fetch("/api/transaction_meta/tags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) },
      body: JSON.stringify(items)
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(friendlyApplyError(data?.error || `Failed to remove tag (${res.status})`));
    }
    await invalidateTransactionMeta();
    setSelectedIds(new Set());
    setRemoveOpen(false);
  };

  const clearAllTags = async () => {
    const items: TransactionTagChange[] = [...selectedIds].flatMap((transaction_id) => {
      const txn = selectableTransactions.find((t) => t.transaction_id === transaction_id);
      if (!txn) return [];
      const bucketIds: number[] = [];
      if (txn.bucket_1_tag_id != null) bucketIds.push(txn.bucket_1_tag_id);
      if (txn.bucket_2_tag_id != null) bucketIds.push(txn.bucket_2_tag_id);
      const metaIds = txn.meta_tag_ids ?? [];
      if (bucketIds.length === 0 && metaIds.length === 0) return [];
      const uniqueMetaIds = [...new Set(metaIds)];
      const uniqueBucketIds = [...new Set(bucketIds)];
      return [
        {
          transaction_id,
          bucket_1_tag_id: uniqueBucketIds[0],
          bucket_2_tag_id: uniqueBucketIds[1],
          meta_tag_ids: uniqueMetaIds
        }
      ];
    });
    if (items.length === 0) {
      setRemoveOpen(false);
      return;
    }
    const res = await fetch("/api/transaction_meta/tags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) },
      body: JSON.stringify(items)
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(friendlyApplyError(data?.error || `Failed to clear tags (${res.status})`));
    }
    await invalidateTransactionMeta();
    setSelectedIds(new Set());
    setRemoveOpen(false);
  };

  return (
    <div className="card">
      <div className="card-body">
        <h6 className="card-title mb-1">Tags</h6>
        <p className="text-muted small mb-3">Manually identify transactions</p>

        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button className={`nav-link ${tab === "tag-transactions" ? "active" : ""}`} onClick={() => setTab("tag-transactions")}>
              Tag Transactions
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${tab === "my-tags" ? "active" : ""}`} onClick={() => setTab("my-tags")}>
              My Tags
            </button>
          </li>
        </ul>

        {tab === "my-tags" && (
          <>
            {/* Action row */}
            {myTagsMode === "creating" ? (
              <div className="d-flex gap-2 align-items-end mb-3 flex-wrap">
                <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                  <label className="form-label small mb-1">Name</label>
                  <input
                    className="form-control form-control-sm"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Tag name"
                    autoFocus
                  />
                </div>
                <div style={{ flex: "0 0 130px" }}>
                  <label className="form-label small mb-1">Type</label>
                  <KindSelect value={createKind} onChange={setCreateKind} />
                </div>
                <div style={{ flex: "1 1 220px", minWidth: 220 }}>
                  <label className="form-label small mb-1">Color</label>
                  <div className="d-flex flex-wrap gap-1">
                    {TAG_COLOR_PALETTE.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`btn btn-sm ${createColor === color ? "btn-dark" : "btn-outline-secondary"}`}
                        style={{ width: 26, height: 26, padding: 0, backgroundColor: color }}
                        onClick={() => setCreateColor(color)}
                        aria-label={`Select ${color}`}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-primary px-3"
                  style={{ minWidth: 110 }}
                  disabled={!createName.trim() || createTagMutation.isPending}
                  onClick={() =>
                    createTagMutation.mutateAsync().then(() => setMyTagsMode("default"))
                  }
                >
                  {createTagMutation.isPending ? "Creating…" : "Create"}
                </button>
                <button
                  className="btn btn-sm btn-outline-secondary px-3"
                  style={{ minWidth: 110 }}
                  onClick={() => { setCreateName(""); setCreateColor(getDefaultTagColor(TAG_UI_KIND_TO_TYPE[createKind])); setMyTagsMode("default"); }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="d-flex gap-2 mb-3">
                <button
                  className="btn btn-sm btn-outline-primary px-3"
                  style={{ minWidth: 130 }}
                  onClick={() => setMyTagsMode("creating")}
                >
                  New tag
                </button>
                <button
                  className={`btn btn-sm px-3 ${myTagsMode === "deleting" ? "btn-danger" : "btn-outline-secondary"}`}
                  style={{ minWidth: 130 }}
                  onClick={() => setMyTagsMode((m) => m === "deleting" ? "default" : "deleting")}
                >
                  Delete tags
                </button>
              </div>
            )}

            {(tagsQuery.error || createTagMutation.error || deleteTagMutation.error) && (
              <div className="alert alert-danger py-1 small">
                {(tagsQuery.error as Error | null)?.message
                  || (createTagMutation.error as Error | null)?.message
                  || (deleteTagMutation.error as Error | null)?.message}
              </div>
            )}

            {tagsQuery.isLoading ? (
              <LoadingSpinner message="Loading tags..." />
            ) : (
              <div className="row g-3">
                {([
                  { label: "Income tags", list: incomeTags },
                  { label: "Spending tags", list: spendingTags },
                  { label: "Meta tags", list: metaOnlyTags }
                ] as const).map(({ label, list }) => (
                  <div key={label} className="col-12 col-md-4">
                    <div className="border rounded p-2 h-100">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="small fw-semibold">{label}</span>
                        <span className="badge bg-light text-muted">{list.length}</span>
                      </div>
                      {list.length === 0 ? (
                        <div className="text-muted small">No {label.toLowerCase()} yet.</div>
                      ) : (
                        <ul className="list-unstyled mb-0 small">
                          {list.map((tag) => (
                            <li key={tag.id} className="d-flex justify-content-between align-items-center py-1 border-bottom">
                              <div className="d-flex align-items-center gap-2">
                                <span className="badge" style={colorBadgeStyle(getDisplayTagColor(tag.type, tag.color))}>{tag.name}</span>
                              </div>
                              {myTagsMode === "deleting" && (
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  disabled={deleteTagMutation.isPending}
                                  onClick={() => deleteTagMutation.mutate(tag.id)}
                                >
                                  Delete
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "tag-transactions" && (
          <>
            {applyTagsMutation.error && <div className="alert alert-danger py-1 small">{(applyTagsMutation.error as Error).message}</div>}

            <div className="row">
              <div className="col-12 col-lg-3 mb-3 mb-lg-0">
                <TransactionsFilterSection filters={filters} tags={tags} />
              </div>
              <div className="col-12 col-lg-9">
                <AppliedFiltersBar filters={filters} />
                <div className="d-flex justify-content-end gap-2 mb-2">
                  {/* Apply tag */}
                  <div ref={applyRef} style={{ position: "relative" }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-success px-3"
                      style={{ minWidth: 120 }}
                      disabled={selectedIds.size === 0 || applyTagsMutation.isPending}
                      onClick={() => { setApplyOpen((o) => !o); setRemoveOpen(false); }}
                    >
                      Apply tag
                    </button>
                    {applyOpen && (
                      <div
                        className="border rounded shadow-sm bg-white"
                        style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 200, width: 300 }}
                      >
                        <div className="px-3 py-2 border-bottom small text-muted">
                          Apply tag to <strong className="text-body">{selectedIds.size}</strong> transaction{selectedIds.size !== 1 ? "s" : ""}
                        </div>
                        <div style={{ maxHeight: 280, overflowY: "auto" }}>
                          {tags.length === 0 ? (
                            <div className="px-3 py-2 small text-muted">No tags yet.</div>
                          ) : (
                            tags
                              .slice()
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  className="w-100 btn btn-link text-start text-decoration-none px-3 py-2 border-0"
                                  style={{ color: "inherit" }}
                                  onClick={() => applySingleTag(t.id)}
                                >
                                  <div className="d-flex justify-content-between align-items-center">
                                    <span className="badge" style={colorBadgeStyle(getDisplayTagColor(t.type, t.color))}>{t.name}</span>
                                    <span className="badge bg-light text-muted">{t.type === "meta" ? "Meta" : t.type.startsWith("income") ? "Income" : "Spending"}</span>
                                  </div>
                                </button>
                              ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Remove tag */}
                  <div ref={removeRef} style={{ position: "relative" }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary px-3"
                      style={{ minWidth: 120 }}
                      disabled={selectedIds.size === 0 || applyTagsMutation.isPending}
                      onClick={() => { setRemoveOpen((o) => !o); setApplyOpen(false); }}
                    >
                      Remove tag
                    </button>
                    {removeOpen && (
                      <div
                        className="border rounded shadow-sm bg-white"
                        style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 200, width: 300 }}
                      >
                        <div className="px-3 py-2 border-bottom small text-muted">
                          Remove tag from <strong className="text-body">{selectedIds.size}</strong> transaction{selectedIds.size !== 1 ? "s" : ""}
                        </div>
                        <button
                          type="button"
                          className="w-100 btn btn-link text-start text-decoration-none px-3 py-2 border-0 text-danger"
                          onClick={clearAllTags}
                        >
                          <span className="small">Clear all tags</span>
                        </button>
                        {tagsOnSelected.length > 0 && <div className="border-top" />}
                        <div style={{ maxHeight: 240, overflowY: "auto" }}>
                          {tagsOnSelected.length === 0 ? (
                            <div className="px-3 py-2 small text-muted">No tags on selected transactions.</div>
                          ) : (
                            tagsOnSelected.map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                className="w-100 btn btn-link text-start text-decoration-none px-3 py-2 border-0"
                                style={{ color: "inherit" }}
                                onClick={() => removeTag(t.id)}
                              >
                                <div className="d-flex justify-content-between align-items-center">
                                  <span className="badge" style={colorBadgeStyle(getDisplayTagColor(t.type, t.color))}>{t.name}</span>
                                  <span className="badge bg-light text-muted">{t.type === "meta" ? "Meta" : t.type.startsWith("income") ? "Income" : "Spending"}</span>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <TransactionTable
                  transactions={selectableTransactions}
                  taggingMode
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                  tags={tags}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

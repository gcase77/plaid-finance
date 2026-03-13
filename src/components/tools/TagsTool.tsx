import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTransactionFilters } from "../../hooks/useTransactionFilters";
import { buildAuthHeaders } from "../../lib/auth";
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

type PatchTagItem = {
  transaction_id: string;
  bucket_1_tag_id?: number | null;
  bucket_2_tag_id?: number | null;
  meta_tag_id?: number | null;
};

const TAG_TYPES: TagType[] = ["income_bucket_1", "income_bucket_2", "spending_bucket_1", "spending_bucket_2", "meta"];
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

const NO_CHANGE = "__no_change__";
const CLEAR = "__clear__";

function parseSelectValue(value: string): number | null | undefined {
  if (value === NO_CHANGE) return undefined;
  if (value === CLEAR) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function friendlyApplyError(raw: string): string {
  if (/income tag/i.test(raw) && /debit/i.test(raw))
    return "You cannot apply income tags to outflow transactions.";
  if (/spending tag/i.test(raw) && /credit/i.test(raw))
    return "You cannot apply spending tags to inflow transactions.";
  return raw;
}

export default function TagsTool({ transactions, token, invalidateTransactionMeta }: Props) {
  const queryClient = useQueryClient();
  const filters = useTransactionFilters(transactions);
  const [tab, setTab] = useState<"my-tags" | "tag-transactions">("tag-transactions");
  const [myTagsMode, setMyTagsMode] = useState<MyTagsMode>("default");
  const [createName, setCreateName] = useState("");
  const [createKind, setCreateKind] = useState<TagUiKind>("spending");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bucket1Value, setBucket1Value] = useState(NO_CHANGE);
  const [bucket2Value, setBucket2Value] = useState(NO_CHANGE);
  const [metaValue, setMetaValue] = useState(NO_CHANGE);
  const [actionError, setActionError] = useState<string | null>(null);
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
        body: JSON.stringify({ name: createName.trim(), type: TAG_UI_KIND_TO_TYPE[createKind] })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Failed to create tag (${res.status})`);
      }
    },
    onSuccess: async () => {
      setCreateName("");
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
    mutationFn: async (items: PatchTagItem[]) => {
      const res = await fetch("/api/transaction_meta/tags", {
        method: "PATCH",
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
  const bucketTags = useMemo(() => tags.filter((t) => t.type !== "meta"), [tags]);
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
        if (t.meta_tag_id != null) ids.add(t.meta_tag_id);
      });
    return tags.filter((tag) => ids.has(tag.id));
  }, [selectableTransactions, selectedIds, tags]);

  const tagByType = useMemo(() => {
    const groups = new Map<TagType, Tag[]>();
    TAG_TYPES.forEach((type) => groups.set(type, []));
    tags.forEach((tag) => groups.get(tag.type)?.push(tag));
    return groups;
  }, [tags]);

  const onApplyTags = async () => {
    setActionError(null);
    const bucket1Tag = parseSelectValue(bucket1Value);
    const bucket2Tag = parseSelectValue(bucket2Value);
    const metaTag = parseSelectValue(metaValue);
    const hasChange = bucket1Tag !== undefined || bucket2Tag !== undefined || metaTag !== undefined;
    if (!hasChange) {
      setActionError("Choose at least one tag slot to update.");
      return;
    }
    const ids = [...selectedIds];
    if (!ids.length) {
      setActionError("Select at least one transaction.");
      return;
    }
    const items = ids.map((transaction_id) => {
      const item: PatchTagItem = { transaction_id };
      if (bucket1Tag !== undefined) item.bucket_1_tag_id = bucket1Tag;
      if (bucket2Tag !== undefined) item.bucket_2_tag_id = bucket2Tag;
      if (metaTag !== undefined) item.meta_tag_id = metaTag;
      return item;
    });
    await applyTagsMutation.mutateAsync(items);
  };

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
      const item: PatchTagItem = { transaction_id };
      if (tag.type === "meta") item.meta_tag_id = tag.id;
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
      const item: PatchTagItem = { transaction_id };
      if (txn.bucket_1_tag_id === tagId) item.bucket_1_tag_id = null;
      if (txn.bucket_2_tag_id === tagId) item.bucket_2_tag_id = null;
      if (txn.meta_tag_id === tagId) item.meta_tag_id = null;
      return item.bucket_1_tag_id !== undefined || item.bucket_2_tag_id !== undefined || item.meta_tag_id !== undefined
        ? [item] : [];
    });
    if (!items.length) return;
    await applyTagsMutation.mutateAsync(items);
    setRemoveOpen(false);
  };

  const clearAllTags = async () => {
    const items = [...selectedIds].map((transaction_id) => ({
      transaction_id,
      bucket_1_tag_id: null,
      bucket_2_tag_id: null,
      meta_tag_id: null
    }));
    await applyTagsMutation.mutateAsync(items);
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
                  onClick={() => { setCreateName(""); setMyTagsMode("default"); }}
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
                              <div>
                                <div>{tag.name}</div>
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
            {actionError && <div className="alert alert-warning py-1 small">{actionError}</div>}
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
                                    <span className="small">{t.name}</span>
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
                                  <span className="small">{t.name}</span>
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

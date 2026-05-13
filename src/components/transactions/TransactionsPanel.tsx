import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseTransactionFiltersReturn } from "../../hooks/useTransactionFilters";
import { buildAuthHeaders } from "../../lib/auth";
import { getDefaultTagColor, getDisplayTagColor, getTextColorForBackground, TAG_COLOR_PALETTE } from "../../utils/transactionUtils";
import AppliedFiltersBar from "../shared/AppliedFiltersBar";
import TransactionsFilterSection from "../shared/FilterSection";
import LoadingSpinner from "../shared/LoadingSpinner";
import TransactionTable from "../shared/TransactionTable";
import type { Tag, TagType, Txn } from "../types";

type Props = {
  syncTransactions: () => Promise<void>;
  syncStatus: string;
  loadingTxns: boolean;
  filters: UseTransactionFiltersReturn;
  tags: Tag[];
  tagsLoading: boolean;
  tagsError: Error | null;
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
type TagsMode = "view" | "edit" | "delete";

const TAG_UI_KIND_TO_TYPE: Record<TagUiKind, TagType> = {
  income: "income_bucket_1",
  spending: "spending_bucket_1",
  meta: "meta"
};

const byName = (a: Tag, b: Tag) => a.name.localeCompare(b.name);
const scope = (type: TagType) => type === "meta" ? "Meta" : type.startsWith("income") ? "Income" : "Spending";
const tagRank = (t: Tag) => t.type === "meta" ? 0 : t.type.startsWith("spending") ? 1 : 2;
const sortTags = (tags: Tag[]) => [...tags].sort((a, b) => tagRank(a) - tagRank(b) || a.name.localeCompare(b.name));

function friendlyApplyError(raw: string): string {
  if (/income tag/i.test(raw) && /debit/i.test(raw)) return "You cannot apply income tags to outflow transactions.";
  if (/spending tag/i.test(raw) && /credit/i.test(raw)) return "You cannot apply spending tags to inflow transactions.";
  return raw;
}

function TagBadge({ tag }: { tag: Tag }) {
  const color = getDisplayTagColor(tag.type, tag.color);
  return <span className="badge" style={{ backgroundColor: color, color: getTextColorForBackground(color), border: "1px solid rgba(0,0,0,.12)" }}>{tag.name}</span>;
}

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="cluster">
      {TAG_COLOR_PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          className={`btn btn-sm ${value === color ? "btn-dark" : "btn-outline-secondary"}`}
          style={{ width: 26, height: 26, padding: 0, backgroundColor: color }}
          onClick={() => onChange(color)}
          aria-label={`Select ${color}`}
        />
      ))}
    </div>
  );
}

function TagsTab({
  tags,
  tagsLoading,
  error,
  createTag,
  updateTag,
  deleteTag
}: {
  tags: Tag[];
  tagsLoading: boolean;
  error: string | null;
  createTag: (data: { name: string; kind: TagUiKind; color: string }) => Promise<void>;
  updateTag: (data: { tagId: number; name: string; color: string }) => Promise<void>;
  deleteTag: (tagId: number) => void;
}) {
  const [mode, setMode] = useState<TagsMode>("view");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<TagUiKind>("spending");
  const [color, setColor] = useState(getDefaultTagColor(TAG_UI_KIND_TO_TYPE.spending));
  const [editing, setEditing] = useState<Tag | null>(null);
  const groups = [
    { title: "Meta", tags: tags.filter((t) => t.type === "meta").sort(byName) },
    { title: "Spending", tags: tags.filter((t) => t.type.startsWith("spending")).sort(byName) },
    { title: "Income", tags: tags.filter((t) => t.type.startsWith("income")).sort(byName) }
  ];

  const resetCreate = () => {
    setName("");
    setKind("spending");
    setColor(getDefaultTagColor(TAG_UI_KIND_TO_TYPE.spending));
  };

  return (
    <div className="stack">
      <div className="surface-card p-3">
        <div className="split">
          <div>
            <h2 className="h5 mb-1">Tags</h2>
            <p className="text-muted small mb-0">Create buckets for income and spending, plus meta labels for details.</p>
          </div>
          <div className="cluster">
            <button className="btn btn-outline-primary" onClick={() => setMode(mode === "view" ? "edit" : "view")}>{mode === "edit" ? "Done editing" : "Edit"}</button>
            <button className="btn btn-outline-danger" onClick={() => setMode(mode === "delete" ? "view" : "delete")}>{mode === "delete" ? "Done deleting" : "Delete"}</button>
          </div>
        </div>
        {error && <div className="alert alert-danger py-2 small mt-3">{error}</div>}
        <div className="filter-grid mt-3">
          <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} placeholder="New tag name" />
          <select className="form-select" value={kind} onChange={(e) => { const k = e.target.value as TagUiKind; setKind(k); setColor(getDefaultTagColor(TAG_UI_KIND_TO_TYPE[k])); }}>
            <option value="spending">Spending</option>
            <option value="income">Income</option>
            <option value="meta">Meta</option>
          </select>
        </div>
        <div className="cluster mt-2">
          <ColorPicker value={color} onChange={setColor} />
          <button className="btn btn-primary ms-auto" disabled={!name.trim()} onClick={() => createTag({ name, kind, color }).then(resetCreate)}>Create tag</button>
        </div>
      </div>

      {tagsLoading ? <LoadingSpinner message="Loading tags..." /> : (
        <div className="grid-cards">
          {groups.map((group) => (
            <section key={group.title} className="surface-card p-3">
              <div className="split mb-2">
                <h3 className="h6 mb-0">{group.title}</h3>
                <span className="chip">{group.tags.length}</span>
              </div>
              <div className="stack">
                {group.tags.length === 0 && <span className="small text-muted">No tags yet.</span>}
                {group.tags.map((tag) => (
                  <div key={tag.id} className="metric-card">
                    {editing?.id === tag.id ? (
                      <div className="stack">
                        <input className="form-control form-control-sm" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                        <ColorPicker value={getDisplayTagColor(editing.type, editing.color)} onChange={(next) => setEditing({ ...editing, color: next })} />
                        <div className="cluster justify-content-end">
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditing(null)}>Cancel</button>
                          <button className="btn btn-sm btn-primary" onClick={() => updateTag({ tagId: editing.id, name: editing.name, color: getDisplayTagColor(editing.type, editing.color) }).then(() => setEditing(null))}>Save</button>
                        </div>
                      </div>
                    ) : (
                      <div className="split">
                        <div className="cluster"><TagBadge tag={tag} /><span className="chip">{scope(tag.type)}</span></div>
                        {mode === "edit" && <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditing(tag)}>Edit</button>}
                        {mode === "delete" && <button className="btn btn-sm btn-outline-danger" onClick={() => deleteTag(tag.id)}>Delete</button>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TransactionsPanel({
  syncTransactions,
  syncStatus,
  loadingTxns,
  filters,
  tags,
  tagsLoading,
  tagsError,
  token,
  invalidateTransactionMeta
}: Props) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"transactions" | "tags">("transactions");
  const [taggingMode, setTaggingMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [applyTagId, setApplyTagId] = useState("");
  const [removeTagId, setRemoveTagId] = useState("");

  const selectableTransactions = useMemo(
    () => filters.derived.filteredTransactions.filter((t): t is Txn & { transaction_id: string } => !!t.transaction_id),
    [filters.derived.filteredTransactions]
  );
  const tagsOnSelected = useMemo(() => {
    const ids = new Set<number>();
    selectableTransactions.filter((t) => selectedIds.has(t.transaction_id)).forEach((t) => {
      if (t.bucket_1_tag_id != null) ids.add(t.bucket_1_tag_id);
      if (t.bucket_2_tag_id != null) ids.add(t.bucket_2_tag_id);
      (t.meta_tag_ids ?? []).forEach((id) => ids.add(id));
    });
    return sortTags(tags.filter((tag) => ids.has(tag.id)));
  }, [selectableTransactions, selectedIds, tags]);

  const createTagMutation = useMutation({
    mutationFn: async ({ name, kind, color }: { name: string; kind: TagUiKind; color: string }) => {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) },
        body: JSON.stringify({ name: name.trim(), type: TAG_UI_KIND_TO_TYPE[kind], color })
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Failed to create tag (${res.status})`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags"] })
  });

  const updateTagMutation = useMutation({
    mutationFn: async ({ tagId, name, color }: { tagId: number; name: string; color: string }) => {
      const res = await fetch(`/api/tags/${tagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) },
        body: JSON.stringify({ name: name.trim(), color })
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Failed to update tag (${res.status})`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags"] })
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      const res = await fetch(`/api/tags/${tagId}`, { method: "DELETE", headers: buildAuthHeaders(token) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Failed to delete tag (${res.status})`);
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
      if (!res.ok) throw new Error(friendlyApplyError((await res.json().catch(() => ({})))?.error || `Failed to apply tags (${res.status})`));
    },
    onSuccess: async () => {
      setSelectedIds(new Set());
      await invalidateTransactionMeta();
    }
  });

  const applySelectedTag = async () => {
    const tag = tags.find((t) => t.id === Number(applyTagId));
    if (!tag || selectedIds.size === 0) return;
    const items: TransactionTagChange[] = [...selectedIds].map((transaction_id) => {
      const item: TransactionTagChange = { transaction_id };
      if (tag.type === "meta") {
        const txn = selectableTransactions.find((t) => t.transaction_id === transaction_id);
        item.meta_tag_ids = [...new Set([...(txn?.meta_tag_ids ?? []), tag.id])];
      } else if (tag.type.endsWith("_bucket_2")) item.bucket_2_tag_id = tag.id;
      else item.bucket_1_tag_id = tag.id;
      return item;
    });
    await applyTagsMutation.mutateAsync(items);
    setApplyTagId("");
  };

  const deleteTags = async (items: TransactionTagChange[]) => {
    if (!items.length) return;
    const res = await fetch("/api/transaction_meta/tags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) },
      body: JSON.stringify(items)
    });
    if (!res.ok) throw new Error(friendlyApplyError((await res.json().catch(() => ({})))?.error || `Failed to remove tags (${res.status})`));
    setSelectedIds(new Set());
    await invalidateTransactionMeta();
  };

  const removeSelectedTag = async () => {
    const tagId = Number(removeTagId);
    if (!tagId) return;
    await deleteTags([...selectedIds].flatMap((transaction_id) => {
      const txn = selectableTransactions.find((t) => t.transaction_id === transaction_id);
      if (!txn) return [];
      const item: TransactionTagChange = { transaction_id };
      if (txn.bucket_1_tag_id === tagId) item.bucket_1_tag_id = tagId;
      if (txn.bucket_2_tag_id === tagId) item.bucket_2_tag_id = tagId;
      if ((txn.meta_tag_ids ?? []).includes(tagId)) item.meta_tag_ids = [tagId];
      return item.bucket_1_tag_id || item.bucket_2_tag_id || item.meta_tag_ids ? [item] : [];
    }));
    setRemoveTagId("");
  };

  const clearSelectedTags = async () => {
    await deleteTags([...selectedIds].flatMap((transaction_id) => {
      const txn = selectableTransactions.find((t) => t.transaction_id === transaction_id);
      if (!txn) return [];
      const item: TransactionTagChange = {
        transaction_id,
        bucket_1_tag_id: txn.bucket_1_tag_id ?? undefined,
        bucket_2_tag_id: txn.bucket_2_tag_id ?? undefined,
        meta_tag_ids: txn.meta_tag_ids?.length ? [...new Set(txn.meta_tag_ids)] : undefined
      };
      return item.bucket_1_tag_id || item.bucket_2_tag_id || item.meta_tag_ids ? [item] : [];
    }));
  };

  const error = tagsError?.message
    || (createTagMutation.error as Error | null)?.message
    || (updateTagMutation.error as Error | null)?.message
    || (deleteTagMutation.error as Error | null)?.message
    || (applyTagsMutation.error as Error | null)?.message;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <span className="page-kicker">Activity and labels</span>
          <h1>Transactions</h1>
        </div>
        <div className="pill-tabs">
          <button className={`btn btn-sm ${tab === "transactions" ? "active" : ""}`} onClick={() => setTab("transactions")}>Tag transactions</button>
          <button className={`btn btn-sm ${tab === "tags" ? "active" : ""}`} onClick={() => setTab("tags")}>My tags</button>
        </div>
      </div>

      {tab === "tags" ? (
        <TagsTab
          tags={tags}
          tagsLoading={tagsLoading}
          error={error ?? null}
          createTag={(data) => createTagMutation.mutateAsync(data)}
          updateTag={(data) => updateTagMutation.mutateAsync(data)}
          deleteTag={(id) => deleteTagMutation.mutate(id)}
        />
      ) : (
        <div className="row g-3">
          <div className="col-12 col-xl-3">
            <TransactionsFilterSection filters={filters} tags={tags} />
          </div>
          <div className="col-12 col-xl-9">
            <section className="surface-card p-3 stack">
              <div className="split">
                <div className="cluster">
                  <button className="btn btn-primary" onClick={syncTransactions} disabled={loadingTxns}>Sync transactions</button>
                  <span className="small text-muted">{syncStatus}</span>
                </div>
                <label className="form-check form-switch m-0">
                  <input className="form-check-input" type="checkbox" checked={taggingMode} onChange={(e) => { setTaggingMode(e.target.checked); setSelectedIds(new Set()); }} />
                  <span className="form-check-label small">Tagging mode</span>
                </label>
              </div>
              <AppliedFiltersBar filters={filters} />
              {taggingMode && (
                <div className="metric-card">
                  <div className="split">
                    <span className="small text-muted"><strong>{selectedIds.size}</strong> selected</span>
                    <button className="btn btn-sm btn-outline-secondary" disabled={selectedIds.size === 0} onClick={() => setSelectedIds(new Set())}>Clear selection</button>
                  </div>
                  <div className="filter-grid mt-2">
                    <div className="cluster">
                      <select className="form-select form-select-sm" value={applyTagId} onChange={(e) => setApplyTagId(e.target.value)}>
                        <option value="">Apply tag...</option>
                        {sortTags(tags).map((t) => <option key={t.id} value={t.id}>{scope(t.type)} - {t.name}</option>)}
                      </select>
                      <button className="btn btn-sm btn-primary" disabled={!applyTagId || selectedIds.size === 0} onClick={() => void applySelectedTag()}>Apply</button>
                    </div>
                    <div className="cluster">
                      <select className="form-select form-select-sm" value={removeTagId} onChange={(e) => setRemoveTagId(e.target.value)}>
                        <option value="">Remove tag...</option>
                        {tagsOnSelected.map((t) => <option key={t.id} value={t.id}>{scope(t.type)} - {t.name}</option>)}
                      </select>
                      <button className="btn btn-sm btn-outline-secondary" disabled={!removeTagId || selectedIds.size === 0} onClick={() => void removeSelectedTag()}>Remove</button>
                      <button className="btn btn-sm btn-outline-danger" disabled={selectedIds.size === 0} onClick={() => void clearSelectedTags()}>Clear all</button>
                    </div>
                  </div>
                </div>
              )}
              {error && <div className="alert alert-danger py-2 small">{error}</div>}
              {loadingTxns ? <LoadingSpinner /> : (
                <TransactionTable
                  transactions={taggingMode ? selectableTransactions : filters.derived.filteredTransactions}
                  taggingMode={taggingMode}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                  tags={tags}
                />
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

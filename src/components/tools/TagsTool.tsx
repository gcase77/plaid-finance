import { useMemo, useState } from "react";
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
const NO_CHANGE = "__no_change__";
const CLEAR = "__clear__";

function parseSelectValue(value: string): number | null | undefined {
  if (value === NO_CHANGE) return undefined;
  if (value === CLEAR) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default function TagsTool({ transactions, token, invalidateTransactionMeta }: Props) {
  const queryClient = useQueryClient();
  const filters = useTransactionFilters(transactions);
  const [createName, setCreateName] = useState("");
  const [createType, setCreateType] = useState<TagType>("spending_bucket_1");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bucket1Value, setBucket1Value] = useState(NO_CHANGE);
  const [bucket2Value, setBucket2Value] = useState(NO_CHANGE);
  const [metaValue, setMetaValue] = useState(NO_CHANGE);
  const [actionError, setActionError] = useState<string | null>(null);

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
        body: JSON.stringify({ name: createName.trim(), type: createType })
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
        throw new Error(data?.error || `Failed to apply tags (${res.status})`);
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
  const selectableTransactions = useMemo(
    () => filters.derived.filteredTransactions.filter((t) => !!t.transaction_id),
    [filters.derived.filteredTransactions]
  );

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

  return (
    <div className="d-flex flex-column gap-3">
      <div className="card">
        <div className="card-body">
          <h6 className="card-title mb-1">Tags</h6>
          <p className="text-muted small mb-0">Manually identify transactions</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h6 className="card-title">My Tags</h6>
          <div className="row g-2 align-items-end mb-3">
            <div className="col-sm-5">
              <label className="form-label small mb-1">Name</label>
              <input
                className="form-control form-control-sm"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Tag name"
              />
            </div>
            <div className="col-sm-4">
              <label className="form-label small mb-1">Type</label>
              <select className="form-select form-select-sm" value={createType} onChange={(e) => setCreateType(e.target.value as TagType)}>
                {TAG_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="col-sm-3">
              <button
                className="btn btn-sm btn-primary w-100"
                disabled={!createName.trim() || createTagMutation.isPending}
                onClick={() => createTagMutation.mutate()}
              >
                {createTagMutation.isPending ? "Creating..." : "Create tag"}
              </button>
            </div>
          </div>

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
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th style={{ width: 90 }} />
                  </tr>
                </thead>
                <tbody>
                  {tags.length === 0 ? (
                    <tr><td colSpan={3} className="text-muted small">No tags yet.</td></tr>
                  ) : (
                    tags.map((tag) => (
                      <tr key={tag.id}>
                        <td>{tag.name}</td>
                        <td><span className="badge bg-secondary">{tag.type}</span></td>
                        <td className="text-end">
                          <button
                            className="btn btn-sm btn-outline-danger"
                            disabled={deleteTagMutation.isPending}
                            onClick={() => deleteTagMutation.mutate(tag.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h6 className="card-title">Tag Transactions</h6>
          {actionError && <div className="alert alert-warning py-1 small">{actionError}</div>}
          {applyTagsMutation.error && <div className="alert alert-danger py-1 small">{(applyTagsMutation.error as Error).message}</div>}

          <div className="row g-2 align-items-end mb-3">
            <div className="col-12 col-md-3">
              <label className="form-label small mb-1">Bucket 1</label>
              <select className="form-select form-select-sm" value={bucket1Value} onChange={(e) => setBucket1Value(e.target.value)}>
                <option value={NO_CHANGE}>No change</option>
                <option value={CLEAR}>Clear</option>
                {bucketTags.map((tag) => <option key={tag.id} value={String(tag.id)}>{tag.name}</option>)}
              </select>
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label small mb-1">Bucket 2</label>
              <select className="form-select form-select-sm" value={bucket2Value} onChange={(e) => setBucket2Value(e.target.value)}>
                <option value={NO_CHANGE}>No change</option>
                <option value={CLEAR}>Clear</option>
                {bucketTags.map((tag) => <option key={tag.id} value={String(tag.id)}>{tag.name}</option>)}
              </select>
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label small mb-1">Meta</label>
              <select className="form-select form-select-sm" value={metaValue} onChange={(e) => setMetaValue(e.target.value)}>
                <option value={NO_CHANGE}>No change</option>
                <option value={CLEAR}>Clear</option>
                {metaTags.map((tag) => <option key={tag.id} value={String(tag.id)}>{tag.name}</option>)}
              </select>
            </div>
            <div className="col-12 col-md-3 d-flex gap-2">
              <button className="btn btn-sm btn-primary flex-fill" onClick={onApplyTags} disabled={applyTagsMutation.isPending}>
                {applyTagsMutation.isPending ? "Applying..." : `Apply (${selectedIds.size})`}
              </button>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedIds(new Set())}>
                Clear
              </button>
            </div>
          </div>

          <div className="small text-muted mb-2">
            Bucket 1 options: {tagByType.get("income_bucket_1")?.length || 0} income, {tagByType.get("spending_bucket_1")?.length || 0} spending.
            {" "}Bucket 2 options: {tagByType.get("income_bucket_2")?.length || 0} income, {tagByType.get("spending_bucket_2")?.length || 0} spending.
          </div>

          <div className="row">
            <div className="col-12 col-lg-3 mb-3 mb-lg-0">
              <TransactionsFilterSection filters={filters} tags={tags} />
            </div>
            <div className="col-12 col-lg-9">
              <AppliedFiltersBar filters={filters} />
              <TransactionTable
                transactions={selectableTransactions}
                taggingMode
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                tags={tags}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseTransactionFiltersReturn } from "../../hooks/useTransactionFilters";
import type { SyncTransactionsResult } from "../../hooks/useTransactionsData";
import { buildAuthHeaders } from "../../lib/auth";
import type { PaymentRequiredReason } from "../../lib/entitlements";
import { getDefaultTagColor, getDisplayTagColor, TAG_COLOR_PALETTE } from "../../utils/transactionUtils";
import type { Tag, TagType, Txn } from "../types";
import LoadingSpinner from "../shared/LoadingSpinner";
import PaywallModal, { LockIcon } from "../shared/PaywallModal";
import { TagBadge } from "../shared/TagBadge";
import AppliedFiltersBar from "../shared/AppliedFiltersBar";
import TransactionsFilterSection from "../shared/FilterSection";
import TransactionTable from "../shared/TransactionTable";
import { Alert, InfoTip, Popover } from "../shared/ui";

type Props = {
  syncTransactions: () => Promise<SyncTransactionsResult>;
  syncStatus: string;
  loadingTxns: boolean;
  filters: UseTransactionFiltersReturn;
  tags: Tag[];
  tagsLoading: boolean;
  tagsError: Error | null;
  token: string | null;
  invalidateTransactionMeta: () => Promise<void>;
  canSync: boolean;
  onPaymentRequired?: () => void | Promise<void>;
};

type TagChange = { transaction_id: string; bucket_1_tag_id?: number | null; bucket_2_tag_id?: number | null; meta_tag_ids?: number[] | null };

type TableMode = "none" | "tagging" | "netting";
const MODE_LABEL: Record<TableMode, string> = { none: "None", tagging: "Tagging Mode", netting: "Cash Netting Mode" };

type TagKind = "income" | "spending" | "meta";
const KIND_LABEL: Record<TagKind, string> = { income: "Income", spending: "Spending", meta: "Meta" };
const KIND_TO_TYPE: Record<TagKind, TagType> = { income: "income_bucket_1", spending: "spending_bucket_1", meta: "meta" };
const KIND_INFO: Record<TagKind, string> = {
  income: "Applies only to inflow transactions.",
  spending: "Applies only to outflow transactions.",
  meta: "Can be applied to any transaction; multiple per transaction."
};

const SYNC_HELP = "Money into accounts is negative; out is positive.\nAfter linking a bank, full history may take a few minutes; recent transactions may take a few days to appear.";

function sortMetaSpendingIncome(tags: readonly Tag[]) {
  const rank = (t: Tag) => t.type === "meta" ? 0 : t.type.startsWith("spending") ? 1 : 2;
  return [...tags].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}
const byName = (a: Tag, b: Tag) => a.name.localeCompare(b.name);

function friendlyError(raw: string): string {
  if (/income tag/i.test(raw) && /debit/i.test(raw)) return "You cannot apply income tags to outflow transactions.";
  if (/spending tag/i.test(raw) && /credit/i.test(raw)) return "You cannot apply spending tags to inflow transactions.";
  return raw;
}

function TagRow({ tag }: { tag: Tag }) {
  return (
    <div className="between" style={{ padding: "8px 12px" }}>
      <TagBadge tag={tag} />
      <span className="chip">{tag.type === "meta" ? "Meta" : tag.type.startsWith("income") ? "Income" : "Spending"}</span>
    </div>
  );
}

function ColorPicker({ value, onChange, size = 24 }: { value: string; onChange: (v: string) => void; size?: number }) {
  return (
    <div className="row-flex flex-wrap gap-1">
      {TAG_COLOR_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          title={c}
          onClick={() => onChange(c)}
          style={{
            width: size, height: size, padding: 0,
            background: c, borderRadius: 6,
            border: value === c ? "2px solid var(--ink)" : "1px solid var(--line)",
            cursor: "pointer"
          }}
        />
      ))}
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
  invalidateTransactionMeta,
  canSync,
  onPaymentRequired
}: Props) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"tag-transactions" | "my-tags">("tag-transactions");
  const [mode, setMode] = useState<TableMode>("none");
  const taggingMode = mode === "tagging";
  const selectionActive = mode !== "none";
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [paywallReason, setPaywallReason] = useState<PaymentRequiredReason | null>(null);

  const handleSync = async () => {
    if (!canSync) {
      setPaywallReason("sync");
      return;
    }
    const result = await syncTransactions();
    if (!result.ok && result.paymentRequired) {
      setPaywallReason(result.reason);
      await onPaymentRequired?.();
      return;
    }
  };

  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createKind, setCreateKind] = useState<TagKind>("spending");
  const [createColor, setCreateColor] = useState(getDefaultTagColor(KIND_TO_TYPE.spending));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(TAG_COLOR_PALETTE[0]);
  const [deleting, setDeleting] = useState(false);

  const [applyOpen, setApplyOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [applyBtn, setApplyBtn] = useState<HTMLButtonElement | null>(null);
  const [removeBtn, setRemoveBtn] = useState<HTMLButtonElement | null>(null);
  const [nettingAddOpen, setNettingAddOpen] = useState(false);
  const [nettingRemoveOpen, setNettingRemoveOpen] = useState(false);
  const [nettingAddBtn, setNettingAddBtn] = useState<HTMLButtonElement | null>(null);
  const [nettingRemoveBtn, setNettingRemoveBtn] = useState<HTMLButtonElement | null>(null);

  const metaTags = useMemo(() => tags.filter((t) => t.type === "meta").sort(byName), [tags]);
  const incomeTags = useMemo(() => tags.filter((t) => t.type === "income_bucket_1" || t.type === "income_bucket_2").sort(byName), [tags]);
  const spendingTags = useMemo(() => tags.filter((t) => t.type === "spending_bucket_1" || t.type === "spending_bucket_2").sort(byName), [tags]);

  const selectable = useMemo(
    () => filters.derived.filteredTransactions.filter((t): t is Txn & { transaction_id: string } => !!t.transaction_id),
    [filters.derived.filteredTransactions]
  );

  const tagsOnSelected = useMemo(() => {
    const ids = new Set<number>();
    selectable.filter((t) => selectedIds.has(t.transaction_id)).forEach((t) => {
      if (t.bucket_1_tag_id != null) ids.add(t.bucket_1_tag_id);
      if (t.bucket_2_tag_id != null) ids.add(t.bucket_2_tag_id);
      (t.meta_tag_ids ?? []).forEach((id) => ids.add(id));
    });
    return sortMetaSpendingIncome(tags.filter((t) => ids.has(t.id)));
  }, [selectable, selectedIds, tags]);

  useEffect(() => { setCreateColor(getDefaultTagColor(KIND_TO_TYPE[createKind])); }, [createKind]);
  useEffect(() => { setSelectedIds(new Set()); setApplyOpen(false); setRemoveOpen(false); setNettingAddOpen(false); setNettingRemoveOpen(false); }, [mode]);
  useEffect(() => {
    if (!selectionActive) return;
    const visible = new Set(selectable.map((t) => t.transaction_id));
    setSelectedIds((prev) => {
      if (!prev.size) return prev;
      const next = new Set<string>();
      prev.forEach((id) => { if (visible.has(id)) next.add(id); });
      return next.size === prev.size ? prev : next;
    });
  }, [selectionActive, selectable]);

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/tags", { method: "POST", headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) }, body: JSON.stringify({ name: createName.trim(), type: KIND_TO_TYPE[createKind], color: createColor }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || `Failed to create tag (${res.status})`); }
    },
    onSuccess: async () => { setCreateName(""); setCreateColor(getDefaultTagColor(KIND_TO_TYPE[createKind])); setCreating(false); await queryClient.invalidateQueries({ queryKey: ["tags"] }); }
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/tags/${id}`, { method: "DELETE", headers: buildAuthHeaders(token) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || `Failed to delete tag (${res.status})`); }
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["tags"] }); await invalidateTransactionMeta(); }
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, name, color }: { id: number; name: string; color: string }) => {
      const res = await fetch(`/api/tags/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) }, body: JSON.stringify({ name: name.trim(), color }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || `Failed to update tag (${res.status})`); }
    },
    onSuccess: async () => { setEditingId(null); setEditName(""); await queryClient.invalidateQueries({ queryKey: ["tags"] }); }
  });

  const applyMut = useMutation({
    mutationFn: async (items: TagChange[]) => {
      const res = await fetch("/api/transaction_meta/tags", { method: "POST", headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) }, body: JSON.stringify(items) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(friendlyError(d?.error || `Failed to apply tags (${res.status})`)); }
    },
    onSuccess: async () => { await invalidateTransactionMeta(); }
  });

  const selectedTxns = useMemo(() => selectable.filter((t) => selectedIds.has(t.transaction_id)), [selectable, selectedIds]);
  const selectedNettingGroups = useMemo(() => new Set(selectedTxns.map((t) => t.netting_group).filter((g): g is string => !!g)), [selectedTxns]);
  const ungroupedSelected = useMemo(() => selectedTxns.filter((t) => !t.netting_group && !t.account_transfer_group), [selectedTxns]);
  const groupedSelected = useMemo(() => selectedTxns.filter((t) => !!t.netting_group), [selectedTxns]);
  const nettingSidePhrase = (ts: Txn[]) => {
    const spend = ts.filter((t) => (t.amount ?? 0) > 0).length;
    const inc = ts.filter((t) => (t.amount ?? 0) < 0).length;
    const sp = spend ? `${spend} spending` : "";
    const ip = inc ? `${inc} income` : "";
    if (sp && ip) return `${sp} and ${ip}`;
    if (sp) return sp;
    if (ip) return ip;
    return String(ts.length);
  };
  const canNetAdd = !selectedTxns.some((t) => t.account_transfer_group)
    && (selectedNettingGroups.size === 0 ? ungroupedSelected.length >= 2 : selectedNettingGroups.size === 1 && ungroupedSelected.length >= 1);

  const nettingFetch = async (method: "POST" | "PATCH", body: object) => {
    const res = await fetch("/api/transaction_meta/netting_group", { method, headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) }, body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || `Netting group request failed (${res.status})`); }
  };
  const afterNetting = async () => { await invalidateTransactionMeta(); setSelectedIds(new Set()); setNettingAddOpen(false); setNettingRemoveOpen(false); };

  const nettingAddMut = useMutation({
    mutationFn: async () => {
      const ids = ungroupedSelected.map((t) => t.transaction_id);
      const existing = [...selectedNettingGroups][0];
      await (existing
        ? nettingFetch("PATCH", { netting_group: existing, add_ids: ids })
        : nettingFetch("POST", { transaction_ids: ids }));
    },
    onSuccess: afterNetting
  });

  const nettingRemoveMut = useMutation({
    mutationFn: async () => {
      const byGroup = new Map<string, string[]>();
      groupedSelected.forEach((t) => byGroup.set(t.netting_group!, [...(byGroup.get(t.netting_group!) ?? []), t.transaction_id]));
      for (const [netting_group, remove_ids] of byGroup) await nettingFetch("PATCH", { netting_group, remove_ids });
    },
    onSuccess: afterNetting
  });

  const nettingDissolveMut = useMutation({
    mutationFn: async () => {
      for (const netting_group of selectedNettingGroups) await nettingFetch("PATCH", { netting_group, dissolve: true });
    },
    onSuccess: afterNetting
  });

  const applySingle = async (tagId: number) => {
    const tag = tags.find((t) => t.id === tagId);
    if (!tag) return;
    const ids = [...selectedIds];
    if (!ids.length) return;
    const items: TagChange[] = ids.map((transaction_id) => {
      const it: TagChange = { transaction_id };
      if (tag.type === "meta") {
        const txn = selectable.find((t) => t.transaction_id === transaction_id);
        it.meta_tag_ids = [...new Set([...(txn?.meta_tag_ids ?? []), tag.id])];
      } else if (tag.type === "income_bucket_2" || tag.type === "spending_bucket_2") it.bucket_2_tag_id = tag.id;
      else it.bucket_1_tag_id = tag.id;
      return it;
    });
    await applyMut.mutateAsync(items);
    setSelectedIds(new Set<string>());
    setApplyOpen(false);
  };

  const removeOne = async (tagId: number) => {
    const items: TagChange[] = [...selectedIds].flatMap((transaction_id) => {
      const txn = selectable.find((t) => t.transaction_id === transaction_id);
      if (!txn) return [];
      const it: TagChange = { transaction_id };
      if (txn.bucket_1_tag_id === tagId) it.bucket_1_tag_id = tagId;
      if (txn.bucket_2_tag_id === tagId) it.bucket_2_tag_id = tagId;
      if ((txn.meta_tag_ids ?? []).includes(tagId)) it.meta_tag_ids = [tagId];
      return it.bucket_1_tag_id != null || it.bucket_2_tag_id != null || it.meta_tag_ids != null ? [it] : [];
    });
    if (!items.length) return;
    const res = await fetch("/api/transaction_meta/tags", { method: "DELETE", headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) }, body: JSON.stringify(items) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(friendlyError(d?.error || `Failed to remove tag (${res.status})`)); }
    await invalidateTransactionMeta();
    setSelectedIds(new Set<string>());
    setRemoveOpen(false);
  };

  const clearAll = async () => {
    const items: TagChange[] = [...selectedIds].flatMap((transaction_id) => {
      const txn = selectable.find((t) => t.transaction_id === transaction_id);
      if (!txn) return [];
      const bucket: number[] = [];
      if (txn.bucket_1_tag_id != null) bucket.push(txn.bucket_1_tag_id);
      if (txn.bucket_2_tag_id != null) bucket.push(txn.bucket_2_tag_id);
      const meta = txn.meta_tag_ids ?? [];
      if (!bucket.length && !meta.length) return [];
      const ub = [...new Set(bucket)];
      return [{ transaction_id, bucket_1_tag_id: ub[0], bucket_2_tag_id: ub[1], meta_tag_ids: [...new Set(meta)] }];
    });
    if (!items.length) { setRemoveOpen(false); return; }
    const res = await fetch("/api/transaction_meta/tags", { method: "DELETE", headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) }, body: JSON.stringify(items) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(friendlyError(d?.error || `Failed to clear tags (${res.status})`)); }
    await invalidateTransactionMeta();
    setSelectedIds(new Set<string>());
    setRemoveOpen(false);
  };

  const errorMsg = tagsError?.message || (createMut.error as Error | null)?.message || (updateMut.error as Error | null)?.message || (deleteMut.error as Error | null)?.message;
  const applyErr = (applyMut.error as Error | null)?.message || (nettingAddMut.error as Error | null)?.message || (nettingRemoveMut.error as Error | null)?.message || (nettingDissolveMut.error as Error | null)?.message;

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Transactions</h1>
          <p className="desc">View, filter, and tag your transactions.</p>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => { void handleSync(); }} disabled={loadingTxns}>
            {!canSync && !loadingTxns && <LockIcon />}
            {loadingTxns ? "Syncing…" : "Sync transactions"}
          </button>
          <InfoTip text={SYNC_HELP} />
          <span className="small muted">{syncStatus}</span>
        </div>
      </header>

      <div className="tabs">
        <button className={tab === "tag-transactions" ? "active" : ""} onClick={() => setTab("tag-transactions")}>Tag transactions</button>
        <button className={tab === "my-tags" ? "active" : ""} onClick={() => setTab("my-tags")}>My tags</button>
      </div>

      {tab === "my-tags" && (
        <>
          <div className="row-flex gap-2 mb-4">
            {!creating ? (
              <>
                <button className="btn primary" onClick={() => setCreating(true)}>+ New tag</button>
                <button className={`btn ${editingId !== null ? "ghost active" : "ghost"}`} onClick={() => setEditingId(editingId == null ? -1 : null)}>{editingId == null ? "Edit tags" : "Done editing"}</button>
                <button className={`btn ${deleting ? "danger" : "ghost"}`} onClick={() => setDeleting((d) => !d)}>{deleting ? "Done deleting" : "Delete tags"}</button>
              </>
            ) : (
              <div className="card card-tight" style={{ flex: 1, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div className="field" style={{ flex: "1 1 160px" }}>
                  <label>Name</label>
                  <input className="input input-sm" value={createName} onChange={(e) => setCreateName(e.target.value)} autoFocus placeholder="Tag name" />
                </div>
                <div className="field" style={{ flex: "0 0 160px" }}>
                  <label>Type <InfoTip text={KIND_INFO[createKind]} /></label>
                  <select className="select input-sm" value={createKind} onChange={(e) => setCreateKind(e.target.value as TagKind)}>
                    {(Object.keys(KIND_LABEL) as TagKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                  </select>
                </div>
                <div className="field" style={{ flex: "1 1 220px" }}>
                  <label>Color</label>
                  <ColorPicker value={createColor} onChange={setCreateColor} />
                </div>
                <button className="btn primary btn-sm" disabled={!createName.trim() || createMut.isPending} onClick={() => createMut.mutate()}>{createMut.isPending ? "Creating…" : "Create"}</button>
                <button className="btn ghost btn-sm" onClick={() => { setCreating(false); setCreateName(""); }}>Cancel</button>
              </div>
            )}
          </div>

          {errorMsg && <div className="mb-3"><Alert tone="danger">{errorMsg}</Alert></div>}

          {tagsLoading ? <LoadingSpinner message="Loading tags..." /> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "var(--s4)" }}>
              {([
                { label: "Meta tags", list: metaTags, blurb: "Meta tags apply to either spending or income. Multiple per transaction." },
                { label: "Spending tags", list: spendingTags, blurb: "Spending tags apply only to outflows. One per transaction." },
                { label: "Income tags", list: incomeTags, blurb: "Income tags apply only to inflows. One per transaction." }
              ] as const).map(({ label, list, blurb }) => (
                <div key={label} className="card card-tight">
                  <div className="between mb-2">
                    <span className="fw-semi">{label}</span>
                    <span className="chip">{list.length}</span>
                  </div>
                  <p className="xs muted mb-3" style={{ lineHeight: 1.4 }}>{blurb}</p>
                  {list.length === 0 ? <div className="muted xs">None yet.</div> : (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {list.map((tag) => (
                        <li key={tag.id} className="between" style={{ padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                          {editingId === tag.id ? (
                            <div style={{ width: "100%" }}>
                              <input className="input input-sm mb-2" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                              <div className="between gap-2">
                                <ColorPicker value={editColor} onChange={setEditColor} size={22} />
                                <div className="row-flex gap-2">
                                  <button className="btn primary btn-sm" disabled={!editName.trim() || updateMut.isPending} onClick={() => updateMut.mutate({ id: tag.id, name: editName, color: editColor })}>Save</button>
                                  <button className="btn ghost btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <TagBadge tag={tag} />
                              <div className="row-flex gap-2">
                                {editingId != null && !deleting && (
                                  <button className="btn ghost btn-sm" onClick={() => { setEditingId(tag.id); setEditName(tag.name); setEditColor(getDisplayTagColor(tag.type, tag.color)); }}>Edit</button>
                                )}
                                {deleting && (
                                  <button className="btn danger-ghost btn-sm" disabled={deleteMut.isPending} onClick={() => deleteMut.mutate(tag.id)}>Delete</button>
                                )}
                              </div>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "tag-transactions" && (
        <div className="txn-tag-layout">
          <div style={{ minWidth: 0 }}>
            <TransactionsFilterSection filters={filters} tags={tags} />
          </div>
          <div>
            <div className="row-flex between mb-3 flex-wrap gap-2">
              <div className="row-flex gap-1">
                {(Object.keys(MODE_LABEL) as TableMode[]).map((m) => (
                  <button key={m} className={`btn btn-sm ${mode === m ? "primary" : "ghost"}`} onClick={() => setMode(m)}>{MODE_LABEL[m]}</button>
                ))}
              </div>
              {mode === "netting" && (
                <div className="row-flex gap-2">
                  <div style={{ position: "relative" }}>
                    <button ref={setNettingAddBtn} className="btn primary btn-sm" disabled={!canNetAdd || nettingAddMut.isPending} onClick={() => { setNettingAddOpen((o) => !o); setNettingRemoveOpen(false); }}>
                      Add Netting Group
                    </button>
                    <Popover anchor={nettingAddBtn} open={nettingAddOpen} onClose={() => setNettingAddOpen(false)} width={320}>
                      <div className="xs muted" style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", overflowWrap: "anywhere" }}>
                        {selectedNettingGroups.size === 1 ? "Add to the selected existing group" : "Create a new netting group"}
                      </div>
                      <button className="btn ghost btn-block" style={{ padding: "10px 12px", borderRadius: 0, justifyContent: "flex-start", borderColor: "transparent", overflowWrap: "anywhere" }} disabled={nettingAddMut.isPending} onClick={() => nettingAddMut.mutate()}>
                        {selectedNettingGroups.size === 1
                          ? `Add ${nettingSidePhrase(ungroupedSelected)} to existing group`
                          : `Group ${nettingSidePhrase(ungroupedSelected)}`}
                      </button>
                    </Popover>
                  </div>
                  <div style={{ position: "relative" }}>
                    <button ref={setNettingRemoveBtn} className="btn ghost btn-sm" disabled={selectedNettingGroups.size === 0 || nettingRemoveMut.isPending || nettingDissolveMut.isPending} onClick={() => { setNettingRemoveOpen((o) => !o); setNettingAddOpen(false); }}>
                      Remove from group
                    </button>
                    <Popover anchor={nettingRemoveBtn} open={nettingRemoveOpen} onClose={() => setNettingRemoveOpen(false)} width={320}>
                      <button className="btn ghost btn-block" style={{ padding: "10px 12px", borderRadius: 0, justifyContent: "flex-start", borderColor: "transparent", overflowWrap: "anywhere" }} disabled={nettingRemoveMut.isPending} onClick={() => nettingRemoveMut.mutate()}>
                        {`Remove ${nettingSidePhrase(groupedSelected)} from ${selectedNettingGroups.size} group${selectedNettingGroups.size !== 1 ? "s" : ""}`}
                      </button>
                      <div style={{ borderTop: "1px solid var(--line)" }} />
                      <button className="btn ghost btn-block" style={{ padding: "10px 12px", borderRadius: 0, justifyContent: "flex-start", borderColor: "transparent", color: "var(--danger)", overflowWrap: "anywhere" }} disabled={nettingDissolveMut.isPending} onClick={() => nettingDissolveMut.mutate()}>
                        {`Dissolve ${selectedNettingGroups.size} group${selectedNettingGroups.size !== 1 ? "s" : ""}`}
                      </button>
                    </Popover>
                  </div>
                </div>
              )}
              {mode === "tagging" && <div className="row-flex gap-2">
                <div style={{ position: "relative" }}>
                  <button ref={setApplyBtn} className="btn primary btn-sm" disabled={!taggingMode || selectedIds.size === 0 || applyMut.isPending} onClick={() => { setApplyOpen((o) => !o); setRemoveOpen(false); }}>
                    Apply tag
                  </button>
                  <Popover anchor={applyBtn} open={applyOpen} onClose={() => setApplyOpen(false)} width={300}>
                    <div className="xs muted" style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)" }}>Apply to {selectedIds.size} transaction{selectedIds.size !== 1 ? "s" : ""}</div>
                    <div className="scrollbox">
                      {tags.length === 0 ? <div className="muted xs pad-3">No tags yet.</div>
                        : sortMetaSpendingIncome(tags).map((t) => (
                          <button key={t.id} className="btn ghost btn-block" style={{ padding: 0, borderRadius: 0, justifyContent: "stretch", borderColor: "transparent" }} onClick={() => applySingle(t.id)}>
                            <TagRow tag={t} />
                          </button>
                        ))
                      }
                    </div>
                  </Popover>
                </div>
                <div style={{ position: "relative" }}>
                  <button ref={setRemoveBtn} className="btn ghost btn-sm" disabled={!taggingMode || selectedIds.size === 0 || applyMut.isPending} onClick={() => { setRemoveOpen((o) => !o); setApplyOpen(false); }}>
                    Remove tag
                  </button>
                  <Popover anchor={removeBtn} open={removeOpen} onClose={() => setRemoveOpen(false)} width={300}>
                    <div className="xs muted" style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)" }}>Remove from {selectedIds.size} transaction{selectedIds.size !== 1 ? "s" : ""}</div>
                    <button className="btn ghost btn-block" style={{ padding: "10px 12px", borderRadius: 0, justifyContent: "flex-start", borderColor: "transparent", color: "var(--danger)" }} onClick={clearAll}>
                      Clear all tags
                    </button>
                    {tagsOnSelected.length > 0 && <div style={{ borderTop: "1px solid var(--line)" }} />}
                    <div className="scrollbox">
                      {tagsOnSelected.length === 0 ? <div className="muted xs pad-3">No tags on selected transactions.</div>
                        : tagsOnSelected.map((t) => (
                          <button key={t.id} className="btn ghost btn-block" style={{ padding: 0, borderRadius: 0, justifyContent: "stretch", borderColor: "transparent" }} onClick={() => removeOne(t.id)}>
                            <TagRow tag={t} />
                          </button>
                        ))
                      }
                    </div>
                  </Popover>
                </div>
              </div>}
            </div>

            <AppliedFiltersBar filters={filters} />
            {applyErr && <div className="mb-3"><Alert tone="danger">{applyErr}</Alert></div>}

            {loadingTxns ? <LoadingSpinner /> : (
              <TransactionTable
                transactions={selectionActive ? selectable : filters.derived.filteredTransactions}
                taggingMode={selectionActive}
                nettingMode={mode === "netting"}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                tags={tags}
              />
            )}
          </div>
        </div>
      )}

      <PaywallModal open={!!paywallReason} reason={paywallReason} onClose={() => setPaywallReason(null)} />
    </>
  );
}

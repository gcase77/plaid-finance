import { useState } from "react";
import type { Tag, TagType } from "./types";

type BucketsTabProps = {
  tags: Tag[];
  loading: boolean;
  createTag: (name: string, type: TagType) => Promise<Tag>;
  renameTag: (id: number, name: string) => Promise<Tag>;
  deleteTag: (id: number) => Promise<void>;
};

const TYPE_GROUPS: { type: TagType; label: string; dir: "income" | "spending" | "meta" }[] = [
  { type: "income_bucket_1", label: "Income — Level 1", dir: "income" },
  { type: "income_bucket_2", label: "Income — Level 2", dir: "income" },
  { type: "spending_bucket_1", label: "Spending — Level 1", dir: "spending" },
  { type: "spending_bucket_2", label: "Spending — Level 2", dir: "spending" },
  { type: "meta", label: "Meta", dir: "meta" }
];

const DIR_BADGE: Record<string, string> = {
  income: "bg-success",
  spending: "bg-danger",
  meta: "bg-info text-dark"
};

export default function BucketsTab({ tags, loading, createTag, renameTag, deleteTag }: BucketsTabProps) {
  const [newNames, setNewNames] = useState<Record<TagType, string>>({} as Record<TagType, string>);
  const [creating, setCreating] = useState<TagType | null>(null);
  const [createError, setCreateError] = useState<Record<TagType, string>>({} as Record<TagType, string>);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<Record<number, string>>({});

  const handleCreate = async (type: TagType) => {
    const name = (newNames[type] || "").trim();
    if (!name) return;
    setCreating(type);
    setCreateError((prev) => ({ ...prev, [type]: "" }));
    try {
      await createTag(name, type);
      setNewNames((prev) => ({ ...prev, [type]: "" }));
    } catch (e: any) {
      setCreateError((prev) => ({ ...prev, [type]: e.message }));
    } finally {
      setCreating(null);
    }
  };

  const startEdit = (tag: Tag) => { setEditingId(tag.id); setEditName(tag.name); setEditError(null); };

  const handleRename = async (id: number) => {
    const name = editName.trim();
    if (!name) return;
    setEditError(null);
    try {
      await renameTag(id, name);
      setEditingId(null);
    } catch (e: any) {
      setEditError(e.message);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    setDeleteError((prev) => ({ ...prev, [id]: "" }));
    try {
      await deleteTag(id);
    } catch (e: any) {
      setDeleteError((prev) => ({ ...prev, [id]: e.message }));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="text-muted">Loading buckets...</div>;

  return (
    <div className="row g-3">
      {TYPE_GROUPS.map(({ type, label, dir }) => {
        const groupTags = tags.filter((t) => t.type === type);
        return (
          <div className="col-md-6 col-xl-4" key={type}>
            <div className="border rounded p-3 h-100">
              <div className="d-flex align-items-center mb-2 gap-2">
                <span className={`badge ${DIR_BADGE[dir]}`}>{label}</span>
              </div>
              <ul className="list-unstyled mb-2">
                {groupTags.length === 0 && <li className="text-muted small">No buckets yet</li>}
                {groupTags.map((tag) => (
                  <li key={tag.id} className="mb-1">
                    {editingId === tag.id ? (
                      <div className="d-flex gap-1">
                        <input
                          className="form-control form-control-sm"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleRename(tag.id); if (e.key === "Escape") setEditingId(null); }}
                          autoFocus
                        />
                        <button className="btn btn-sm btn-primary" onClick={() => handleRename(tag.id)}>Save</button>
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div className="d-flex align-items-center gap-1">
                        <span className="flex-grow-1 small">{tag.name}</span>
                        <button className="btn btn-link btn-sm p-0 text-secondary" title="Rename" onClick={() => startEdit(tag)}>✏️</button>
                        <button className="btn btn-link btn-sm p-0 text-danger" title="Delete" onClick={() => handleDelete(tag.id)} disabled={deletingId === tag.id}>🗑</button>
                      </div>
                    )}
                    {editingId === tag.id && editError && <div className="text-danger small mt-1">{editError}</div>}
                    {deleteError[tag.id] && <div className="text-danger small mt-1">{deleteError[tag.id]}</div>}
                  </li>
                ))}
              </ul>
              <div className="d-flex gap-1">
                <input
                  className="form-control form-control-sm"
                  placeholder="New bucket name"
                  value={newNames[type] || ""}
                  onChange={(e) => setNewNames((prev) => ({ ...prev, [type]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(type); }}
                />
                <button className="btn btn-sm btn-outline-primary" onClick={() => handleCreate(type)} disabled={creating === type || !(newNames[type] || "").trim()}>
                  {creating === type ? "..." : "Add"}
                </button>
              </div>
              {createError[type] && <div className="text-danger small mt-1">{createError[type]}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

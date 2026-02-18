import { useState } from "react";
import type { Tag } from "../types";

type TaggingActionBarProps = {
  selectedCount: number;
  tags: Tag[];
  onApply: (args: { bucket_1_tag_id?: number | null; bucket_2_tag_id?: number | null; meta_tag_id?: number | null }) => Promise<void>;
  onClearSelection: () => void;
};

export default function TaggingActionBar({ selectedCount, tags, onApply, onClearSelection }: TaggingActionBarProps) {
  const [bucket1Id, setBucket1Id] = useState<string>("");
  const [bucket2Id, setBucket2Id] = useState<string>("");
  const [metaId, setMetaId] = useState<string>("");
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bucket1Tags = tags.filter((t) => t.type === "income_bucket_1" || t.type === "spending_bucket_1");
  const selectedB1 = bucket1Id ? tags.find((t) => t.id === Number(bucket1Id)) : null;
  const bucket2Tags = tags.filter((t) => {
    if (!selectedB1) return t.type === "income_bucket_2" || t.type === "spending_bucket_2";
    const dir = selectedB1.type.startsWith("income") ? "income" : "spending";
    return t.type === `${dir}_bucket_2`;
  });
  const metaTags = tags.filter((t) => t.type === "meta");

  const handleApply = async () => {
    setApplying(true);
    setError(null);
    try {
      await onApply({
        bucket_1_tag_id: bucket1Id ? Number(bucket1Id) : null,
        bucket_2_tag_id: bucket2Id ? Number(bucket2Id) : null,
        meta_tag_id: metaId ? Number(metaId) : null
      });
      setBucket1Id("");
      setBucket2Id("");
      setMetaId("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setApplying(false);
    }
  };

  const handleRemoveTags = async () => {
    setApplying(true);
    setError(null);
    try {
      await onApply({ bucket_1_tag_id: null, bucket_2_tag_id: null, meta_tag_id: null });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="border rounded p-2 mb-2 bg-body-secondary">
      <div className="d-flex flex-wrap align-items-center gap-2">
        <span className="fw-semibold small">{selectedCount} selected</span>
        <select className="form-select form-select-sm" style={{ width: "auto" }} value={bucket1Id} onChange={(e) => { setBucket1Id(e.target.value); setBucket2Id(""); }}>
          <option value="">Bucket 1 (clear)</option>
          {bucket1Tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="form-select form-select-sm" style={{ width: "auto" }} value={bucket2Id} onChange={(e) => setBucket2Id(e.target.value)} disabled={!bucket1Id && bucket2Tags.length === 0}>
          <option value="">Bucket 2 (clear)</option>
          {bucket2Tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="form-select form-select-sm" style={{ width: "auto" }} value={metaId} onChange={(e) => setMetaId(e.target.value)}>
          <option value="">Meta (clear)</option>
          {metaTags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={handleApply} disabled={applying || (!bucket1Id && !metaId)}>
          {applying ? "Applying..." : "Apply"}
        </button>
        <button className="btn btn-outline-danger btn-sm" onClick={handleRemoveTags} disabled={applying}>Remove tags</button>
        <button className="btn btn-outline-secondary btn-sm" onClick={onClearSelection}>Clear selection</button>
      </div>
      {error && <div className="text-danger small mt-1">{error}</div>}
    </div>
  );
}

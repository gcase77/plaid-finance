import { useState, useCallback } from "react";
import type { Tag, TagType } from "../components/types";

const parseErrorResponse = async (res: Response, fallback: string): Promise<string> => {
  try {
    const text = await res.text();
    try { return JSON.parse(text).error || fallback; } catch { return fallback; }
  } catch { return fallback; }
};

type UseTagsReturn = {
  tags: Tag[];
  loading: boolean;
  error: string | null;
  loadTags: () => Promise<void>;
  createTag: (name: string, type: TagType) => Promise<Tag>;
  renameTag: (id: number, name: string) => Promise<Tag>;
  deleteTag: (id: number) => Promise<void>;
  applyTags: (args: {
    transaction_ids: string[];
    bucket_1_tag_id?: number | null;
    bucket_2_tag_id?: number | null;
    meta_tag_id?: number | null;
  }) => Promise<void>;
};

export function useTags(token: string | null, runtimeAuthMode: "supabase" | "dev", onTransactionsInvalidated?: () => void): UseTagsReturn {
  const authHeaders = (token: string | null) =>
    token
      ? runtimeAuthMode === "dev"
        ? { "x-dev-user-id": token }
        : { Authorization: `Bearer ${token}` }
      : {};

  const apiFetch = (url: string, options?: RequestInit) =>
    fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...authHeaders(token), ...options?.headers }
    });
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/tags");
      if (!res.ok) throw new Error(await parseErrorResponse(res, "Failed to load tags"));
      setTags(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, runtimeAuthMode]);

  const createTag = useCallback(async (name: string, type: TagType): Promise<Tag> => {
    const res = await apiFetch("/api/tags", { method: "POST", body: JSON.stringify({ name, type }) });
    if (!res.ok) throw new Error(await parseErrorResponse(res, "Failed to create tag"));
    const tag = await res.json();
    setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
    return tag;
  }, [token, runtimeAuthMode]);

  const renameTag = useCallback(async (id: number, name: string): Promise<Tag> => {
    const res = await apiFetch(`/api/tags/${id}`, { method: "PATCH", body: JSON.stringify({ name }) });
    if (!res.ok) throw new Error(await parseErrorResponse(res, "Failed to rename tag"));
    const tag = await res.json();
    setTags((prev) => prev.map((t) => (t.id === id ? tag : t)).sort((a, b) => a.name.localeCompare(b.name)));
    return tag;
  }, [token, runtimeAuthMode]);

  const deleteTag = useCallback(async (id: number): Promise<void> => {
    const res = await apiFetch(`/api/tags/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await parseErrorResponse(res, "Failed to delete tag"));
    setTags((prev) => prev.filter((t) => t.id !== id));
  }, [token, runtimeAuthMode]);

  const applyTags = useCallback(async (args: {
    transaction_ids: string[];
    bucket_1_tag_id?: number | null;
    bucket_2_tag_id?: number | null;
    meta_tag_id?: number | null;
  }): Promise<void> => {
    const res = await apiFetch("/api/transactions/tag", { method: "PUT", body: JSON.stringify(args) });
    if (!res.ok) throw new Error(await parseErrorResponse(res, "Failed to apply tags"));
    onTransactionsInvalidated?.();
  }, [token, runtimeAuthMode, onTransactionsInvalidated]);

  return { tags, loading, error, loadTags, createTag, renameTag, deleteTag, applyTags };
}

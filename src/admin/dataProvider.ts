import type { DataProvider, DeleteParams, GetListParams, RaRecord, UpdateParams } from "react-admin";
import { buildAuthHeaders } from "../lib/auth";
import { supabase } from "../lib/supabase";

type JsonObject = Record<string, unknown>;

const getToken = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
};

const apiFetch = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
  const token = await getToken();
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
    ...buildAuthHeaders(token)
  };
  const response = await fetch(url, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error((payload as { error?: string })?.error || `API request failed (${response.status})`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return payload as T;
};

const toArray = (payload: unknown): JsonObject[] => Array.isArray(payload) ? payload as JsonObject[] : [];
const withId = (record: JsonObject): RaRecord => ({ ...record, id: String(record.id ?? record.transaction_id ?? crypto.randomUUID()) });
const page = <T>(records: T[], params: GetListParams): T[] => {
  const { page: currentPage = 1, perPage = records.length || 25 } = params.pagination || {};
  const start = (currentPage - 1) * perPage;
  return records.slice(start, start + perPage);
};
const sortRecords = (records: RaRecord[], params: GetListParams): RaRecord[] => {
  const { field, order } = params.sort || {};
  if (!field) return records;
  return [...records].sort((a, b) => {
    const left = a[field];
    const right = b[field];
    if (left == null && right == null) return 0;
    if (left == null) return order === "ASC" ? -1 : 1;
    if (right == null) return order === "ASC" ? 1 : -1;
    return String(left).localeCompare(String(right), undefined, { numeric: true }) * (order === "ASC" ? 1 : -1);
  });
};

const endpoints: Record<string, string> = {
  items: "/api/items",
  tags: "/api/tags",
  transactions: "/api/transactions",
  transaction_meta: "/api/transaction_meta",
  budget_rules: "/api/budget_rules"
};

const listAccounts = async (params: GetListParams) => {
  const items = toArray(await apiFetch("/api/items"));
  const accounts = (await Promise.all(items.map(async (item) => {
    const itemId = String(item.id);
    const rows = toArray(await apiFetch(`/api/${encodeURIComponent(itemId)}/accounts`));
    return rows.map((row) => ({ ...row, item_id: itemId, institution_name: item.institution_name }));
  }))).flat();
  const data = sortRecords(accounts.map(withId), params);
  return { data: page(data, params), total: data.length };
};

export const dataProvider: DataProvider = {
  getList: async (resource, params) => {
    if (resource === "accounts") return listAccounts(params);
    const endpoint = endpoints[resource];
    if (!endpoint) throw new Error(`${resource} is not configured in the API data provider`);
    const payload = toArray(await apiFetch(endpoint));
    const data = sortRecords(payload.map(withId), params);
    return { data: page(data, params), total: data.length };
  },
  getOne: async (resource, params) => {
    const list = await dataProvider.getList(resource, { pagination: { page: 1, perPage: 10000 }, sort: { field: "id", order: "ASC" }, filter: {} });
    const record = list.data.find((row) => String(row.id) === String(params.id));
    if (!record) throw new Error(`${resource} record not found`);
    return { data: record };
  },
  getMany: async (resource, params) => {
    const list = await dataProvider.getList(resource, { pagination: { page: 1, perPage: 10000 }, sort: { field: "id", order: "ASC" }, filter: {} });
    return { data: list.data.filter((row) => params.ids.map(String).includes(String(row.id))) };
  },
  getManyReference: async (resource, params) => dataProvider.getList(resource, params),
  create: async (resource, params) => {
    if (resource !== "tags" && resource !== "budget_rules") throw new Error(`${resource} does not support create`);
    const data = await apiFetch<RaRecord>(endpoints[resource], { method: "POST", body: JSON.stringify(params.data) });
    return { data: withId(data) };
  },
  update: async (resource, params: UpdateParams) => {
    if (resource !== "budget_rules") throw new Error(`${resource} does not support update`);
    const data = await apiFetch<RaRecord>(`${endpoints[resource]}/${encodeURIComponent(String(params.id))}`, {
      method: "PATCH",
      body: JSON.stringify(params.data)
    });
    return { data: withId(data) };
  },
  updateMany: async (resource, params) => {
    await Promise.all(params.ids.map((id) => dataProvider.update(resource, { id, data: params.data, previousData: undefined } as UpdateParams)));
    return { data: params.ids };
  },
  delete: async (resource, params: DeleteParams) => {
    if (resource === "tags" || resource === "budget_rules") {
      await apiFetch(`${endpoints[resource]}/${encodeURIComponent(String(params.id))}`, { method: "DELETE" });
      return { data: (params.previousData || { id: params.id }) as RaRecord };
    }
    if (resource === "items") {
      await apiFetch(`/api/items/${encodeURIComponent(String(params.id))}/delete_all`, { method: "POST" });
      return { data: (params.previousData || { id: params.id }) as RaRecord };
    }
    throw new Error(`${resource} does not support delete`);
  },
  deleteMany: async (resource, params) => {
    await Promise.all(params.ids.map((id) => dataProvider.delete(resource, { id, previousData: undefined } as DeleteParams)));
    return { data: params.ids };
  }
};

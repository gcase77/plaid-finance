import type { DataProvider, DeleteParams, RaRecord, UpdateParams } from "react-admin";
import { getAccessToken } from "./authProvider";

const API_ROOT = "/api";

const RESOURCE_PATHS: Record<string, string> = {
  accounts: "accounts",
  budget_rules: "budget_rules",
  items: "items",
  tags: "tags",
  transactions: "transactions",
  transaction_meta: "transaction_meta"
};

const readOnlyResources = new Set(["accounts", "transactions", "transaction_meta"]);

const pathFor = (resource: string) => RESOURCE_PATHS[resource] ?? resource;

const normalizeRecord = <RecordType extends RaRecord = RaRecord>(record: Record<string, unknown>): RecordType => ({
  id: record.id ?? record.transaction_id,
  ...record
}) as RecordType;

const httpJson = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
  const token = await getAccessToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error || `API request failed (${response.status})`) as Error & { status?: number; body?: unknown };
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body as T;
};

const fetchList = async <RecordType extends RaRecord = RaRecord>(resource: string) => {
  const rows = await httpJson<Record<string, unknown>[]>(`${API_ROOT}/${pathFor(resource)}`);
  return Array.isArray(rows) ? rows.map((row) => normalizeRecord<RecordType>(row)) : [];
};

const updateRecord = async (resource: string, params: UpdateParams) => {
  if (readOnlyResources.has(resource)) throw new Error(`${resource} is read-only in the admin UI.`);
  const data = await httpJson<Record<string, unknown>>(`${API_ROOT}/${pathFor(resource)}/${encodeURIComponent(String(params.id))}`, {
    method: "PATCH",
    body: JSON.stringify(params.data)
  });
  return { data: normalizeRecord(data) };
};

const deleteRecord = async (resource: string, params: DeleteParams) => {
  const id = encodeURIComponent(String(params.id));
  const url = resource === "items"
    ? `${API_ROOT}/items/${id}/delete_all`
    : `${API_ROOT}/${pathFor(resource)}/${id}`;
  const method = resource === "items" ? "POST" : "DELETE";
  await httpJson(url, { method });
  return { data: params.previousData ?? ({ id: params.id } as RaRecord) };
};

export const dataProvider: DataProvider = {
  async getList(resource, params) {
    const data = await fetchList(resource);
    const { field = "id", order = "ASC" } = params.sort ?? {};
    const sorted = [...data].sort((a, b) => {
      const left = a[field];
      const right = b[field];
      if (left == null && right == null) return 0;
      if (left == null) return 1;
      if (right == null) return -1;
      return String(left).localeCompare(String(right), undefined, { numeric: true }) * (order === "DESC" ? -1 : 1);
    });
    const { page = 1, perPage = 25 } = params.pagination ?? {};
    const start = (page - 1) * perPage;
    return { data: sorted.slice(start, start + perPage), total: sorted.length };
  },

  async getOne(resource, params) {
    const data = await fetchList(resource);
    const record = data.find((row) => String(row.id) === String(params.id));
    if (!record) {
      const error = new Error(`${resource} record not found`) as Error & { status?: number };
      error.status = 404;
      throw error;
    }
    return { data: record };
  },

  async getMany(resource, params) {
    const ids = new Set(params.ids.map(String));
    const data = (await fetchList(resource)).filter((row) => ids.has(String(row.id)));
    return { data };
  },

  async getManyReference(resource, params) {
    const data = (await fetchList(resource)).filter((row) => String(row[params.target]) === String(params.id));
    return { data, total: data.length };
  },

  async create(resource, params) {
    if (readOnlyResources.has(resource)) throw new Error(`${resource} is read-only in the admin UI.`);
    const data = await httpJson<Record<string, unknown>>(`${API_ROOT}/${pathFor(resource)}`, {
      method: "POST",
      body: JSON.stringify(params.data)
    });
    return { data: normalizeRecord(data) };
  },

  update: updateRecord,

  async updateMany(resource, params) {
    const responses = await Promise.all(params.ids.map((id) => updateRecord(resource, { ...params, id })));
    return { data: responses.map((response) => response.data.id) };
  },

  delete: deleteRecord,

  async deleteMany(resource, params) {
    const responses = await Promise.all(params.ids.map((id) => deleteRecord(resource, { id, previousData: { id } as RaRecord })));
    return { data: responses.map((response) => response.data.id) };
  }
};

export const apiAction = async <T>(path: string, options: RequestInit = {}) => {
  const query = path.startsWith("/") ? path : `/${path}`;
  return httpJson<T>(`${API_ROOT}${query}`, options);
};

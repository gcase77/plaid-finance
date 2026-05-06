import type { DataProvider } from "@refinedev/core";
import { apiClient } from "./apiClient";

type ResourceConfig = {
  endpoint: string;
  idParam?: string;
  deleteMethod?: "DELETE" | "POST";
  deletePath?: (id: string | number) => string;
};

const resources: Record<string, ResourceConfig> = {
  items: {
    endpoint: "/api/items",
    deleteMethod: "POST",
    deletePath: (id) => `/api/items/${encodeURIComponent(String(id))}/delete_all`
  },
  accounts: {
    endpoint: "/api/accounts",
    idParam: "itemId"
  },
  transactions: {
    endpoint: "/api/transactions"
  },
  transaction_meta: {
    endpoint: "/api/transaction_meta"
  },
  tags: {
    endpoint: "/api/tags"
  },
  budget_rules: {
    endpoint: "/api/budget_rules"
  }
};

function getResourceConfig(resource: string): ResourceConfig {
  const config = resources[resource];
  if (!config) throw new Error(`Unknown API resource: ${resource}`);
  return config;
}

function withQuery(path: string, query?: Record<string, unknown>): string {
  if (!query) return path;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

function getEndpoint(resource: string, meta?: Record<string, unknown>): string {
  const config = getResourceConfig(resource);
  if (resource === "accounts") {
    const itemId = meta?.itemId;
    if (!itemId) throw new Error("accounts resource requires meta.itemId");
    return `/api/${encodeURIComponent(String(itemId))}/accounts`;
  }
  return config.endpoint;
}

export const dataProvider: DataProvider = {
  getList: async ({ resource, meta }) => {
    const endpoint = getEndpoint(resource, meta as Record<string, unknown> | undefined);
    const data = await apiClient<unknown[]>(withQuery(endpoint, meta?.query as Record<string, unknown> | undefined));
    return { data, total: Array.isArray(data) ? data.length : 0 };
  },
  getOne: async ({ resource, id, meta }) => {
    const listEndpoint = getEndpoint(resource, meta as Record<string, unknown> | undefined);
    const endpoint = resource === "accounts" ? `${listEndpoint}/${encodeURIComponent(String(id))}` : `${listEndpoint}/${encodeURIComponent(String(id))}`;
    const data = await apiClient<Record<string, unknown>>(endpoint);
    return { data };
  },
  create: async ({ resource, variables, meta }) => {
    const data = await apiClient<Record<string, unknown>>(getEndpoint(resource, meta as Record<string, unknown> | undefined), {
      method: "POST",
      body: variables as Record<string, unknown>
    });
    return { data };
  },
  update: async ({ resource, id, variables, meta }) => {
    const endpoint = `${getEndpoint(resource, meta as Record<string, unknown> | undefined)}/${encodeURIComponent(String(id))}`;
    const data = await apiClient<Record<string, unknown>>(endpoint, {
      method: "PATCH",
      body: variables as Record<string, unknown>
    });
    return { data };
  },
  deleteOne: async ({ resource, id, meta }) => {
    const config = getResourceConfig(resource);
    const endpoint = config.deletePath?.(id) ?? `${getEndpoint(resource, meta as Record<string, unknown> | undefined)}/${encodeURIComponent(String(id))}`;
    const data = await apiClient<Record<string, unknown>>(endpoint, { method: config.deleteMethod ?? "DELETE" });
    return { data };
  },
  custom: async ({ url, method, payload, query, headers }) => {
    const data = await apiClient(withQuery(url, query as Record<string, unknown> | undefined), {
      method: method?.toUpperCase(),
      body: payload as Record<string, unknown> | unknown[] | undefined,
      headers
    });
    return { data };
  },
  getApiUrl: () => "/api"
};

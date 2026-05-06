import { buildAuthHeaders } from "../lib/auth";
import type { DataProvider, HttpMethod } from "./types";

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, "");

const buildUrl = (apiUrl: string, path: string, query?: Record<string, string | number | boolean | null | undefined>) => {
  const normalizedPath = path.startsWith("http") ? path : `${apiUrl}/${trimSlashes(path)}`;
  const url = new URL(normalizedPath, window.location.origin);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") url.searchParams.set(key, String(value));
  });
  return url.pathname + url.search;
};

const request = async <TData, TVariables>(params: {
  apiUrl: string;
  token: string | null;
  url: string;
  method?: HttpMethod;
  query?: Record<string, string | number | boolean | null | undefined>;
  variables?: TVariables;
}): Promise<TData> => {
  const method = params.method ?? "GET";
  const headers: Record<string, string> = {
    ...buildAuthHeaders(params.token)
  };
  if (method !== "GET" && params.variables !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(buildUrl(params.apiUrl, params.url, params.query), {
    method,
    headers,
    body: method === "GET" || params.variables === undefined ? undefined : JSON.stringify(params.variables)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof data?.error === "string" ? data.error : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data as TData;
};

export const createServerDataProvider = (apiUrl: string, token: string | null): DataProvider => ({
  getList: async <TData = unknown>({ resource, query }: { resource: string; query?: Record<string, string | number | boolean | null | undefined> }) => {
    const data = await request<unknown, never>({ apiUrl, token, url: resource, query });
    return Array.isArray(data) ? data as TData[] : [];
  },
  create: <TData = unknown, TVariables = unknown>({ resource, variables }: { resource: string; variables?: TVariables }) =>
    request<TData, TVariables>({ apiUrl, token, url: resource, method: "POST", variables }),
  update: <TData = unknown, TVariables = unknown>({ resource, id, variables }: { resource: string; id: string | number; variables?: TVariables }) =>
    request<TData, TVariables>({ apiUrl, token, url: `${trimSlashes(resource)}/${encodeURIComponent(String(id))}`, method: "PATCH", variables }),
  deleteOne: <TData = unknown>({ resource, id }: { resource: string; id: string | number }) =>
    request<TData, never>({ apiUrl, token, url: `${trimSlashes(resource)}/${encodeURIComponent(String(id))}`, method: "DELETE" }),
  custom: <TData = unknown, TVariables = unknown>({ url, method, query, variables }: { url: string; method?: HttpMethod; query?: Record<string, string | number | boolean | null | undefined>; variables?: TVariables }) =>
    request<TData, TVariables>({ apiUrl, token, url, method, query, variables })
});

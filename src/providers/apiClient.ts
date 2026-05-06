import { buildAuthHeaders } from "../lib/auth";
import { supabase } from "../lib/supabase";

export type ApiClientOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | unknown[] | null;
  token?: string | null;
};

const hasJsonBody = (body: ApiClientOptions["body"]): body is Record<string, unknown> | unknown[] => {
  return body !== null && typeof body === "object" && !(body instanceof FormData) && !(body instanceof URLSearchParams) && !(body instanceof Blob);
};

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function apiClient<T = unknown>(path: string, options: ApiClientOptions = {}): Promise<T> {
  const token = options.token === undefined ? await getAccessToken() : options.token;
  const headers = new Headers(options.headers);
  const body = hasJsonBody(options.body) ? JSON.stringify(options.body) : options.body ?? undefined;

  if (hasJsonBody(options.body) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  Object.entries(buildAuthHeaders(token)).forEach(([key, value]) => headers.set(key, value));

  const response = await fetch(path, {
    ...options,
    body,
    headers
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = typeof data?.error === "string" ? data.error : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data as T;
}

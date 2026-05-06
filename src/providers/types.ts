import type { Session, User } from "@supabase/supabase-js";

export type RefineResource = {
  name: string;
  list?: string;
  create?: string;
  edit?: string;
  show?: string;
  meta?: Record<string, unknown>;
};

export type AuthContextValue = {
  session: Session | null;
  token: string | null;
  user: User | null;
  userId: string | null;
  userEmail: string;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
};

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type DataProvider = {
  getList: <TData = unknown>(params: { resource: string; query?: Record<string, string | number | boolean | null | undefined> }) => Promise<TData[]>;
  create: <TData = unknown, TVariables = unknown>(params: { resource: string; variables?: TVariables }) => Promise<TData>;
  update: <TData = unknown, TVariables = unknown>(params: { resource: string; id: string | number; variables?: TVariables }) => Promise<TData>;
  deleteOne: <TData = unknown>(params: { resource: string; id: string | number }) => Promise<TData>;
  custom: <TData = unknown, TVariables = unknown>(params: {
    url: string;
    method?: HttpMethod;
    query?: Record<string, string | number | boolean | null | undefined>;
    variables?: TVariables;
  }) => Promise<TData>;
};

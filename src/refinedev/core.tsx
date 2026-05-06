/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

export type HttpError = Error & { status?: number; statusCode?: number };

export type AuthProvider = {
  check?: () => Promise<{ authenticated: boolean; redirectTo?: string; logout?: boolean }>;
  getIdentity?: () => Promise<unknown>;
  logout?: () => Promise<{ success: boolean; redirectTo?: string }>;
  onError?: (error: HttpError) => Promise<Record<string, unknown>>;
};

export type DataProvider = {
  getList: <TData = unknown>(params: { resource: string; meta?: Record<string, unknown> }) => Promise<{ data: TData[]; total?: number }>;
  getOne?: <TData = unknown>(params: { resource: string; id: string | number; meta?: Record<string, unknown> }) => Promise<{ data: TData }>;
  create?: <TData = unknown, TVariables = Record<string, unknown>>(params: { resource: string; variables: TVariables; meta?: Record<string, unknown> }) => Promise<{ data: TData }>;
  update?: <TData = unknown, TVariables = Record<string, unknown>>(params: { resource: string; id: string | number; variables: TVariables; meta?: Record<string, unknown> }) => Promise<{ data: TData }>;
  deleteOne?: <TData = unknown>(params: { resource: string; id: string | number; meta?: Record<string, unknown> }) => Promise<{ data: TData }>;
  custom?: <TData = unknown>(params: {
    url: string;
    method?: string;
    payload?: Record<string, unknown> | unknown[];
    query?: Record<string, unknown>;
    headers?: HeadersInit;
  }) => Promise<{ data: TData }>;
  getApiUrl?: () => string;
};

type RefineContextValue = {
  authProvider?: AuthProvider;
  dataProvider: DataProvider;
  resources?: Array<Record<string, unknown>>;
};

const RefineContext = createContext<RefineContextValue | null>(null);

export function Refine({ authProvider, dataProvider, resources, children }: RefineContextValue & { options?: Record<string, unknown>; children: ReactNode }) {
  return (
    <RefineContext.Provider value={{ authProvider, dataProvider, resources }}>
      {children}
    </RefineContext.Provider>
  );
}

export function useDataProvider() {
  const context = useContext(RefineContext);
  if (!context) throw new Error("useDataProvider must be used within <Refine>");
  return () => context.dataProvider;
}

export function useList<TData = unknown>({ resource, meta, queryOptions }: {
  resource: string;
  meta?: Record<string, unknown>;
  queryOptions?: { enabled?: boolean };
}) {
  const getDataProvider = useDataProvider();
  return useQuery({
    queryKey: [resource, "list", meta],
    queryFn: () => getDataProvider().getList<TData>({ resource, meta }),
    enabled: queryOptions?.enabled ?? true
  });
}

import { useMemo, type ReactNode } from "react";
import { useAppAuth } from "./authContext";
import { RefineContext } from "./refineContext";
import { createServerDataProvider } from "./serverDataProvider";
import type { RefineResource } from "./types";

export function Refine({ children, resources, apiUrl = "/api" }: { children: ReactNode; resources: RefineResource[]; apiUrl?: string }) {
  const { token } = useAppAuth();
  const dataProvider = useMemo(() => createServerDataProvider(apiUrl, token), [apiUrl, token]);
  const value = useMemo(() => ({ dataProvider, resources }), [dataProvider, resources]);
  return <RefineContext.Provider value={value}>{children}</RefineContext.Provider>;
}

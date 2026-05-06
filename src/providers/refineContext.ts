import { createContext, useContext } from "react";
import type { DataProvider, RefineResource } from "./types";

type RefineContextValue = {
  dataProvider: DataProvider;
  resources: RefineResource[];
};

export const RefineContext = createContext<RefineContextValue | null>(null);

export const useRefine = () => {
  const context = useContext(RefineContext);
  if (!context) throw new Error("useRefine must be used within Refine");
  return context;
};

export const useRefineDataProvider = () => useRefine().dataProvider;

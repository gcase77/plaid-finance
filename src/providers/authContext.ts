import { createContext, useContext } from "react";
import type { AuthContextValue } from "./types";

export const AuthContext = createContext<AuthContextValue | null>(null);

export const useAppAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAppAuth must be used within AppAuthProvider");
  return context;
};

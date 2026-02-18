export type RuntimeAuthMode = "supabase" | "dev";

export const buildAuthHeaders = (runtimeAuthMode: RuntimeAuthMode, token: string | null): Record<string, string> => {
  if (!token) return {};
  return runtimeAuthMode === "dev" ? { "x-dev-user-id": token } : { Authorization: `Bearer ${token}` };
};

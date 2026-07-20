import { useQuery, useQueryClient } from "@tanstack/react-query";
import { buildAuthHeaders } from "../lib/auth";
import {
  ENTITLEMENTS_QUERY_KEY,
  type Entitlements
} from "../lib/entitlements";

async function fetchEntitlements(token: string | null): Promise<Entitlements> {
  const res = await fetch("/api/entitlements", { headers: buildAuthHeaders(token) });
  if (!res.ok) throw new Error(`Failed to load entitlements (${res.status})`);
  return res.json() as Promise<Entitlements>;
}

export function useEntitlements(token: string | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ENTITLEMENTS_QUERY_KEY,
    queryFn: () => fetchEntitlements(token),
    enabled: !!token
  });

  const invalidateEntitlements = async () => {
    await queryClient.invalidateQueries({ queryKey: ENTITLEMENTS_QUERY_KEY });
  };

  return {
    entitlements: query.data ?? null,
    loading: query.isLoading,
    error: query.error as Error | null,
    invalidateEntitlements,
    canAddBank: query.data?.can_add_bank ?? true,
    canSync: query.data?.can_sync ?? true
  };
}

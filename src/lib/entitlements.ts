export const ENTITLEMENTS_QUERY_KEY = ["entitlements"] as const;

export const PAYMENT_REQUIRED_CODE = "PAYMENT_REQUIRED" as const;

export type Entitlements = {
  access_level: number;
  free_sync_used: boolean;
  items_connected: number;
  can_add_bank: boolean;
  can_sync: boolean;
};

export type PaymentRequiredReason = "add_bank" | "sync";

export function isPaymentRequiredPayload(data: unknown): data is {
  code: typeof PAYMENT_REQUIRED_CODE;
  reason?: PaymentRequiredReason;
} {
  return !!data
    && typeof data === "object"
    && (data as { code?: string }).code === PAYMENT_REQUIRED_CODE;
}

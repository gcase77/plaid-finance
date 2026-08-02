import type { UserScopedPrisma } from "./prisma";

/** Free tier. Higher integers are paid/future tiers with no add/sync limits. */
export const ACCESS_LEVEL_FREE = 1;
export const ACCESS_LEVEL_PAID = 2;

export const PAYMENT_REQUIRED_CODE = "PAYMENT_REQUIRED" as const;

export type Entitlements = {
  access_level: number;
  free_sync_used: boolean;
  items_connected: number;
  can_add_bank: boolean;
  can_sync: boolean;
};

export type PaymentRequiredReason = "add_bank" | "sync";

export function isPaidAccess(accessLevel: number) {
  return accessLevel >= ACCESS_LEVEL_PAID;
}

export function canAddBank(accessLevel: number, itemsConnected: number) {
  return isPaidAccess(accessLevel) || itemsConnected === 0;
}

export function canSync(accessLevel: number, freeSyncUsed: boolean) {
  return isPaidAccess(accessLevel) || !freeSyncUsed;
}

export function paymentRequiredPayload(reason: PaymentRequiredReason) {
  return { error: "Payment required", code: PAYMENT_REQUIRED_CODE, reason };
}

/** Ensure the user has a subscriptions row (free-tier defaults). */
export async function ensureSubscription(prisma: UserScopedPrisma, userId: string) {
  return prisma.subscriptions.upsert({
    where: { user_id: userId },
    create: {
      user_id: userId,
      stripe_subscription_status: "none",
      access_level: ACCESS_LEVEL_FREE,
      free_sync_used: false
    },
    update: {},
    select: {
      access_level: true,
      free_sync_used: true
    }
  });
}

export async function getEntitlements(prisma: UserScopedPrisma, userId: string): Promise<Entitlements> {
  const [sub, itemsConnected] = await Promise.all([
    ensureSubscription(prisma, userId),
    prisma.items.count()
  ]);
  return {
    access_level: sub.access_level,
    free_sync_used: sub.free_sync_used,
    items_connected: itemsConnected,
    can_add_bank: canAddBank(sub.access_level, itemsConnected),
    can_sync: canSync(sub.access_level, sub.free_sync_used)
  };
}

/** Atomically mark free sync used for free-tier users. No-op if already used or paid. */
export async function markFreeSyncUsed(prisma: UserScopedPrisma, userId: string) {
  await prisma.subscriptions.updateMany({
    where: {
      user_id: userId,
      access_level: { lt: ACCESS_LEVEL_PAID },
      free_sync_used: false
    },
    data: { free_sync_used: true }
  });
}

/** Reset free sync when the user has no connected items left. */
export async function resetFreeSyncIfNoItems(prisma: UserScopedPrisma, userId: string) {
  const remaining = await prisma.items.count();
  if (remaining > 0) return;
  await prisma.subscriptions.updateMany({
    where: { user_id: userId, free_sync_used: true },
    data: { free_sync_used: false }
  });
}

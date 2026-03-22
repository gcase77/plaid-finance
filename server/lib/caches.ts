export const transactionMetaCache = new Map<string, { rows: unknown[] }>();
export const clearTransactionMetaCache = (userId: string) => transactionMetaCache.delete(userId);

export const transactionsCache = new Map<string, { rows: unknown[] }>();
export const transactionsCacheKey = (userId: string, includeRemoved: boolean) =>
  `${userId}:${includeRemoved ? "with-removed" : "active-only"}`;
export const clearTransactionsCache = (userId: string) => {
  for (const key of transactionsCache.keys()) {
    if (key.startsWith(`${userId}:`)) transactionsCache.delete(key);
  }
};

export const transactionMetaCache = new Map<string, { rows: unknown[] }>();
export const clearTransactionMetaCache = (userId: string) => transactionMetaCache.delete(userId);

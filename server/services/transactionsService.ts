import { Prisma, type PrismaClient } from "../../generated/prisma/client";

type EnrichedTxn = {
  id: string;
  transaction_id: string;
  user_id: string;
  item_id: string;
  account_id: string;
  name: string | null;
  original_description: string | null;
  merchant_name: string | null;
  amount: number | null;
  iso_currency_code: string | null;
  counterparties: unknown;
  datetime: Date | null;
  authorized_datetime: Date | null;
  location: unknown;
  pending: boolean | null;
  personal_finance_category: unknown;
  personal_finance_category_icon_url: string | null;
  is_removed: boolean;
  created_at?: Date;
  updated_at?: Date;
  account_name: string | null;
  account_official_name: string | null;
  institution_name: string | null;
  account_transfer_group: string | null;
  bucket_1_tag_id: number | null;
  bucket_2_tag_id: number | null;
  meta_tag_id: number | null;
};

type SyncDelta = {
  added: any[];
  modified: any[];
  removed: any[];
  nextCursor: string;
  lockUntil: Date;
};

type CachePage = {
  rows: EnrichedTxn[];
  txnIds: string[];
};

const CACHE_PAGE_SIZE = 250;

export const createTransactionService = (prisma: PrismaClient) => {
  const pageCache = new Map<string, CachePage>();
  const queryMeta = new Map<string, { pageCount: number }>();
  const txnToPageKeys = new Map<string, Set<string>>();
  const userToPageKeys = new Map<string, Set<string>>();

  const queryKey = (userId: string) => `${userId}:active:v1`;
  const pageKey = (userId: string, page: number) => `${queryKey(userId)}:page:${page}`;

  const linkPageToTxn = (txnId: string, key: string) => {
    const keys = txnToPageKeys.get(txnId) || new Set<string>();
    keys.add(key);
    txnToPageKeys.set(txnId, keys);
  };

  const linkPageToUser = (userId: string, key: string) => {
    const keys = userToPageKeys.get(userId) || new Set<string>();
    keys.add(key);
    userToPageKeys.set(userId, keys);
  };

  const clearPage = (key: string) => {
    const cached = pageCache.get(key);
    if (cached) {
      for (const txnId of cached.txnIds) {
        const keys = txnToPageKeys.get(txnId);
        if (!keys) continue;
        keys.delete(key);
        if (keys.size === 0) txnToPageKeys.delete(txnId);
      }
    }
    pageCache.delete(key);
  };

  const invalidateUser = (userId: string) => {
    const qk = queryKey(userId);
    queryMeta.delete(qk);
    const keys = userToPageKeys.get(userId);
    if (keys) {
      for (const key of keys) clearPage(key);
      userToPageKeys.delete(userId);
    }
  };

  const invalidateByTransactionIds = (userId: string, txnIds: string[]) => {
    const qk = queryKey(userId);
    queryMeta.delete(qk);
    const userKeys = userToPageKeys.get(userId) || new Set<string>();
    for (const txnId of txnIds) {
      const keys = txnToPageKeys.get(txnId);
      if (!keys) continue;
      for (const key of keys) {
        clearPage(key);
        userKeys.delete(key);
      }
    }
    if (userKeys.size) userToPageKeys.set(userId, userKeys);
    else userToPageKeys.delete(userId);
  };

  const toJson = (value: unknown) => (value == null ? null : JSON.stringify(value));

  const mapSyncTxn = (userId: string, itemId: string, t: any, isRemoved: boolean) => ({
    id: t.transaction_id,
    user_id: userId,
    item_id: itemId,
    account_id: t.account_id ?? "",
    name: t.name ?? null,
    original_description: t.original_description ?? null,
    merchant_name: t.merchant_name ?? null,
    amount: t.amount ?? null,
    iso_currency_code: t.iso_currency_code ?? null,
    counterparties: t.counterparties ?? null,
    datetime: t.datetime ? new Date(t.datetime) : t.date ? new Date(`${t.date}T00:00:00Z`) : null,
    authorized_datetime: t.authorized_datetime ? new Date(t.authorized_datetime) : null,
    location: t.location ?? null,
    pending: t.pending ?? null,
    personal_finance_category: t.personal_finance_category ?? null,
    personal_finance_category_icon_url: t.personal_finance_category_icon_url ?? null,
    is_removed: isRemoved
  });

  const applySyncDelta = async (userId: string, itemId: string, delta: SyncDelta) => {
    const addedIds = delta.added.map((t: any) => t.transaction_id);
    const modifiedIds = delta.modified.map((t: any) => t.transaction_id);
    const removedIds = delta.removed.map((t: any) => t.transaction_id);

    const txResult = await prisma.$transaction(async (tx) => {
      const existingAdded = await tx.transactions.findMany({ where: { id: { in: addedIds } }, select: { id: true } });
      const existingModified = await tx.transactions.findMany({ where: { id: { in: modifiedIds } }, select: { id: true } });
      const existingRemoved = await tx.transactions.findMany({ where: { id: { in: removedIds } }, select: { id: true } });

      const already_added = existingAdded.map((r) => r.id);
      const modified_existing = existingModified.map((r) => r.id);
      const removed_existing = existingRemoved.map((r) => r.id);

      const modified_not_included = modifiedIds.filter((id: string) => !modified_existing.includes(id));
      const removed_not_included = removedIds.filter((id: string) => !removed_existing.includes(id));

      const rows = [
        ...delta.added.map((t: any) => mapSyncTxn(userId, itemId, t, false)),
        ...delta.modified.map((t: any) => mapSyncTxn(userId, itemId, t, false)),
        ...delta.removed.map((t: any) => mapSyncTxn(userId, itemId, t, true))
      ];

      if (rows.length) {
        const values = rows.map((r) => Prisma.sql`(
          ${r.id},
          ${r.user_id},
          ${r.item_id},
          ${r.account_id},
          ${r.name},
          ${r.original_description},
          ${r.merchant_name},
          ${r.amount},
          ${r.iso_currency_code},
          ${toJson(r.counterparties)}::jsonb,
          ${r.datetime},
          ${r.authorized_datetime},
          ${toJson(r.location)}::jsonb,
          ${r.pending},
          ${toJson(r.personal_finance_category)}::jsonb,
          ${r.personal_finance_category_icon_url},
          ${r.is_removed}
        )`);

        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "transactions" (
            "id",
            "user_id",
            "item_id",
            "account_id",
            "name",
            "original_description",
            "merchant_name",
            "amount",
            "iso_currency_code",
            "counterparties",
            "datetime",
            "authorized_datetime",
            "location",
            "pending",
            "personal_finance_category",
            "personal_finance_category_icon_url",
            "is_removed"
          )
          VALUES ${Prisma.join(values)}
          ON CONFLICT ("id") DO UPDATE SET
            "user_id" = EXCLUDED."user_id",
            "item_id" = EXCLUDED."item_id",
            "account_id" = EXCLUDED."account_id",
            "name" = EXCLUDED."name",
            "original_description" = EXCLUDED."original_description",
            "merchant_name" = EXCLUDED."merchant_name",
            "amount" = EXCLUDED."amount",
            "iso_currency_code" = EXCLUDED."iso_currency_code",
            "counterparties" = EXCLUDED."counterparties",
            "datetime" = EXCLUDED."datetime",
            "authorized_datetime" = EXCLUDED."authorized_datetime",
            "location" = EXCLUDED."location",
            "pending" = EXCLUDED."pending",
            "personal_finance_category" = EXCLUDED."personal_finance_category",
            "personal_finance_category_icon_url" = EXCLUDED."personal_finance_category_icon_url",
            "is_removed" = EXCLUDED."is_removed"
        `);
      }

      await tx.items.update({
        where: { id: itemId },
        data: { transaction_cursor: delta.nextCursor, transactions_sync_lock_until: delta.lockUntil }
      });

      return { successful_update: true, already_added, modified_not_included, removed_not_included };
    });

    invalidateUser(userId);
    return txResult;
  };

  const getAllActiveTransactions = async (userId: string): Promise<EnrichedTxn[]> => {
    const qk = queryKey(userId);
    const meta = queryMeta.get(qk);
    if (meta) {
      const pages: EnrichedTxn[] = [];
      for (let p = 0; p < meta.pageCount; p += 1) {
        const cached = pageCache.get(pageKey(userId, p));
        if (!cached) {
          pages.length = 0;
          break;
        }
        pages.push(...cached.rows);
      }
      if (pages.length || meta.pageCount === 0) return pages;
    }

    invalidateUser(userId);
    const rows = await prisma.transactions.findMany({
      where: { user_id: userId, is_removed: false },
      orderBy: [{ datetime: "desc" }, { authorized_datetime: "desc" }, { id: "desc" }],
      include: {
        accounts: { select: { name: true, official_name: true } },
        items: { select: { institution_name: true } },
        transaction_meta: { select: { account_transfer_group: true, bucket_1_tag_id: true, bucket_2_tag_id: true, meta_tag_id: true } }
      }
    });

    const out: EnrichedTxn[] = rows.map((row) => ({
      ...row,
      transaction_id: row.id,
      account_name: row.accounts?.name ?? null,
      account_official_name: row.accounts?.official_name ?? null,
      institution_name: row.items?.institution_name ?? null,
      account_transfer_group: row.transaction_meta?.account_transfer_group ?? null,
      bucket_1_tag_id: row.transaction_meta?.bucket_1_tag_id ?? null,
      bucket_2_tag_id: row.transaction_meta?.bucket_2_tag_id ?? null,
      meta_tag_id: row.transaction_meta?.meta_tag_id ?? null
    }));

    const pageCount = Math.ceil(out.length / CACHE_PAGE_SIZE);
    queryMeta.set(qk, { pageCount });
    for (let p = 0; p < pageCount; p += 1) {
      const key = pageKey(userId, p);
      const pageRows = out.slice(p * CACHE_PAGE_SIZE, (p + 1) * CACHE_PAGE_SIZE);
      const txnIds = pageRows.map((r) => r.id);
      pageCache.set(key, { rows: pageRows, txnIds });
      linkPageToUser(userId, key);
      for (const txnId of txnIds) linkPageToTxn(txnId, key);
    }

    return out;
  };

  const getTransferTransactions = async (args: {
    userId: string;
    start?: Date | null;
    end?: Date | null;
    includePending?: boolean;
  }) => prisma.$queryRaw<{
    id: string;
    amount: number;
    account_id: string;
    datetime: Date | null;
    authorized_datetime: Date | null;
    name: string | null;
    merchant_name: string | null;
    iso_currency_code: string | null;
    pending: boolean | null;
    account_name: string | null;
    account_official_name: string | null;
  }[]>`
    SELECT
      t.id,
      t.amount,
      t.account_id,
      t.datetime,
      t.authorized_datetime,
      t.name,
      t.merchant_name,
      t.iso_currency_code,
      t.pending,
      a.name AS account_name,
      a.official_name AS account_official_name
    FROM transactions t
    LEFT JOIN accounts a ON a.id = t.account_id
    LEFT JOIN transaction_meta tm ON tm.transaction_id = t.id
    WHERE t.user_id = ${args.userId}
      AND COALESCE(t.is_removed, false) = false
      AND t.amount IS NOT NULL
      AND tm.account_transfer_group IS NULL
      ${args.includePending ? Prisma.empty : Prisma.sql`AND COALESCE(t.pending, false) = false`}
      ${args.start ? Prisma.sql`AND COALESCE(t.datetime, t.authorized_datetime) >= ${args.start}` : Prisma.empty}
      ${args.end ? Prisma.sql`AND COALESCE(t.datetime, t.authorized_datetime) <= ${args.end}` : Prisma.empty}
    ORDER BY COALESCE(t.datetime, t.authorized_datetime) DESC
  `;

  const getExistingTransferGroupAssignments = async (txnIds: string[]) => {
    if (!txnIds.length) return [] as { transaction_id: string; account_transfer_group: string | null }[];
    return prisma.$queryRaw<{ transaction_id: string; account_transfer_group: string | null }[]>`
      SELECT transaction_id, account_transfer_group
      FROM transaction_meta
      WHERE transaction_id = ANY(${txnIds}::text[])
    `;
  };

  const upsertTransferGroups = async (userId: string, pairs: Array<{ outflowId: string; inflowId: string; groupId: string }>) => {
    if (!pairs.length) return;
    await prisma.$transaction(async (tx) => {
      for (const p of pairs) {
        await tx.$executeRaw`
          INSERT INTO transaction_meta (transaction_id, account_transfer_group)
          VALUES (${p.outflowId}, ${p.groupId}), (${p.inflowId}, ${p.groupId})
          ON CONFLICT (transaction_id) DO UPDATE
          SET account_transfer_group = EXCLUDED.account_transfer_group
        `;
      }
    });
    invalidateByTransactionIds(userId, pairs.flatMap((p) => [p.outflowId, p.inflowId]));
  };

  const getRecognizedTransferRows = async (userId: string, start: Date | null, end: Date | null) => prisma.$queryRaw<{
    group_id: string;
    id: string;
    amount: number;
    account_id: string;
    datetime: Date | null;
    authorized_datetime: Date | null;
    name: string | null;
    merchant_name: string | null;
    iso_currency_code: string | null;
    account_name: string | null;
    account_official_name: string | null;
  }[]>`
    SELECT
      tm.account_transfer_group AS group_id,
      t.id,
      t.amount,
      t.account_id,
      t.datetime,
      t.authorized_datetime,
      t.name,
      t.merchant_name,
      t.iso_currency_code,
      a.name AS account_name,
      a.official_name AS account_official_name
    FROM transaction_meta tm
    JOIN transactions t ON t.id = tm.transaction_id
    LEFT JOIN accounts a ON a.id = t.account_id
    WHERE t.user_id = ${userId}
      AND tm.account_transfer_group IS NOT NULL
      ${start ? Prisma.sql`AND COALESCE(t.datetime, t.authorized_datetime) >= ${start}` : Prisma.empty}
      ${end ? Prisma.sql`AND COALESCE(t.datetime, t.authorized_datetime) <= ${end}` : Prisma.empty}
    ORDER BY tm.account_transfer_group, COALESCE(t.datetime, t.authorized_datetime) DESC
  `;

  const clearTransferGroups = async (userId: string, groupIds: string[]) => {
    const rows = await prisma.$queryRaw<{ transaction_id: string }[]>`
      SELECT tm.transaction_id
      FROM transaction_meta tm
      JOIN transactions t ON t.id = tm.transaction_id
      WHERE t.user_id = ${userId}
        AND tm.account_transfer_group = ANY(${groupIds}::text[])
    `;
    const cleared = await prisma.$executeRaw`
      UPDATE transaction_meta tm
      SET account_transfer_group = NULL
      FROM transactions t
      WHERE t.id = tm.transaction_id
        AND t.user_id = ${userId}
        AND tm.account_transfer_group = ANY(${groupIds}::text[])
    `;
    invalidateByTransactionIds(userId, rows.map((r) => r.transaction_id));
    return Number(cleared) || 0;
  };

  const getVisualizationRows = async (userId: string, start: Date | null, end: Date | null) => prisma.$queryRaw<{
    id: string;
    amount: number | null;
    primary_category: string | null;
  }[]>`
    SELECT
      t.id,
      t.amount,
      COALESCE(t.personal_finance_category->>'primary', 'Uncategorized') AS primary_category
    FROM transactions t
    LEFT JOIN transaction_meta tm ON tm.transaction_id = t.id
    WHERE t.user_id = ${userId}
      AND COALESCE(t.is_removed, false) = false
      AND t.amount IS NOT NULL
      AND tm.account_transfer_group IS NULL
      ${start ? Prisma.sql`AND COALESCE(t.datetime, t.authorized_datetime) >= ${start}` : Prisma.empty}
      ${end ? Prisma.sql`AND COALESCE(t.datetime, t.authorized_datetime) <= ${end}` : Prisma.empty}
  `;

  const getVisualizationDetailsRows = async (userId: string, category: string, start: Date | null, end: Date | null) => prisma.$queryRaw<{
    id: string;
    amount: number | null;
    datetime: Date | null;
    authorized_datetime: Date | null;
    name: string | null;
    original_description: string | null;
    merchant_name: string | null;
    iso_currency_code: string | null;
    institution_name: string | null;
    account_name: string | null;
    account_official_name: string | null;
    personal_finance_category_icon_url: string | null;
    primary_category: string | null;
    detailed_category: string | null;
  }[]>`
    SELECT
      t.id,
      t.amount,
      t.datetime,
      t.authorized_datetime,
      t.name,
      t.original_description,
      t.merchant_name,
      t.iso_currency_code,
      i.institution_name,
      a.name AS account_name,
      a.official_name AS account_official_name,
      t.personal_finance_category_icon_url,
      COALESCE(t.personal_finance_category->>'primary', 'Uncategorized') AS primary_category,
      t.personal_finance_category->>'detailed' AS detailed_category
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    LEFT JOIN items i ON i.id = a.item_id
    LEFT JOIN transaction_meta tm ON tm.transaction_id = t.id
    WHERE t.user_id = ${userId}
      AND COALESCE(t.is_removed, false) = false
      AND t.amount IS NOT NULL
      AND tm.account_transfer_group IS NULL
      AND COALESCE(t.personal_finance_category->>'primary', 'Uncategorized') = ${category}
      ${start ? Prisma.sql`AND COALESCE(t.datetime, t.authorized_datetime) >= ${start}` : Prisma.empty}
      ${end ? Prisma.sql`AND COALESCE(t.datetime, t.authorized_datetime) <= ${end}` : Prisma.empty}
    ORDER BY COALESCE(t.datetime, t.authorized_datetime) DESC
  `;

  const getTransactionsForTagging = async (userId: string, ids: string[]) => prisma.transactions.findMany({
    where: { id: { in: ids }, user_id: userId, is_removed: false },
    select: { id: true, amount: true, transaction_meta: { select: { account_transfer_group: true } } }
  });

  const upsertTransactionTags = async (
    userId: string,
    ids: string[],
    tagValues: { bucket_1_tag_id?: number | null; bucket_2_tag_id?: number | null; meta_tag_id?: number | null }
  ) => {
    await prisma.$transaction(async (tx) => {
      for (const txnId of ids) {
        await tx.$executeRaw`
          INSERT INTO transaction_meta (transaction_id, bucket_1_tag_id, bucket_2_tag_id, meta_tag_id)
          VALUES (${txnId}, ${tagValues.bucket_1_tag_id ?? null}, ${tagValues.bucket_2_tag_id ?? null}, ${tagValues.meta_tag_id ?? null})
          ON CONFLICT (transaction_id) DO UPDATE SET
            bucket_1_tag_id = EXCLUDED.bucket_1_tag_id,
            bucket_2_tag_id = EXCLUDED.bucket_2_tag_id,
            meta_tag_id = EXCLUDED.meta_tag_id
        `;
      }
    });
    invalidateByTransactionIds(userId, ids);
  };

  const getPeriodIncome = async (userId: string, start: Date, end: Date): Promise<number> => {
    const rows = await prisma.transactions.findMany({
      where: {
        user_id: userId,
        amount: { lt: 0 },
        is_removed: false,
        datetime: { gte: start, lt: end },
        NOT: { transaction_meta: { account_transfer_group: { not: null } } }
      },
      select: { amount: true }
    });
    return rows.reduce((sum, r) => sum + Math.abs(r.amount ?? 0), 0);
  };

  const getPeriodSpending = async (
    userId: string,
    tagId: number,
    isBucket2: boolean,
    start: Date,
    end: Date
  ): Promise<number> => {
    const where = isBucket2 ? { bucket_2_tag_id: tagId } : { bucket_1_tag_id: tagId };
    const rows = await prisma.transactions.findMany({
      where: {
        user_id: userId,
        amount: { gt: 0 },
        is_removed: false,
        datetime: { gte: start, lt: end },
        transaction_meta: { ...where, account_transfer_group: null }
      },
      select: { amount: true }
    });
    return rows.reduce((sum, r) => sum + (r.amount ?? 0), 0);
  };

  const getEarliestTaggedTransactionDate = async (userId: string, tagId: number, isBucket2: boolean) => {
    const where = isBucket2 ? { bucket_2_tag_id: tagId } : { bucket_1_tag_id: tagId };
    const earliest = await prisma.transactions.findFirst({
      where: { user_id: userId, is_removed: false, transaction_meta: { ...where } },
      orderBy: { datetime: "asc" },
      select: { datetime: true }
    });
    return earliest?.datetime ?? null;
  };

  return {
    invalidateUser,
    applySyncDelta,
    getAllActiveTransactions,
    getTransferTransactions,
    getExistingTransferGroupAssignments,
    upsertTransferGroups,
    getRecognizedTransferRows,
    clearTransferGroups,
    getVisualizationRows,
    getVisualizationDetailsRows,
    getTransactionsForTagging,
    upsertTransactionTags,
    getPeriodIncome,
    getPeriodSpending,
    getEarliestTaggedTransactionDate
  };
};

export type TransactionService = ReturnType<typeof createTransactionService>;

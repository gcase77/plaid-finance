import express from "express";
import { createHash } from "crypto";
import { Prisma } from "../../generated/prisma/client";
import { plaid } from "../lib/plaid";
import { logger } from "../logger";
import type { ServerRequest } from "../middleware/auth";

const PAGE_SIZE = 500;
const LOCK_MINUTES = 5;
const MAX_SAFETY_LIMIT = 20;
const DEFAULT_TRANSFER_DAY_WINDOW = 3;
const MAX_TRANSFER_DAY_WINDOW = 30;

const isoNow = () => new Date().toISOString();
const addMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
const msInDay = 86_400_000;
const txnTs = (t: { datetime: Date | null; authorized_datetime: Date | null }) =>
  (t.datetime ?? t.authorized_datetime)?.getTime() ?? null;
const txnDate = (t: { datetime: Date | null; authorized_datetime: Date | null }) => t.datetime ?? t.authorized_datetime;
const utcDayStamp = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const pairIdFrom = (a: string, b: string) =>
  createHash("sha1").update([a, b].sort().join("|")).digest("hex");

type TransferTxn = {
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
};

type TransferCandidate = {
  pairId: string;
  outflow: TransferTxn;
  inflow: TransferTxn;
  amount: number;
  dayGap: number;
  timeDiffMs: number;
  reason: string;
};

const sameScore = (a: TransferCandidate, b: TransferCandidate) =>
  a.dayGap === b.dayGap && a.timeDiffMs === b.timeDiffMs;
const candidateSort = (a: TransferCandidate, b: TransferCandidate) =>
  a.dayGap - b.dayGap
  || a.timeDiffMs - b.timeDiffMs
  || a.outflow.id.localeCompare(b.outflow.id)
  || a.inflow.id.localeCompare(b.inflow.id);

const parseDateRange = (startDateRaw: unknown, endDateRaw: unknown) => {
  const startDate = typeof startDateRaw === "string" ? startDateRaw.trim() : "";
  const endDate = typeof endDateRaw === "string" ? endDateRaw.trim() : "";
  const start = startDate ? new Date(`${startDate}T00:00:00.000Z`) : null;
  const end = endDate ? new Date(`${endDate}T23:59:59.999Z`) : null;
  if (startDate && Number.isNaN(start?.valueOf())) return { error: "Invalid startDate" as const };
  if (endDate && Number.isNaN(end?.valueOf())) return { error: "Invalid endDate" as const };
  return { startDate, endDate, start, end };
};

const dateFilterSql = (alias: string, start: Date | null, end: Date | null) => {
  const col = Prisma.raw(`COALESCE(${alias}.datetime, ${alias}.authorized_datetime)`);
  return Prisma.sql`
    ${start ? Prisma.sql`AND ${col} >= ${start}` : Prisma.empty}
    ${end ? Prisma.sql`AND ${col} <= ${end}` : Prisma.empty}
  `;
};

const router = express.Router();
const transactionsCache = new Map<string, { rows: unknown[] }>();

const invalidateTransactionsCache = (userId: string) => { transactionsCache.delete(userId); };

const syncItemTransactions = async (prisma: ServerRequest["prisma"], userId: string, itemId: string) => {
    const item = await prisma.items.findFirst({
      where: { id: itemId, user_id: userId },
      select: { access_token: true, transaction_cursor: true }
    });
    if (!item) throw new Error(`Item ${itemId} not found for user ${userId}`);
    const { access_token: accessToken, transaction_cursor: cursor } = item;

    let currentCursor = cursor || null;
    let hasMore = true;
    let pageCount = 0;
    let response: any = null;
    let addedCount = 0;
    let modifiedCount = 0;
    let removedCount = 0;

    try {
      while (hasMore && pageCount < MAX_SAFETY_LIMIT) {
        const request = {
          access_token: accessToken,
          cursor: currentCursor,
          count: PAGE_SIZE,
          options: {
            include_original_description: true,
            days_requested: 730
          }
        };

        response = await plaid.transactionsSync(request).catch((err: any) => {
          const e = new Error("Plaid API Request Failed") as Error & { plaidResponse?: unknown };
          e.plaidResponse = err?.response?.data ?? err?.message ?? err;
          throw e;
        });
        const data = response.data;

        if (!data.added.length && !data.modified.length && !data.removed.length) {
          throw new Error("Sync returned no transaction updates.");
        }

        const lockUntil = addMinutes(LOCK_MINUTES);
        const txResult = await prisma.$transaction(async (tx) => {
          const addedIds = data.added.map((t: any) => t.transaction_id);
          const modifiedIds = data.modified.map((t: any) => t.transaction_id);
          const removedIds = data.removed.map((t: any) => t.transaction_id);

          const existingAdded = await tx.transactions.findMany({ where: { id: { in: addedIds } }, select: { id: true } });
          const existingModified = await tx.transactions.findMany({ where: { id: { in: modifiedIds } }, select: { id: true } });
          const existingRemoved = await tx.transactions.findMany({ where: { id: { in: removedIds } }, select: { id: true } });

          const already_added = existingAdded.map((r) => r.id);
          const modified_existing = existingModified.map((r) => r.id);
          const removed_existing = existingRemoved.map((r) => r.id);

          const modified_not_included = modifiedIds.filter((id: string) => !modified_existing.includes(id));
          const removed_not_included = removedIds.filter((id: string) => !removed_existing.includes(id));

          const mapTxn = (t: any) => ({
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
            is_removed: false
          });
          const toJson = (value: unknown) => (value == null ? null : JSON.stringify(value));

          const fullRows = [...data.added.map((t: any) => mapTxn(t)), ...data.modified.map((t: any) => mapTxn(t))];
          if (fullRows.length) {
            const values = fullRows.map((r) => Prisma.sql`(
              ${r.id}, ${r.user_id}, ${r.item_id}, ${r.account_id}, ${r.name}, ${r.original_description},
              ${r.merchant_name}, ${r.amount}, ${r.iso_currency_code}, ${toJson(r.counterparties)}::jsonb,
              ${r.datetime}, ${r.authorized_datetime}, ${toJson(r.location)}::jsonb, ${r.pending},
              ${toJson(r.personal_finance_category)}::jsonb, ${r.personal_finance_category_icon_url}, ${r.is_removed}
            )`);
            await tx.$executeRaw(Prisma.sql`
              INSERT INTO "transactions" (
                "id", "user_id", "item_id", "account_id", "name", "original_description",
                "merchant_name", "amount", "iso_currency_code", "counterparties",
                "datetime", "authorized_datetime", "location", "pending",
                "personal_finance_category", "personal_finance_category_icon_url", "is_removed"
              )
              VALUES ${Prisma.join(values)}
              ON CONFLICT ("id") DO UPDATE SET
                "user_id" = EXCLUDED."user_id", "item_id" = EXCLUDED."item_id", "account_id" = EXCLUDED."account_id",
                "name" = EXCLUDED."name", "original_description" = EXCLUDED."original_description",
                "merchant_name" = EXCLUDED."merchant_name", "amount" = EXCLUDED."amount",
                "iso_currency_code" = EXCLUDED."iso_currency_code", "counterparties" = EXCLUDED."counterparties",
                "datetime" = EXCLUDED."datetime", "authorized_datetime" = EXCLUDED."authorized_datetime",
                "location" = EXCLUDED."location", "pending" = EXCLUDED."pending",
                "personal_finance_category" = EXCLUDED."personal_finance_category",
                "personal_finance_category_icon_url" = EXCLUDED."personal_finance_category_icon_url",
                "is_removed" = EXCLUDED."is_removed"
            `);
          }

          if (data.removed.length) {
            const removedValues = data.removed.map((t: any) =>
              Prisma.sql`(${t.transaction_id}, ${userId}, ${itemId}, ${t.account_id ?? ""}, true)`);
            await tx.$executeRaw(Prisma.sql`
              INSERT INTO "transactions" ("id", "user_id", "item_id", "account_id", "is_removed")
              VALUES ${Prisma.join(removedValues)}
              ON CONFLICT ("id") DO UPDATE SET "is_removed" = EXCLUDED."is_removed"
            `);
          }

          await tx.items.update({
            where: { id: itemId },
            data: { transaction_cursor: data.next_cursor, transactions_sync_lock_until: new Date(lockUntil) }
          });

          return { successful_update: true, already_added, modified_not_included, removed_not_included };
        });

        await logger.to_db(
          "INFO",
          userId,
          "TRANSACTIONS SYNC",
          { ...txResult, itemId, transactions_update_status: data.transactions_update_status },
          data
        );

        addedCount += data.added.length;
        modifiedCount += data.modified.length;
        removedCount += data.removed.length;

        currentCursor = data.next_cursor;
        hasMore = data.has_more;
        pageCount += 1;
      }
    } catch (error: any) {
      const rawPayload = error.plaidResponse ?? response?.data ?? null;
      await logger.to_db(
        "ERROR",
        userId,
        "TRANSACTIONS SYNC",
        { successful_update: false, error_message: error.message },
        rawPayload && typeof rawPayload === "object" ? rawPayload : { body: rawPayload }
      );
    }

    return { cursor: currentCursor, added: addedCount, modified: modifiedCount, removed: removedCount };
  };

const scheduleSyncForUser = async (prisma: ServerRequest["prisma"], userId: string) => {
    const now = new Date(isoNow());
    const lockUntil = new Date(addMinutes(LOCK_MINUTES));
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      UPDATE items
      SET transactions_sync_lock_until = ${lockUntil}
      WHERE user_id = ${userId}
        AND (transactions_sync_lock_until IS NULL OR transactions_sync_lock_until <= ${now})
      RETURNING id;
    `;
    const itemIds = rows.map((r) => r.id);
    if (itemIds.length === 0) return { items_processed: 0, added: 0, modified: 0, removed: 0 };

    let added = 0;
    let modified = 0;
    let removed = 0;

    for (const itemId of itemIds) {
      const result = await syncItemTransactions(prisma, userId, itemId);
      added += result.added || 0;
      modified += result.modified || 0;
      removed += result.removed || 0;
    }

    await prisma.items.updateMany({
      where: { user_id: userId, id: { in: itemIds } },
      data: { transactions_sync_lock_until: new Date(isoNow()) }
    });

    return { items_processed: itemIds.length, added, modified, removed };
  };

router.post("/transactions/sync", async (req, res) => {
  try {
    const { user, prisma } = req as unknown as ServerRequest;
    const result = await scheduleSyncForUser(prisma, user.id);
    invalidateTransactionsCache(user.id);
    res.json({ success: true, ...result });
  } catch (e: any) {
    logger.log("error", "sync transactions", { err: e, userId: (req as any).user?.id });
    res.status(500).json({ error: e.message });
  }
});

router.get("/transactions", async (req, res) => {
  try {
    const { user, prisma } = req as unknown as ServerRequest;
    const userId = user.id;
    const includeRemoved = req.query.includeRemoved === "true";
    const cached = transactionsCache.get(userId);
    if (cached) return res.json(cached.rows);
    const rows = await prisma.transactions.findMany({
      where: { user_id: userId, ...(includeRemoved ? {} : { is_removed: false }) },
      orderBy: [{ datetime: "desc" }, { authorized_datetime: "desc" }],
      include: {
        accounts: { select: { name: true, official_name: true } },
        items: { select: { institution_name: true } },
        transaction_meta: { select: { account_transfer_group: true, bucket_1_tag_id: true, bucket_2_tag_id: true, meta_tag_id: true } }
      }
    });
    const out = rows.map((row) => ({
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
    transactionsCache.set(userId, { rows: out });
    res.json(out);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

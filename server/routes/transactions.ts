import express from "express";
import { createHash, randomUUID } from "crypto";
import type { PlaidApi } from "plaid";
import type { Logger } from "../logger";
import { type PrismaClient } from "../../generated/prisma/client";
import type { TransactionService } from "../services/transactionsService";

type Params = { plaid: PlaidApi; prisma: PrismaClient; logger: Logger; transactionService: TransactionService };

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

export default ({ plaid, prisma, logger, transactionService }: Params) => {
  const router = express.Router();

  const syncItemTransactions = async (userId: string, itemId: string) => {
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

        const txResult = await transactionService.applySyncDelta(userId, itemId, {
          added: data.added,
          modified: data.modified,
          removed: data.removed,
          nextCursor: data.next_cursor,
          lockUntil: new Date(addMinutes(LOCK_MINUTES))
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

  const scheduleSyncForUser = async (userId: string) => {
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
      const result = await syncItemTransactions(userId, itemId);
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

  router.post("/sync", async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const result = await scheduleSyncForUser(userId);
      transactionService.invalidateUser(userId);
      res.json({ success: true, ...result });
    } catch (e: any) {
      logger.log("error", "sync transactions", { err: e, userId: (req as any).user?.id });
      res.status(500).json({ error: e.message });
    }
  });

  const getAllHandler = async (req: express.Request, res: express.Response) => {
    try {
      const userId = (req as any).user.id;
      const out = await transactionService.getAllActiveTransactions(userId);
      res.json(out);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  };

  const buildTransferCandidates = (txns: TransferTxn[], amountTolerance: number, dayRangeTolerance: number) => {
    const outflows = txns.filter((t) => t.amount > 0);
    const inflows = txns.filter((t) => t.amount < 0);
    const candidates: TransferCandidate[] = [];
    for (const outflow of outflows) {
      const outTs = txnTs(outflow);
      const outDate = txnDate(outflow);
      if (outTs == null) continue;
      if (!outDate) continue;
      for (const inflow of inflows) {
        const inTs = txnTs(inflow);
        const inDate = txnDate(inflow);
        if (inTs == null) continue;
        if (!inDate) continue;
        if (outflow.account_id === inflow.account_id) continue;
        const amountDiff = Math.abs(Math.abs(outflow.amount) - Math.abs(inflow.amount));
        if (amountDiff > amountTolerance) continue;
        const diffMs = Math.abs(outTs - inTs);
        const dayGap = Math.abs(utcDayStamp(outDate) - utcDayStamp(inDate)) / msInDay;
        if (dayGap > dayRangeTolerance) continue;
        candidates.push({
          pairId: pairIdFrom(outflow.id, inflow.id),
          outflow,
          inflow,
          amount: Math.abs(outflow.amount),
          dayGap,
          timeDiffMs: diffMs,
          reason: dayGap === 0 ? "same_day" : dayGap === 1 ? "one_day_gap" : "two_day_gap"
        });
      }
    }
    return candidates;
  };

  const resolveTransferPairs = (candidates: TransferCandidate[]) => {
    const byTxn = new Map<string, TransferCandidate[]>();
    for (const c of candidates) {
      byTxn.set(c.outflow.id, [...(byTxn.get(c.outflow.id) || []), c]);
      byTxn.set(c.inflow.id, [...(byTxn.get(c.inflow.id) || []), c]);
    }
    const ambiguousTxnIds = new Set<string>();
    for (const [txnId, list] of byTxn.entries()) {
      const ranked = [...list].sort(candidateSort);
      if (ranked.length > 1 && sameScore(ranked[0], ranked[1])) ambiguousTxnIds.add(txnId);
    }
    const filtered = candidates
      .filter((c) => !ambiguousTxnIds.has(c.outflow.id) && !ambiguousTxnIds.has(c.inflow.id))
      .sort(candidateSort);
    const used = new Set<string>();
    const matched: TransferCandidate[] = [];
    for (const c of filtered) {
      if (used.has(c.outflow.id) || used.has(c.inflow.id)) continue;
      used.add(c.outflow.id);
      used.add(c.inflow.id);
      matched.push(c);
    }
    return { matched, ambiguousTxnIds, totalCandidates: candidates.length };
  };

  const fetchTransferTxns = async (args: {
    userId: string;
    startDate?: string;
    endDate?: string;
    includePending?: boolean;
  }) => {
    const start = args.startDate ? new Date(`${args.startDate}T00:00:00.000Z`) : null;
    const end = args.endDate ? new Date(`${args.endDate}T23:59:59.999Z`) : null;
    return transactionService.getTransferTransactions({
      userId: args.userId,
      start,
      end,
      includePending: args.includePending
    });
  };

  const transferPreview = async (args: {
    userId: string;
    startDate?: string;
    endDate?: string;
    includePending?: boolean;
    amountTolerance?: number;
    dayRangeTolerance?: number;
  }) => {
    const txns = await fetchTransferTxns(args);
    const amountTolerance = Math.max(0, Number.isFinite(Number(args.amountTolerance)) ? Number(args.amountTolerance) : 0);
    const dayRangeTolerance = Math.min(
      MAX_TRANSFER_DAY_WINDOW,
      Math.max(0, Number.isFinite(Number(args.dayRangeTolerance)) ? Number(args.dayRangeTolerance) : DEFAULT_TRANSFER_DAY_WINDOW)
    );
    const candidates = buildTransferCandidates(txns, amountTolerance, dayRangeTolerance);
    const { matched, ambiguousTxnIds, totalCandidates } = resolveTransferPairs(candidates);
    const ambiguousPairs = candidates
      .filter((c) => ambiguousTxnIds.has(c.outflow.id) || ambiguousTxnIds.has(c.inflow.id))
      .filter((c, idx, arr) => arr.findIndex((x) => x.pairId === c.pairId) === idx);
    return {
      params: {
        startDate: args.startDate || null,
        endDate: args.endDate || null,
        includePending: !!args.includePending,
        amountTolerance,
        dayRangeTolerance
      },
      summary: {
        scanned: txns.length,
        candidates: totalCandidates,
        predicted: matched.length,
        ambiguous_transactions: ambiguousTxnIds.size,
        ambiguous_pairs: ambiguousPairs.length
      },
      pairs: matched.map((c) => ({
        pairId: c.pairId,
        amount: c.amount,
        dayGap: c.dayGap,
        reason: c.reason,
        outflow: c.outflow,
        inflow: c.inflow
      })),
      ambiguous_pairs: ambiguousPairs.map((c) => ({
        pairId: c.pairId,
        amount: c.amount,
        dayGap: c.dayGap,
        reason: c.reason,
        outflow: c.outflow,
        inflow: c.inflow
      }))
    };
  };

  router.post("/internal/preview", async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const { startDate, endDate, includePending, amountTolerance, dayRangeTolerance } = req.body || {};
      const preview = await transferPreview({ userId, startDate, endDate, includePending, amountTolerance, dayRangeTolerance });
      await logger.to_db("INFO", userId, "TRANSFER PAIRS PREVIEW", {
        ...preview.summary,
        startDate: preview.params.startDate,
        endDate: preview.params.endDate
      });
      res.json(preview);
    } catch (e: any) {
      const userId = (req as any).user?.id;
      if (userId) {
        await logger.to_db("ERROR", userId, "TRANSFER PAIRS PREVIEW", { error_message: e.message });
      }
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/internal/apply", async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const { pairIds, startDate, endDate, includePending, overwrite, amountTolerance, dayRangeTolerance } = req.body || {};
      if (!Array.isArray(pairIds) || pairIds.length === 0) {
        return res.status(400).json({ error: "pairIds is required" });
      }
      const preview = await transferPreview({ userId, startDate, endDate, includePending, amountTolerance, dayRangeTolerance });
      const pairSet = new Set(pairIds);
      const selected = preview.pairs.filter((p) => pairSet.has(p.pairId));
      const selectedTxnIds = new Set(selected.flatMap((p) => [p.outflow.id, p.inflow.id]));
      const selectedIdList = [...selectedTxnIds];
      const existing = await transactionService.getExistingTransferGroupAssignments(selectedIdList);
      const existingByTxn = new Map(existing.map((e) => [e.transaction_id, e.account_transfer_group]));
      const writable = selected.filter((p) => {
        if (overwrite) return true;
        const a = existingByTxn.get(p.outflow.id);
        const b = existingByTxn.get(p.inflow.id);
        return !a && !b;
      });
      await transactionService.upsertTransferGroups(
        userId,
        writable.map((p) => ({ outflowId: p.outflow.id, inflowId: p.inflow.id, groupId: randomUUID() }))
      );
      const result = {
        summary: {
          scanned: preview.summary.scanned,
          predicted: preview.summary.predicted,
          approved: selected.length,
          written_pairs: writable.length,
          skipped_existing: selected.length - writable.length
        },
        appliedPairIds: writable.map((p) => p.pairId)
      };
      await logger.to_db("INFO", userId, "TRANSFER PAIRS APPLY", result.summary, {
        startDate: preview.params.startDate,
        endDate: preview.params.endDate,
        overwrite: !!overwrite
      });
      res.json(result);
    } catch (e: any) {
      const userId = (req as any).user?.id;
      if (userId) {
        await logger.to_db("ERROR", userId, "TRANSFER PAIRS APPLY", { error_message: e.message });
      }
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/internal/recognized", async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const dateRange = parseDateRange(req.query.startDate, req.query.endDate);
      if ("error" in dateRange) return res.status(400).json({ error: dateRange.error });
      const rows = await transactionService.getRecognizedTransferRows(userId, dateRange.start, dateRange.end);
      const byGroup = new Map<string, typeof rows>();
      for (const row of rows) byGroup.set(row.group_id, [...(byGroup.get(row.group_id) || []), row]);
      const groups = [...byGroup.entries()].map(([groupId, groupRows]) => {
        const txns = groupRows.map((r) => ({
          id: r.id,
          amount: Number(r.amount),
          account_id: r.account_id,
          datetime: r.datetime,
          authorized_datetime: r.authorized_datetime,
          name: r.name,
          merchant_name: r.merchant_name,
          iso_currency_code: r.iso_currency_code,
          account_name: r.account_name,
          account_official_name: r.account_official_name
        }));
        const outflow = txns.find((t) => t.amount > 0) || null;
        const inflow = txns.find((t) => t.amount < 0) || null;
        const pair = txns.length === 2 && outflow && inflow ? {
          pairId: pairIdFrom(outflow.id, inflow.id),
          amount: Math.abs(outflow.amount),
          dayGap: outflow.datetime && inflow.datetime
            ? Math.abs(utcDayStamp(new Date(outflow.datetime)) - utcDayStamp(new Date(inflow.datetime))) / msInDay
            : 0,
          reason: "recognized_group",
          outflow,
          inflow
        } : null;
        return { groupId, rows: txns, pair };
      });
      res.json({ count: groups.length, groups });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/internal/unmark", async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const { groupIds } = req.body || {};
      if (!Array.isArray(groupIds) || !groupIds.length) {
        return res.status(400).json({ error: "groupIds is required" });
      }
      const ids = [...new Set(groupIds.map((x: unknown) => String(x || "").trim()).filter(Boolean))];
      if (!ids.length) return res.status(400).json({ error: "groupIds is required" });
      const cleared = await transactionService.clearTransferGroups(userId, ids);
      res.json({ cleared_rows: Number(cleared) || 0, cleared_groups: ids.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/visualize", async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const dateRange = parseDateRange(req.query.startDate, req.query.endDate);
      if ("error" in dateRange) return res.status(400).json({ error: dateRange.error });
      const rows = await transactionService.getVisualizationRows(userId, dateRange.start, dateRange.end);

      const incomeList: { id: string; value: number; category: string }[] = [];
      const spendingList: { id: string; value: number; category: string }[] = [];
      for (const row of rows) {
        if (row.amount == null) continue;
        const amount = Number(row.amount);
        const category = row.primary_category || "Uncategorized";
        if (amount < 0) {
          incomeList.push({ id: row.id, value: Math.abs(amount), category });
        } else if (amount > 0) {
          spendingList.push({ id: row.id, value: Math.abs(amount), category });
        }
      }

      const aggregate = (list: { value: number; category: string }[]) => {
        const byCategory = new Map<string, number>();
        let total = 0;
        for (const item of list) {
          const prev = byCategory.get(item.category) || 0;
          byCategory.set(item.category, prev + item.value);
          total += item.value;
        }
        return {
          count: list.length,
          total,
          categories: [...byCategory.entries()]
            .map(([category, amount]) => ({ category, amount }))
            .sort((a, b) => b.amount - a.amount)
        };
      };

      const income = aggregate(incomeList);
      const spending = aggregate(spendingList);
      res.json({
        startDate: dateRange.startDate || null,
        endDate: dateRange.endDate || null,
        income,
        spending
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/visualize/details", async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const setType = String(req.query.set || "").toLowerCase();
      const category = String(req.query.category || "");
      const dateRange = parseDateRange(req.query.startDate, req.query.endDate);
      if ("error" in dateRange) return res.status(400).json({ error: dateRange.error });
      if (setType !== "income" && setType !== "spending") {
        return res.status(400).json({ error: "set must be income or spending" });
      }

      const rows = await transactionService.getVisualizationDetailsRows(userId, category, dateRange.start, dateRange.end);
      const list = rows.filter((row) => {
        if (row.amount == null) return false;
        const amount = Number(row.amount);
        return setType === "income" ? amount < 0 : amount > 0;
      });
      res.json({
        set: setType,
        category,
        count: list.length,
        rows: list.map((row) => ({
          id: row.id,
          datetime: row.datetime,
          authorized_datetime: row.authorized_datetime,
          name: row.name,
          original_description: row.original_description,
          merchant_name: row.merchant_name,
          amount: row.amount,
          iso_currency_code: row.iso_currency_code,
          institution_name: row.institution_name,
          account_name: row.account_name,
          account_official_name: row.account_official_name,
          personal_finance_category_icon_url: row.personal_finance_category_icon_url,
          personal_finance_category: {
            primary: row.primary_category || "Uncategorized",
            detailed: row.detailed_category || null
          }
        }))
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.put("/tag", async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const { transaction_ids, bucket_1_tag_id, bucket_2_tag_id, meta_tag_id } = req.body || {};
      if (!Array.isArray(transaction_ids) || !transaction_ids.length) {
        return res.status(400).json({ error: "transaction_ids is required" });
      }

      const ids = [...new Set((transaction_ids as string[]).filter(Boolean))];
      if (bucket_2_tag_id != null && bucket_1_tag_id == null) {
        return res.status(400).json({ error: "bucket_2_tag_id requires bucket_1_tag_id" });
      }

      const txns = await transactionService.getTransactionsForTagging(userId, ids);
      if (txns.length !== ids.length) return res.status(400).json({ error: "One or more transactions not found" });

      const tagIds = [bucket_1_tag_id, bucket_2_tag_id, meta_tag_id].filter((id) => id != null) as number[];
      if (tagIds.length) {
        const tags = await prisma.tags.findMany({ where: { id: { in: tagIds }, user_id: userId } });
        if (tags.length !== tagIds.length) return res.status(400).json({ error: "One or more tags not found" });

        const tagMap = new Map(tags.map((t) => [t.id, t]));
        const b1 = bucket_1_tag_id != null ? tagMap.get(bucket_1_tag_id) : null;
        const b2 = bucket_2_tag_id != null ? tagMap.get(bucket_2_tag_id) : null;
        const mt = meta_tag_id != null ? tagMap.get(meta_tag_id) : null;

        if (b1 && b1.type !== "income_bucket_1" && b1.type !== "spending_bucket_1") {
          return res.status(400).json({ error: "bucket_1 tag must be type income_bucket_1 or spending_bucket_1" });
        }
        if (b2 && b2.type !== "income_bucket_2" && b2.type !== "spending_bucket_2") {
          return res.status(400).json({ error: "bucket_2 tag must be type income_bucket_2 or spending_bucket_2" });
        }
        if (b1 && b2) {
          const b1Dir = b1.type.startsWith("income") ? "income" : "spending";
          const b2Dir = b2.type.startsWith("income") ? "income" : "spending";
          if (b1Dir !== b2Dir) return res.status(400).json({ error: "bucket_1 and bucket_2 must share the same direction (income/spending)" });
        }
        if (mt && mt.type !== "meta") {
          return res.status(400).json({ error: "meta_tag must be type meta" });
        }

        if (b1) {
          const b1Dir = b1.type.startsWith("income") ? "income" : "spending";
          for (const t of txns) {
            if (t.transaction_meta?.account_transfer_group) {
              return res.status(400).json({ error: `Transaction ${t.id} is a transfer and cannot receive a bucket tag` });
            }
            const amt = Number(t.amount ?? 0);
            if (b1Dir === "spending" && amt <= 0) return res.status(400).json({ error: `Transaction ${t.id} is not a spending transaction` });
            if (b1Dir === "income" && amt >= 0) return res.status(400).json({ error: `Transaction ${t.id} is not an income transaction` });
          }
        }
      }

      await transactionService.upsertTransactionTags(userId, ids, {
        bucket_1_tag_id: bucket_1_tag_id ?? null,
        bucket_2_tag_id: bucket_2_tag_id ?? null,
        meta_tag_id: meta_tag_id ?? null
      });

      res.json({ success: true, updated: ids.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return { router, getAllHandler, scheduleSyncForUser, syncItemTransactions };
};

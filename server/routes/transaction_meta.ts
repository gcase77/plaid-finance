import { randomUUID } from "crypto";
import express from "express";
import { TagType } from "../../generated/prisma/client";
import type { ServerRequest } from "../middleware/auth";
import { clearTransactionMetaCache, transactionMetaCache } from "../lib/caches";

const INCOME_TYPES = new Set<TagType>([TagType.income_bucket_1, TagType.income_bucket_2]);
const SPENDING_TYPES = new Set<TagType>([TagType.spending_bucket_1, TagType.spending_bucket_2]);

type MetaTagUpdate = {
  transaction_id: string;
  bucket_1_tag_id?: number | null;
  bucket_2_tag_id?: number | null;
  meta_tag_ids?: number[] | null;
};

const router = express.Router();

router.get("/transaction_meta", async (req, res) => {
  try {
    const { user, prisma } = req as unknown as ServerRequest;
    const userId = user.id;
    const cached = transactionMetaCache.get(userId);
    if (cached) return res.json(cached.rows);

    const rows = await prisma.transaction_meta.findMany({
      where: {
        transaction: {
          is: {
            user_id: userId,
            is_removed: false
          }
        }
      },
      select: {
        transaction_id: true,
        account_transfer_group: true,
        bucket_1_tag_id: true,
        bucket_2_tag_id: true,
        meta_tags: { select: { tag_id: true } }
      }
    });

    const mappedRows = rows.map((row) => ({
      transaction_id: row.transaction_id,
      account_transfer_group: row.account_transfer_group,
      bucket_1_tag_id: row.bucket_1_tag_id,
      bucket_2_tag_id: row.bucket_2_tag_id,
      meta_tag_ids: row.meta_tags.map((link) => link.tag_id)
    }));

    transactionMetaCache.set(userId, { rows: mappedRows });
    res.json(mappedRows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/transaction_meta/transfer_group", async (req, res) => {
  try {
    const { user, prisma } = req as unknown as ServerRequest;
    const { transaction_ids }: { transaction_ids: string[] } = req.body;
    if (!Array.isArray(transaction_ids) || transaction_ids.length !== 2)
      return res.status(400).json({ error: "transaction_ids must be an array of exactly 2" });

    const txns = await prisma.transactions.findMany({
      where: { id: { in: transaction_ids }, user_id: user.id, is_removed: false },
      select: { id: true }
    });
    if (txns.length !== 2) return res.status(404).json({ error: "One or more transactions not found" });

    const group = randomUUID();
    await prisma.$transaction(
      transaction_ids.map(id =>
        prisma.transaction_meta.upsert({
          where: { transaction_id: id },
          create: { transaction_id: id, account_transfer_group: group },
          update: { account_transfer_group: group }
        })
      )
    );

    clearTransactionMetaCache(user.id);
    res.status(201).json({ account_transfer_group: group });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/transaction_meta/transfer_group", async (req, res) => {
  try {
    const { user, prisma } = req as unknown as ServerRequest;
    const { transaction_ids }: { transaction_ids: string[] } = req.body;
    if (!Array.isArray(transaction_ids) || transaction_ids.length !== 2)
      return res.status(400).json({ error: "transaction_ids must be an array of exactly 2" });

    const txns = await prisma.transactions.findMany({
      where: { id: { in: transaction_ids }, user_id: user.id, is_removed: false },
      select: { id: true }
    });
    if (txns.length !== 2) return res.status(404).json({ error: "One or more transactions not found" });

    await prisma.transaction_meta.updateMany({
      where: { transaction_id: { in: transaction_ids } },
      data: { account_transfer_group: null }
    });

    clearTransactionMetaCache(user.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/transaction_meta/tags", async (req, res) => {
  try {
    const { user, prisma } = req as unknown as ServerRequest;
    const items: MetaTagUpdate[] = req.body;
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: "Body must be a non-empty array" });
    for (const item of items) {
      if (typeof item.transaction_id !== "string" || !item.transaction_id)
        return res.status(400).json({ error: "Each item must include a valid transaction_id" });
      if ("meta_tag_ids" in item && item.meta_tag_ids != null && !Array.isArray(item.meta_tag_ids))
        return res.status(400).json({ error: "meta_tag_ids must be an array when provided" });
      if (Array.isArray(item.meta_tag_ids) && !item.meta_tag_ids.every((v) => Number.isInteger(v)))
        return res.status(400).json({ error: "meta_tag_ids must contain integer ids only" });
    }

    const transactionIds = items.map(i => i.transaction_id);
    const tagIds = [
      ...new Set(
        items
          .flatMap(i => [i.bucket_1_tag_id, i.bucket_2_tag_id, ...(i.meta_tag_ids ?? [])])
          .filter((v): v is number => v != null)
      )
    ];

    const [transactions, tags] = await Promise.all([
      prisma.transactions.findMany({
        where: { id: { in: transactionIds }, user_id: user.id, is_removed: false },
        select: { id: true, amount: true }
      }),
      tagIds.length > 0
        ? prisma.tags.findMany({ where: { id: { in: tagIds }, user_id: user.id }, select: { id: true, type: true } })
        : Promise.resolve([])
    ]);

    if (transactions.length !== transactionIds.length)
      return res.status(404).json({ error: "One or more transactions not found" });
    if (tags.length !== tagIds.length)
      return res.status(404).json({ error: "One or more tags not found" });

    const txMap = new Map(transactions.map(t => [t.id, t.amount ?? 0]));
    const tagTypeMap = new Map(tags.map(t => [t.id, t.type]));

    for (const item of items) {
      const amount = txMap.get(item.transaction_id)!;
      const bucketTagIds = [item.bucket_1_tag_id, item.bucket_2_tag_id].filter((v): v is number => v != null);
      for (const tagId of bucketTagIds) {
        const type = tagTypeMap.get(tagId)!;
        if (type === TagType.meta)
          return res.status(422).json({ error: `Tag ${tagId} is a meta tag and cannot be assigned to a bucket slot` });
        if (INCOME_TYPES.has(type) && amount > 0)
          return res.status(422).json({ error: `Tag ${tagId} is an income tag but transaction ${item.transaction_id} is a debit` });
        if (SPENDING_TYPES.has(type) && amount < 0)
          return res.status(422).json({ error: `Tag ${tagId} is a spending tag but transaction ${item.transaction_id} is a credit` });
      }
      for (const metaTagId of item.meta_tag_ids ?? []) {
        if (tagTypeMap.get(metaTagId) !== TagType.meta)
          return res.status(422).json({ error: `Tag ${metaTagId} is not a meta tag and cannot be assigned to the meta slot` });
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const data: { bucket_1_tag_id?: number | null; bucket_2_tag_id?: number | null } = {};
        if ("bucket_1_tag_id" in item) data.bucket_1_tag_id = item.bucket_1_tag_id;
        if ("bucket_2_tag_id" in item) data.bucket_2_tag_id = item.bucket_2_tag_id;
        await tx.transaction_meta.upsert({
          where: { transaction_id: item.transaction_id },
          create: { transaction_id: item.transaction_id, ...data },
          update: data
        });
        if ("meta_tag_ids" in item) {
          const uniqueMetaTagIds = [...new Set(item.meta_tag_ids ?? [])];
          await tx.transaction_tags.deleteMany({ where: { transaction_id: item.transaction_id } });
          if (uniqueMetaTagIds.length > 0) {
            await tx.transaction_tags.createMany({
              data: uniqueMetaTagIds.map((tag_id) => ({ transaction_id: item.transaction_id, tag_id })),
              skipDuplicates: true
            });
          }
        }
      }
    });

    clearTransactionMetaCache(user.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

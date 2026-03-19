import { randomUUID } from "crypto";
import express from "express";
import { TagType } from "../../generated/prisma/client";
import type { ServerRequest } from "../middleware/auth";
import { clearTransactionMetaCache, transactionMetaCache } from "../lib/caches";

const INCOME_TYPES = new Set<TagType>([TagType.income_bucket_1, TagType.income_bucket_2]);
const SPENDING_TYPES = new Set<TagType>([TagType.spending_bucket_1, TagType.spending_bucket_2]);

type TransactionTagChange = {
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

router.post("/transaction_meta/tags", async (req, res) => {
  try {
    const { user, prisma } = req as unknown as ServerRequest;
    const items: TransactionTagChange[] = req.body;
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: "Body must be a non-empty array" });
    for (const item of items) {
      if (typeof item.transaction_id !== "string" || !item.transaction_id)
        return res.status(400).json({ error: "Each item must include a valid transaction_id" });
      if ("meta_tag_ids" in item && item.meta_tag_ids != null && !Array.isArray(item.meta_tag_ids))
        return res.status(400).json({ error: "meta_tag_ids must be an array when provided" });
      if (Array.isArray(item.meta_tag_ids) && !item.meta_tag_ids.every((v) => Number.isInteger(v)))
        return res.status(400).json({ error: "meta_tag_ids must contain integer ids only" });
      if ("bucket_1_tag_id" in item && item.bucket_1_tag_id === null)
        return res.status(400).json({ error: "POST /transaction_meta/tags cannot clear bucket_1_tag_id" });
      if ("bucket_2_tag_id" in item && item.bucket_2_tag_id === null)
        return res.status(400).json({ error: "POST /transaction_meta/tags cannot clear bucket_2_tag_id" });
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
      const allTransactionIds = [...new Set(items.map((i) => i.transaction_id))];

      // Ensure a transaction_meta row exists for every transaction we are touching
      await tx.$executeRaw`
        INSERT INTO "transaction_meta" ("transaction_id")
        SELECT UNNEST(${allTransactionIds}::text[])
        ON CONFLICT ("transaction_id") DO NOTHING
      `;

      const bucket1Items = items.filter((item) => typeof item.bucket_1_tag_id === "number");
      if (bucket1Items.length > 0) {
        const bucket1Payload = bucket1Items.map((item) => ({
          transaction_id: item.transaction_id,
          bucket_1_tag_id: item.bucket_1_tag_id
        }));
        const bucket1PayloadJson = JSON.stringify(bucket1Payload);

        await tx.$executeRaw`
          UPDATE "transaction_meta" AS m
          SET "bucket_1_tag_id" = data.bucket_1_tag_id
          FROM (
            SELECT 
              (x->>'transaction_id')::text AS transaction_id,
              (x->>'bucket_1_tag_id')::int AS bucket_1_tag_id
            FROM jsonb_array_elements(${bucket1PayloadJson}::jsonb) AS x
          ) AS data
          WHERE m."transaction_id" = data.transaction_id
        `;
      }

      const bucket2Items = items.filter((item) => typeof item.bucket_2_tag_id === "number");
      if (bucket2Items.length > 0) {
        const bucket2Payload = bucket2Items.map((item) => ({
          transaction_id: item.transaction_id,
          bucket_2_tag_id: item.bucket_2_tag_id
        }));
        const bucket2PayloadJson = JSON.stringify(bucket2Payload);

        await tx.$executeRaw`
          UPDATE "transaction_meta" AS m
          SET "bucket_2_tag_id" = data.bucket_2_tag_id
          FROM (
            SELECT 
              (x->>'transaction_id')::text AS transaction_id,
              (x->>'bucket_2_tag_id')::int AS bucket_2_tag_id
            FROM jsonb_array_elements(${bucket2PayloadJson}::jsonb) AS x
          ) AS data
          WHERE m."transaction_id" = data.transaction_id
        `;
      }

      // Meta-tag semantics: if `meta_tag_ids` is present (even `[]` or `null`),
      // we replace the join-table rows for that transaction.
      const metaItems = items.filter((item) => "meta_tag_ids" in item);
      const metaTransactionIds = [...new Set(metaItems.map((item) => item.transaction_id))];
      if (metaTransactionIds.length > 0) {
        await tx.$executeRaw`
          DELETE FROM "transaction_tags"
          WHERE "transaction_id" = ANY(${metaTransactionIds}::text[])
        `;

        const allMetaLinks = metaItems.flatMap((item) =>
          [...new Set(item.meta_tag_ids ?? [])].map((tag_id) => ({
            transaction_id: item.transaction_id,
            tag_id
          }))
        );

        if (allMetaLinks.length > 0) {
          const allMetaLinksJson = JSON.stringify(allMetaLinks);
          await tx.$executeRaw`
            INSERT INTO "transaction_tags" ("transaction_id", "tag_id")
            SELECT 
              (x->>'transaction_id')::text,
              (x->>'tag_id')::int
            FROM jsonb_array_elements(${allMetaLinksJson}::jsonb) AS x
            ON CONFLICT DO NOTHING
          `;
        }
      }
    });

    clearTransactionMetaCache(user.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/transaction_meta/tags", async (req, res) => {
  try {
    const { user, prisma } = req as unknown as ServerRequest;
    const items: TransactionTagChange[] = req.body;
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: "Body must be a non-empty array" });

    for (const item of items) {
      if (typeof item.transaction_id !== "string" || !item.transaction_id)
        return res.status(400).json({ error: "Each item must include a valid transaction_id" });
      if ("meta_tag_ids" in item && (item.meta_tag_ids == null || !Array.isArray(item.meta_tag_ids) || item.meta_tag_ids.length === 0))
        return res.status(400).json({ error: "meta_tag_ids must be a non-empty array when provided to DELETE" });
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
        select: { id: true }
      }),
      tagIds.length > 0
        ? prisma.tags.findMany({ where: { id: { in: tagIds }, user_id: user.id }, select: { id: true, type: true } })
        : Promise.resolve([])
    ]);

    if (transactions.length !== transactionIds.length)
      return res.status(404).json({ error: "One or more transactions not found" });
    if (tags.length !== tagIds.length)
      return res.status(404).json({ error: "One or more tags not found" });

    await prisma.$transaction(async (tx) => {
      const bucket1Items = items.filter((item) => typeof item.bucket_1_tag_id === "number");
      if (bucket1Items.length > 0) {
        const bucket1Payload = bucket1Items.map((item) => ({
          transaction_id: item.transaction_id,
          bucket_1_tag_id: item.bucket_1_tag_id
        }));
        const bucket1PayloadJson = JSON.stringify(bucket1Payload);

        await tx.$executeRaw`
          UPDATE "transaction_meta" AS m
          SET "bucket_1_tag_id" = NULL
          FROM (
            SELECT 
              (x->>'transaction_id')::text AS transaction_id,
              (x->>'bucket_1_tag_id')::int AS bucket_1_tag_id
            FROM jsonb_array_elements(${bucket1PayloadJson}::jsonb) AS x
          ) AS data
          WHERE m."transaction_id" = data.transaction_id
            AND m."bucket_1_tag_id" = data.bucket_1_tag_id
        `;
      }

      const bucket2Items = items.filter((item) => typeof item.bucket_2_tag_id === "number");
      if (bucket2Items.length > 0) {
        const bucket2Payload = bucket2Items.map((item) => ({
          transaction_id: item.transaction_id,
          bucket_2_tag_id: item.bucket_2_tag_id
        }));
        const bucket2PayloadJson = JSON.stringify(bucket2Payload);

        await tx.$executeRaw`
          UPDATE "transaction_meta" AS m
          SET "bucket_2_tag_id" = NULL
          FROM (
            SELECT 
              (x->>'transaction_id')::text AS transaction_id,
              (x->>'bucket_2_tag_id')::int AS bucket_2_tag_id
            FROM jsonb_array_elements(${bucket2PayloadJson}::jsonb) AS x
          ) AS data
          WHERE m."transaction_id" = data.transaction_id
            AND m."bucket_2_tag_id" = data.bucket_2_tag_id
        `;
      }

      const metaItems = items.filter((item) => Array.isArray(item.meta_tag_ids) && item.meta_tag_ids.length > 0);
      const allMetaLinks = metaItems.flatMap((item) =>
        [...new Set(item.meta_tag_ids ?? [])].map((tag_id) => ({
          transaction_id: item.transaction_id,
          tag_id
        }))
      );

      if (allMetaLinks.length > 0) {
        const allMetaLinksJson = JSON.stringify(allMetaLinks);
        await tx.$executeRaw`
          DELETE FROM "transaction_tags" AS tt
          USING (
            SELECT 
              (x->>'transaction_id')::text AS transaction_id,
              (x->>'tag_id')::int AS tag_id
            FROM jsonb_array_elements(${allMetaLinksJson}::jsonb) AS x
          ) AS data
          WHERE tt."transaction_id" = data.transaction_id
            AND tt."tag_id" = data.tag_id
        `;
      }
    });

    clearTransactionMetaCache(user.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

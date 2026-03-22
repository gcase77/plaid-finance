import express from "express";
import { plaid } from "../lib/plaid";
import { logger } from "../logger";
import { clearTransactionsCache, clearTransactionMetaCache } from "../lib/caches";
import type { ServerRequest } from "../middleware/auth";

const router = express.Router();

router.get("/items", async (req, res) => {
  const items = await (req as unknown as ServerRequest).prisma.items.findMany({
    select: { id: true, institution_name: true }
  });
  res.json(items);
});

router.post("/items/:itemId/delete_all", async (req, res) => {
  const { user, prisma } = req as unknown as ServerRequest;
  const { itemId } = req.params;

  try {
    const item = await prisma.items.findFirst({
      where: { id: itemId },
      select: { id: true, access_token: true }
    });
    if (!item) return res.status(404).json({ error: "Item not found" });

    const accountCount = await prisma.accounts.count({ where: { item_id: itemId } });

    await prisma.$transaction(async (tx) => {
      await tx.transactions.deleteMany({ where: { item_id: itemId } });
      await tx.accounts.deleteMany({ where: { item_id: itemId } });
      await tx.items.delete({ where: { id: itemId } });
    });

    clearTransactionsCache(user.id);
    clearTransactionMetaCache(user.id);

    let plaidRemoved = true;
    let plaidError: string | null = null;
    if (item.access_token) {
      try {
        await plaid.itemRemove({ access_token: item.access_token });
      } catch (e: any) {
        plaidRemoved = false;
        plaidError = e.response?.data?.error_message || e.message;
        logger.log("error", "plaid itemRemove failed", { itemId, userId: user.id, err: plaidError });
      }
    }

    const status = plaidRemoved ? 200 : 207;
    res.status(status).json({
      success: true,
      deleted: { item: itemId, accounts: accountCount },
      plaid_removed: plaidRemoved,
      ...(plaidError && { plaid_error: plaidError })
    });
  } catch (e: any) {
    logger.log("error", "delete_all failed", { itemId, userId: user.id, err: e.message });
    res.status(500).json({ error: e.message });
  }
});

export default router;

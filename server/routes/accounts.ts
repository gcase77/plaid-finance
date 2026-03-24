import express from "express";
import { plaid } from "../lib/plaid";
import type { ServerRequest } from "../middleware/auth";

const router = express.Router();

router.get("/:itemId/accounts", async (req, res) => {
  const accounts = await (req as unknown as ServerRequest).prisma.accounts.findMany({ where: { item_id: req.params.itemId } });
  res.json(accounts);
});

router.post("/:itemId/accounts/refresh", async (req, res) => {
  const { prisma } = req as unknown as ServerRequest;
  const { itemId } = req.params;

  try {
    const [dbAccounts, item] = await Promise.all([
      prisma.accounts.findMany({ where: { item_id: itemId }, select: { id: true } }),
      prisma.items.findFirst({ where: { id: itemId }, select: { access_token: true } })
    ]);

    if (!item) return res.status(404).json({ error: "Item not found" });
    if (!item.access_token) return res.status(400).json({ error: "Item access token not found" });

    const plaidAccounts = (await plaid.accountsGet({ access_token: item.access_token })).data.accounts;
    if (dbAccounts.length !== plaidAccounts.length) {
      return res.status(409).json({
        error: "Account count mismatch between database and Plaid",
        db_count: dbAccounts.length,
        plaid_count: plaidAccounts.length
      });
    }

    const plaidById = new Map(plaidAccounts.map((a) => [a.account_id, a]));
    const missingIds = dbAccounts.map((a) => a.id).filter((id) => !plaidById.has(id));
    if (missingIds.length) {
      return res.status(409).json({
        error: "Some database accounts were not returned by Plaid",
        missing_account_ids: missingIds
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      let count = 0;
      for (const dbAccount of dbAccounts) {
        const plaidAccount = plaidById.get(dbAccount.id)!;
        const result = await tx.accounts.updateMany({
          where: { id: dbAccount.id, item_id: itemId },
          data: {
            name: plaidAccount.name ?? null,
            official_name: plaidAccount.official_name ?? null,
            balances: (plaidAccount.balances as any) ?? null
          }
        });
        count += result.count;
      }
      return count;
    });

    return res.json({ success: true, item_id: itemId, updated_accounts: updated });
  } catch (e: any) {
    return res.status(500).json({ error: e.response?.data?.error_message || e.message });
  }
});

export default router;

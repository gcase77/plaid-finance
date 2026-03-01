import express from "express";
import type { ServerRequest } from "../middleware/auth";

const router = express.Router();
const transactionMetaCache = new Map<string, { rows: unknown[] }>();

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
        meta_tag_id: true
      }
    });

    transactionMetaCache.set(userId, { rows });
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

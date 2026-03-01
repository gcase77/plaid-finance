import express from "express";
import type { ServerRequest } from "../middleware/auth";

const router = express.Router();

router.get("/accounts/:itemId", async (req, res) => {
  const accounts = await (req as unknown as ServerRequest).prisma.accounts.findMany({ where: { item_id: req.params.itemId } });
  res.json(accounts);
});

export default router;

import express from "express";
import type { PrismaClient } from "../../generated/prisma/client";

type Params = { prisma: PrismaClient };

export default ({ prisma }: Params) => {
  const router = express.Router();

  router.get("/items", async (req, res) => {
    const userId = (req as any).user.id;
    const items = await prisma.items.findMany({ where: { user_id: userId } });
    res.json(items);
  });

  router.delete("/items/:id", async (req, res) => {
    await prisma.accounts.deleteMany({ where: { item_id: req.params.id } });
    await prisma.items.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  });

  return router;
};

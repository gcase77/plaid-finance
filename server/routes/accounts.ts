import express from "express";
import type { PrismaClient } from "../../generated/prisma/client";

type Params = { prisma: PrismaClient };

export default ({ prisma }: Params) => {
  const router = express.Router();

  router.get("/accounts/:itemId", async (req, res) => {
    const accounts = await prisma.accounts.findMany({ where: { item_id: req.params.itemId } });
    res.json(accounts);
  });

  return router;
};

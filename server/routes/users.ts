import express from "express";
import type { PrismaClient } from "../../generated/prisma/client";
import type { Logger } from "../logger";

type Params = { prisma: PrismaClient; logger: Logger };

export default ({ prisma, logger }: Params) => {
  const router = express.Router();

  router.post("/users", async (req, res) => {
    try {
      const id = (req as any).user.id;
      const email = req.body.email ?? null;
      await prisma.users.create({ data: { id, email } });
      res.json({ id, email });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.log("error", msg);
      res.status(500).json({ error: msg });
    }
  });

  router.get("/users", async (req, res) => {
    const users = await prisma.users.findMany();
    res.json(users);
  });

  return router;
};

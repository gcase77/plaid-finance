import express from "express";
import { v4 as uuidv4 } from "uuid";
import type { PrismaClient } from "../../generated/prisma/client";

type Params = { prisma: PrismaClient };

export default ({ prisma }: Params) => {
  const router = express.Router();

  router.post("/users", async (req, res) => {
    const id = (req as any).user.id;
    const username = req.body.username ?? null;
    await prisma.users.create({ data: { id, username } });
    res.json({ id, username });
  });

  router.get("/users", async (req, res) => {
    const users = await prisma.users.findMany();
    res.json(users);
  });

  return router;
};

import express from "express";
import type { ServerRequest } from "../middleware/auth";

const router = express.Router();

router.get("/items", async (req, res) => {
  const items = await (req as unknown as ServerRequest).prisma.items.findMany();
  res.json(items);
});

export default router;
